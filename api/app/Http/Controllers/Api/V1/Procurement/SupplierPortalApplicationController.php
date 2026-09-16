<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\SupplierChangeRequest;
use App\Models\SupplierDeclarationAcceptance;
use App\Models\SupplierDeclarationTemplate;
use App\Models\SupplierDocument;
use App\Models\SupplierDocumentRequirementType;
use App\Models\User;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierCatalogueSeeder;
use App\Modules\Procurement\Services\SupplierChangeRequestService;
use App\Modules\Procurement\Services\SupplierCompletenessService;
use App\Modules\Procurement\Services\SupplierDocumentService;
use App\Modules\Procurement\Services\SupplierEligibilityService;
use App\Modules\Procurement\Support\VendorPresenter;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierPortalApplicationController extends Controller
{
    public function __construct(
        private readonly SupplierCompletenessService $completeness,
        private readonly SupplierEligibilityService $eligibility,
        private readonly SupplierDocumentService $documents,
        private readonly SupplierChangeRequestService $changeRequests,
        private readonly SupplierCatalogueSeeder $catalogue,
        private readonly NotificationService $notifications,
    ) {}

    public function completeness(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $this->catalogue->ensureForTenant((int) $vendor->tenant_id);

        return response()->json([
            'data' => [
                'vendor' => VendorPresenter::forSupplier($vendor, $request->user()),
                'completeness' => $this->completeness->summarize($vendor, $request->user()),
                'eligibility' => $this->eligibility->evaluate($vendor),
            ],
        ]);
    }

    public function submitApplication(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $this->catalogue->ensureForTenant((int) $vendor->tenant_id);
        $summary = $this->completeness->summarize($vendor, $request->user());

        if (! $summary['can_submit']) {
            return response()->json([
                'message' => 'Application is incomplete.',
                'data' => $summary,
            ], 422);
        }

        if (! $vendor->canSubmitApplication()) {
            abort(422, 'This application cannot be submitted in its current status.');
        }

        $vendor->fill([
            'status' => Vendor::STATUS_SUBMITTED,
            'submitted_at' => now(),
            'last_info_request_reason' => null,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();

        app(\App\Services\WorkflowService::class)->initiate($vendor->fresh(), 'supplier', $request->user());

        app(\App\Modules\Procurement\Services\VendorService::class)
            ->logAction($vendor, 'submitted', null, $request->user());

        foreach ($this->procurementRecipients((int) $vendor->tenant_id) as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'supplier.application_submitted',
                [
                    'name' => $recipient->name,
                    'supplier' => $vendor->name,
                    'contact' => $vendor->contact_name,
                ],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/procurement/vendors/'.$vendor->id]
            );
        }

        return response()->json([
            'message' => 'Application submitted for procurement review.',
            'data' => VendorPresenter::forSupplier($vendor->fresh(), $request->user()),
        ]);
    }

    public function updateWizard(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $data = $request->validate([
            'trading_name' => ['nullable', 'string', 'max:300'],
            'incorporation_date' => ['nullable', 'date'],
            'business_type' => ['nullable', 'string', 'max:80'],
            'postal_address' => ['nullable', 'string', 'max:500'],
            'website' => ['nullable', 'url', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'country' => ['nullable', 'string', 'max:100'],
            'geographic_coverage' => ['nullable', 'array'],
            'years_experience' => ['nullable', 'integer', 'min:0', 'max:200'],
            'experience_summary' => ['nullable', 'string', 'max:5000'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'contacts' => ['nullable', 'array'],
            'payment_terms' => ['nullable', 'string', 'max:50'],
            'is_sme' => ['sometimes', 'boolean'],
            'name' => ['nullable', 'string', 'max:300'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'tax_number' => ['nullable', 'string', 'max:100'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'bank_account' => ['nullable', 'string', 'max:100'],
            'bank_branch' => ['nullable', 'string', 'max:255'],
            'category_ids' => ['nullable', 'array', 'min:1'],
            'category_ids.*' => ['integer', Rule::exists('supplier_categories', 'id')->where('tenant_id', $vendor->tenant_id)],
            'owners' => ['nullable', 'array', 'max:50'],
            'owners.*.full_name' => ['required_with:owners', 'string', 'max:255'],
            'owners.*.role' => ['nullable', 'string', 'max:80'],
            'owners.*.ownership_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'owners.*.nationality' => ['nullable', 'string', 'max:100'],
            'owners.*.id_number' => ['nullable', 'string', 'max:100'],
            'owners.*.is_beneficial_owner' => ['sometimes', 'boolean'],
            'owners.*.is_pep' => ['sometimes', 'boolean'],
        ]);

        $queued = [];
        $actor = $request->user();

        foreach ([
            'name' => SupplierChangeRequest::GROUP_LEGAL_NAME,
            'registration_number' => SupplierChangeRequest::GROUP_REGISTRATION,
            'tax_number' => SupplierChangeRequest::GROUP_TAX,
        ] as $field => $group) {
            if (array_key_exists($field, $data) && $data[$field] !== $vendor->{$field}) {
                $result = $this->changeRequests->queueOrApply($vendor, $group, [$field => $data[$field]], $actor);
                if ($result instanceof SupplierChangeRequest) {
                    $queued[] = $result;
                }
                unset($data[$field]);
            }
        }

        if (array_key_exists('bank_name', $data) || array_key_exists('bank_account', $data) || array_key_exists('bank_branch', $data)) {
            $banking = [
                'bank_name' => $data['bank_name'] ?? $vendor->bank_name,
                'bank_account' => $data['bank_account'] ?? $vendor->bank_account,
                'bank_branch' => $data['bank_branch'] ?? $vendor->bank_branch,
            ];
            $changed = $banking['bank_name'] !== $vendor->bank_name
                || $banking['bank_account'] !== $vendor->bank_account
                || $banking['bank_branch'] !== $vendor->bank_branch;
            if ($changed) {
                $result = $this->changeRequests->queueOrApply($vendor, SupplierChangeRequest::GROUP_BANKING, $banking, $actor);
                if ($result instanceof SupplierChangeRequest) {
                    $queued[] = $result;
                }
            }
            unset($data['bank_name'], $data['bank_account'], $data['bank_branch']);
        }

        if (array_key_exists('owners', $data)) {
            $result = $this->changeRequests->queueOrApply($vendor, SupplierChangeRequest::GROUP_OWNERSHIP, ['owners' => $data['owners']], $actor);
            if ($result instanceof SupplierChangeRequest) {
                $queued[] = $result;
            }
            unset($data['owners']);
        }

        $fillable = collect($data)->except(['category_ids'])->all();
        if ($fillable !== []) {
            $vendor->fill($fillable);
            $vendor->save();
        }

        if (! empty($data['category_ids'])) {
            $result = $this->changeRequests->queueCategoryIds($vendor, $data['category_ids'], $actor);
            if ($result instanceof SupplierChangeRequest) {
                $queued[] = $result;
            }
        }

        return response()->json([
            'message' => $queued === [] ? 'Profile updated.' : 'Profile updated. Critical changes were queued for review.',
            'data' => VendorPresenter::forSupplier($vendor->fresh(['owners', 'categories']), $actor),
            'change_requests' => $queued,
        ]);
    }

    public function declarations(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $this->catalogue->ensureForTenant((int) $vendor->tenant_id);

        $templates = SupplierDeclarationTemplate::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->orderBy('code')
            ->get();

        $accepted = SupplierDeclarationAcceptance::query()
            ->where('vendor_id', $vendor->id)
            ->get()
            ->keyBy('template_id');

        return response()->json([
            'data' => $templates->map(fn (SupplierDeclarationTemplate $template) => [
                'id' => $template->id,
                'code' => $template->code,
                'title' => $template->title,
                'body' => $template->body,
                'version' => $template->version,
                'required_at_registration' => $template->required_at_registration,
                'accepted' => $accepted->has($template->id),
                'accepted_at' => optional($accepted->get($template->id)?->accepted_at)?->toIso8601String(),
            ]),
        ]);
    }

    public function acceptDeclarations(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $data = $request->validate([
            'template_ids' => ['required', 'array', 'min:1'],
            'template_ids.*' => ['integer'],
        ]);

        $templates = SupplierDeclarationTemplate::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->whereIn('id', $data['template_ids'])
            ->get();

        foreach ($templates as $template) {
            SupplierDeclarationAcceptance::query()->updateOrCreate(
                ['vendor_id' => $vendor->id, 'template_id' => $template->id],
                [
                    'tenant_id' => $vendor->tenant_id,
                    'accepted_by' => $request->user()->id,
                    'accepted_at' => now(),
                    'ip_address' => $request->ip(),
                ]
            );
        }

        return response()->json([
            'message' => 'Declarations accepted.',
            'data' => $this->completeness->summarize($vendor->fresh(), $request->user()),
        ]);
    }

    public function documents(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $this->catalogue->ensureForTenant((int) $vendor->tenant_id);
        $vendor->loadMissing(['currentDocuments', 'categories']);

        $types = SupplierDocumentRequirementType::query()
            ->where('tenant_id', $vendor->tenant_id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (SupplierDocumentRequirementType $type) => $type->appliesToVendor($vendor))
            ->values();

        $current = $vendor->currentDocuments->sortBy('type_code')->values();
        $byType = $current->groupBy('type_code');

        $presentedTypes = $types->map(fn (SupplierDocumentRequirementType $type) => [
            'code' => $type->code,
            'label' => $type->label,
            'mandatory' => (bool) $type->mandatory,
            'has_expiry' => (bool) $type->has_expiry,
            'required_at_registration' => (bool) $type->required_at_registration,
            'allows_multiple' => $type->code === 'other',
        ])->values();

        $requirements = $types
            ->filter(fn (SupplierDocumentRequirementType $type) => $type->mandatory || $type->required_at_registration)
            ->map(function (SupplierDocumentRequirementType $type) use ($byType) {
                $doc = $byType->get($type->code)?->first();
                $status = 'needed';
                if ($doc) {
                    $status = $doc->isExpired() ? SupplierDocument::STATUS_EXPIRED : $doc->status;
                }
                $needed = ! $doc || in_array($status, [SupplierDocument::STATUS_REJECTED, SupplierDocument::STATUS_EXPIRED], true);

                return [
                    'code' => $type->code,
                    'label' => $type->label,
                    'needed' => $needed,
                    'status' => $needed && ! $doc ? 'needed' : $status,
                    'document' => $doc ? $this->presentDocument($doc) : null,
                ];
            })
            ->values();

        return response()->json([
            'data' => [
                'types' => $presentedTypes,
                'requirements' => $requirements,
                'documents' => $current->map(fn (SupplierDocument $doc) => $this->presentDocument($doc))->values(),
            ],
        ]);
    }

    public function uploadDocument(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'type_code' => ['required', 'string', 'max:80'],
            'name' => ['nullable', 'string', 'max:255'],
            'document_number' => ['nullable', 'string', 'max:120'],
            'issuing_authority' => ['nullable', 'string', 'max:255'],
            'issue_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
        ]);

        $document = $this->documents->storeForVendor(
            $vendor,
            $request->file('file'),
            $data['type_code'],
            $request->user(),
            $data
        );

        return response()->json(['message' => 'Document uploaded.', 'data' => $this->presentDocument($document)], 201);
    }

    public function downloadDocument(Request $request, SupplierDocument $supplierDocument): StreamedResponse|JsonResponse
    {
        $vendor = $this->currentVendor($request);
        if ((int) $supplierDocument->vendor_id !== (int) $vendor->id) {
            abort(404);
        }

        $path = $this->documents->downloadPath($supplierDocument);
        if (! $path) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->streamDownload(
            function () use ($path) {
                $stream = Storage::disk('local')->readStream($path);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            },
            $supplierDocument->original_filename ?: $supplierDocument->name,
            ['Content-Type' => $supplierDocument->mime_type ?: 'application/octet-stream']
        );
    }

    public function changeRequests(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        return response()->json([
            'data' => $vendor->changeRequests()->latest()->limit(50)->get(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentDocument(SupplierDocument $document): array
    {
        return [
            'id' => $document->id,
            'type_code' => $document->type_code,
            'name' => $document->name,
            'original_filename' => $document->original_filename,
            'document_number' => $document->document_number,
            'issuing_authority' => $document->issuing_authority,
            'issue_date' => optional($document->issue_date)?->toDateString(),
            'expiry_date' => optional($document->expiry_date)?->toDateString(),
            'version' => (int) $document->version,
            'status' => $document->isExpired() ? SupplierDocument::STATUS_EXPIRED : $document->status,
            'remarks' => $document->remarks,
            'is_current' => (bool) $document->is_current,
            'verified_at' => optional($document->verified_at)?->toIso8601String(),
        ];
    }

    private function currentVendor(Request $request): Vendor
    {
        $user = $request->user();
        abort_unless($user->isSupplier() && $user->vendor_id, 403);

        $vendor = Vendor::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', $user->vendor_id)
            ->firstOrFail();

        abort_if($vendor->portalAccessBlocked(), 403, 'This supplier account is not permitted to use the portal.');

        return $vendor;
    }

    private function procurementRecipients(int $tenantId): \Illuminate\Support\Collection
    {
        return User::query()
            ->with(['roles.permissions', 'permissions'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin() || $user->hasAnyPermission(['procurement.manage_vendors', 'procurement.admin']))
            ->values();
    }
}
