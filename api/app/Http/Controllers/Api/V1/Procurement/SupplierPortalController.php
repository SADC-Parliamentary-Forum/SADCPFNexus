<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Invoice;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\RfqInvitation;
use App\Models\SupplierCategory;
use App\Models\SupplierChangeRequest;
use App\Models\SupplierDocument;
use App\Models\User;
use App\Models\Vendor;
use App\Modules\Procurement\Services\InvoiceService;
use App\Modules\Procurement\Services\SupplierChangeRequestService;
use App\Modules\Procurement\Services\SupplierCompletenessService;
use App\Modules\Procurement\Services\SupplierDocumentService;
use App\Modules\Procurement\Services\SupplierEligibilityService;
use App\Modules\Procurement\Support\VendorPresenter;
use App\Services\NotificationService;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierPortalController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly InvoiceService $invoiceService,
        private readonly SupplierEligibilityService $eligibility,
        private readonly SupplierCompletenessService $completeness,
        private readonly SupplierDocumentService $documents,
        private readonly SupplierChangeRequestService $changeRequests,
    ) {}

    public function me(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        return response()->json(['data' => VendorPresenter::forSupplier($vendor, $request->user())]);
    }

    public function categories(Request $request): JsonResponse
    {
        $categories = SupplierCategory::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    public function downloadAttachment(Request $request, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $vendor = $this->currentVendor($request);
        if ($attachment->attachable_type !== Vendor::class || (int) $attachment->attachable_id !== (int) $vendor->id) {
            abort(404);
        }
        if (! $attachment->storage_path || ! Storage::disk('local')->exists($attachment->storage_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->streamDownload(
            function () use ($attachment) {
                $stream = Storage::disk('local')->readStream($attachment->storage_path);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            },
            $attachment->original_filename,
            ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']
        );
    }

    public function dashboard(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $eligibility = $this->eligibility->evaluate($vendor);
        $completeness = $this->completeness->summarize($vendor, $request->user());

        $openRfqCount = RfqInvitation::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('vendor_id', $vendor->id)
            ->whereHas('procurementRequest', function ($query) {
                $query->whereNotNull('rfq_issued_at')
                    ->where(function ($q) {
                        $q->whereNull('rfq_deadline')->orWhereDate('rfq_deadline', '>=', now()->toDateString());
                    });
            })
            ->count();

        $expiring = $vendor->currentDocuments()
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<=', now()->addDays(90)->toDateString())
            ->orderBy('expiry_date')
            ->get(['id', 'type_code', 'name', 'expiry_date', 'status']);

        $actions = [];
        if (! $request->user()->email_verified_at) {
            $actions[] = ['code' => 'verify_email', 'label' => 'Verify your email before submitting the application', 'href' => '/supplier/profile'];
        }
        if ($completeness['can_submit']) {
            $actions[] = ['code' => 'submit_application', 'label' => 'Submit your supplier application for review', 'href' => '/supplier/profile'];
        }
        foreach ($completeness['blockers'] as $blocker) {
            if ($blocker === 'email_unverified') {
                continue;
            }
            $actions[] = ['code' => $blocker, 'label' => 'Complete: '.str_replace('_', ' ', $blocker), 'href' => '/supplier/profile'];
        }
        foreach ($expiring as $doc) {
            $actions[] = [
                'code' => 'expiring_document',
                'label' => ($doc->name ?: $doc->type_code).' expires '.$doc->expiry_date?->toDateString(),
                'href' => '/supplier/profile',
            ];
        }
        if ($openRfqCount > 0) {
            $actions[] = ['code' => 'open_rfqs', 'label' => $openRfqCount.' open RFQ invitation(s)', 'href' => '/supplier/rfqs'];
        }
        $issuedPos = PurchaseOrder::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('vendor_id', $vendor->id)
            ->whereIn('status', ['issued', 'sent'])
            ->count();
        if ($issuedPos > 0) {
            $actions[] = ['code' => 'po_ack', 'label' => $issuedPos.' purchase order(s) awaiting acknowledgement (Phase 3)', 'href' => '/supplier/purchase-orders'];
        }

        return response()->json([
            'data' => [
                'vendor'                => VendorPresenter::forSupplier($vendor, $request->user()),
                'status'                => $vendor->normalizedStatus(),
                'completeness_percent'  => $completeness['percent'],
                'compliance_status'     => $eligibility['compliance_status'],
                'eligibility'           => $eligibility,
                'actions'               => $actions,
                'open_rfq_count'        => $openRfqCount,
                'quote_count'           => ProcurementQuote::where('vendor_id', $vendor->id)->count(),
                'purchase_order_count'  => PurchaseOrder::where('tenant_id', $request->user()->tenant_id)->where('vendor_id', $vendor->id)->count(),
                'invoice_count'         => Invoice::where('tenant_id', $request->user()->tenant_id)->where('vendor_id', $vendor->id)->count(),
                'pending_compliance'    => $eligibility['compliance_status'] === 'valid' ? 0 : 1,
            ],
        ]);
    }

    public function rfqs(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        $invitations = RfqInvitation::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('vendor_id', $vendor->id)
            ->with([
                'procurementRequest:id,reference_number,title,description,currency,rfq_deadline,rfq_notes,status',
                'procurementRequest.supplierCategories:id,name,code',
                'quote',
            ])
            ->orderByDesc('invited_at')
            ->get();

        return response()->json(['data' => $invitations]);
    }

    public function showRfq(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        $invitation = RfqInvitation::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('procurement_request_id', $procurementRequest->id)
            ->where('vendor_id', $vendor->id)
            ->with(['quote', 'procurementRequest.supplierCategories', 'procurementRequest.items'])
            ->firstOrFail();

        if (!$invitation->viewed_at) {
            $invitation->update(['viewed_at' => now(), 'status' => 'viewed']);
        }

        $procurementRequest->load(['supplierCategories', 'items']);

        return response()->json([
            'data' => [
                'invitation' => $invitation->fresh(['quote']),
                'request'    => [
                    'id' => $procurementRequest->id,
                    'reference_number' => $procurementRequest->reference_number,
                    'title' => $procurementRequest->title,
                    'description' => $procurementRequest->description,
                    'currency' => $procurementRequest->currency,
                    'rfq_deadline' => $procurementRequest->rfq_deadline,
                    'rfq_notes' => $procurementRequest->rfq_notes,
                    'status' => $procurementRequest->status,
                    'supplier_categories' => $procurementRequest->supplierCategories,
                    'items' => $procurementRequest->items,
                ],
                'eligibility' => $this->eligibility->evaluate($vendor, $procurementRequest, $invitation),
            ],
        ]);
    }

    public function submitQuote(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        $invitation = RfqInvitation::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('procurement_request_id', $procurementRequest->id)
            ->where('vendor_id', $vendor->id)
            ->firstOrFail();

        $eligibility = $this->eligibility->evaluate($vendor, $procurementRequest, $invitation);
        if (! $eligibility['can_submit_quotes']) {
            abort(403, 'Your supplier account is not eligible to submit quotes for this RFQ.');
        }

        if ($procurementRequest->status === 'awarded') {
            abort(422, 'This RFQ has already been awarded.');
        }

        app(\App\Modules\Procurement\Services\SealedBidService::class)
            ->assertSubmissionsOpen($procurementRequest);

        $data = $request->validate([
            'quoted_amount' => ['required', 'numeric', 'min:0.01'],
            'currency'      => ['nullable', 'string', 'size:3'],
            'quote_date'    => ['nullable', 'date'],
            'notes'         => ['nullable', 'string', 'max:2000'],
        ]);

        $quote = app(\App\Modules\Procurement\Services\SealedBidService::class)->replaceOrCreatePortalQuote(
            $procurementRequest,
            (int) $invitation->id,
            [
                'vendor_id'            => $vendor->id,
                'submitted_by_user_id' => $request->user()->id,
                'vendor_name'          => $vendor->name,
                'quoted_amount'        => $data['quoted_amount'],
                'currency'             => $data['currency'] ?? $procurementRequest->currency,
                'submission_channel'   => 'system_portal',
                'notes'                => $data['notes'] ?? null,
                'quote_date'           => $data['quote_date'] ?? now()->toDateString(),
                'is_recommended'       => false,
            ]
        );

        $invitation->update([
            'status'       => 'responded',
            'responded_at' => now(),
        ]);

        $this->notifyProcurementOfQuoteSubmission(
            tenantId: $request->user()->tenant_id,
            reference: $procurementRequest->reference_number,
            title: $procurementRequest->title,
            supplier: $vendor->name,
            amount: number_format((float) $quote->quoted_amount, 2) . ' ' . $quote->currency,
            url: '/procurement/rfq/' . $procurementRequest->id
        );

        return response()->json(['message' => 'Quote submitted.', 'data' => $quote->fresh(['vendor', 'invitation'])], 201);
    }

    public function purchaseOrders(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        $purchaseOrders = PurchaseOrder::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('vendor_id', $vendor->id)
            ->with(['procurementRequest', 'items'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $purchaseOrders]);
    }

    public function invoices(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        $invoices = Invoice::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('vendor_id', $vendor->id)
            ->with(['purchaseOrder', 'goodsReceiptNote'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $invoices]);
    }

    public function submitProformaInvoice(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->currentVendor($request, true);

        $data = $request->validate([
            'vendor_invoice_number' => ['required', 'string', 'max:100'],
            'invoice_date'          => ['required', 'date'],
            'due_date'              => ['required', 'date', 'after_or_equal:invoice_date'],
            'amount'                => ['required', 'numeric', 'min:0.01'],
            'currency'              => ['nullable', 'string', 'max:10'],
        ]);

        try {
            $invoice = $this->invoiceService->submitSupplierProforma($purchaseOrder, $data, $request->user());
            return response()->json(['message' => 'Proforma invoice submitted.', 'data' => $invoice], 201);
        } catch (InvalidArgumentException $e) {
            abort(422, $e->getMessage());
        }
    }

    public function submitFinalInvoice(Request $request, Invoice $invoice): JsonResponse
    {
        $this->currentVendor($request, true);

        $data = $request->validate([
            'vendor_invoice_number' => ['nullable', 'string', 'max:100'],
            'invoice_date'          => ['nullable', 'date'],
            'due_date'              => ['nullable', 'date'],
            'amount'                => ['nullable', 'numeric', 'min:0.01'],
            'currency'              => ['nullable', 'string', 'max:10'],
        ]);

        try {
            $updated = $this->invoiceService->submitSupplierFinal($invoice, $data, $request->user());
            return response()->json(['message' => 'Final invoice submitted.', 'data' => $updated]);
        } catch (InvalidArgumentException $e) {
            abort(422, $e->getMessage());
        }
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);

        $data = $request->validate([
            'contact_name'   => ['nullable', 'string', 'max:255'],
            'contact_phone'  => ['nullable', 'string', 'max:50'],
            'website'        => ['nullable', 'url', 'max:255'],
            'address'        => ['nullable', 'string', 'max:500'],
            'country'        => ['nullable', 'string', 'max:100'],
            'bank_name'      => ['nullable', 'string', 'max:255'],
            'bank_account'   => ['nullable', 'string', 'max:100'],
            'bank_branch'    => ['nullable', 'string', 'max:255'],
            'payment_terms'  => ['nullable', 'string', 'max:50'],
            'category_ids'   => ['nullable', 'array', 'min:1'],
            'category_ids.*' => ['integer', Rule::exists('supplier_categories', 'id')->where('tenant_id', $vendor->tenant_id)],
            'documents'      => ['nullable', 'array', 'max:15'],
            'documents.*'    => ['file', 'max:25600'],
            'document_types' => ['nullable', 'array'],
            'document_types.*' => ['nullable', 'string', 'max:80'],
            'name' => ['nullable', 'string', 'max:300'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'tax_number' => ['nullable', 'string', 'max:100'],
        ]);

        $actor = $request->user();
        if (array_key_exists('bank_name', $data) || array_key_exists('bank_account', $data) || array_key_exists('bank_branch', $data)) {
            $banking = [
                'bank_name' => $data['bank_name'] ?? $vendor->bank_name,
                'bank_account' => $data['bank_account'] ?? $vendor->bank_account,
                'bank_branch' => $data['bank_branch'] ?? $vendor->bank_branch,
            ];
            $this->changeRequests->queueOrApply($vendor, SupplierChangeRequest::GROUP_BANKING, $banking, $actor);
            unset($data['bank_name'], $data['bank_account'], $data['bank_branch']);
        }
        foreach (['name' => SupplierChangeRequest::GROUP_LEGAL_NAME, 'registration_number' => SupplierChangeRequest::GROUP_REGISTRATION, 'tax_number' => SupplierChangeRequest::GROUP_TAX] as $field => $group) {
            if (array_key_exists($field, $data) && $data[$field] !== $vendor->{$field}) {
                $this->changeRequests->queueOrApply($vendor, $group, [$field => $data[$field]], $actor);
                unset($data[$field]);
            }
        }

        $vendor->update([
            'contact_name'  => array_key_exists('contact_name', $data) ? $data['contact_name'] : $vendor->contact_name,
            'contact_phone' => array_key_exists('contact_phone', $data) ? $data['contact_phone'] : $vendor->contact_phone,
            'website'       => array_key_exists('website', $data) ? $data['website'] : $vendor->website,
            'address'       => array_key_exists('address', $data) ? $data['address'] : $vendor->address,
            'country'       => array_key_exists('country', $data) ? $data['country'] : $vendor->country,
            'payment_terms' => array_key_exists('payment_terms', $data) ? $data['payment_terms'] : $vendor->payment_terms,
        ]);

        if (!empty($data['category_ids'])) {
            $result = $this->changeRequests->queueCategoryIds($vendor, $data['category_ids'], $request->user());
            if ($result instanceof Vendor) {
                $categoryNames = $result->categories()->orderBy('name')->pluck('name')->join(', ');
                $this->notifyProcurementOfProfileUpdate(
                    tenantId: $request->user()->tenant_id,
                    supplier: $result->name,
                    contact: $result->contact_name ?: $result->name,
                    categories: $categoryNames,
                    url: '/procurement/vendors/' . $result->id
                );
            }
        }

        foreach ($request->file('documents', []) as $index => $file) {
            $documentTypes = $request->input('document_types', []);
            $documentType = $documentTypes[$index] ?? Attachment::DOCUMENT_TYPE_COMPANY_PROFILE;
            $this->documents->storeForVendor($vendor, $file, $documentType, $request->user());
        }

        return response()->json(['message' => 'Supplier profile updated.', 'data' => VendorPresenter::forSupplier($vendor->fresh(['categories']), $request->user())]);
    }

    private function currentVendor(Request $request, bool $approvedOnly = false): Vendor
    {
        $user = $request->user();
        abort_unless($user->isSupplier() && $user->vendor_id, 403);

        $vendor = Vendor::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', $user->vendor_id)
            ->firstOrFail();

        abort_if($vendor->portalAccessBlocked(), 403, 'This supplier account is not permitted to use the portal.');

        if ($approvedOnly) {
            $evaluation = $this->eligibility->evaluate($vendor);
            if (! $evaluation['can_submit_quotes'] && ! $evaluation['can_receive_pos']) {
                abort(403, 'Your supplier account is not eligible for this transaction.');
            }
        }

        return $vendor;
    }

    private function procurementRecipients(int $tenantId): Collection
    {
        return User::query()
            ->with(['roles.permissions', 'permissions'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin() || $user->hasAnyPermission(['procurement.manage_vendors', 'procurement.admin']))
            ->values();
    }

    private function notifyProcurementOfQuoteSubmission(
        int $tenantId,
        string $reference,
        string $title,
        string $supplier,
        string $amount,
        string $url
    ): void {
        foreach ($this->procurementRecipients($tenantId) as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'supplier.quote_submitted',
                [
                    'name'      => $recipient->name,
                    'reference' => $reference,
                    'title'     => $title,
                    'supplier'  => $supplier,
                    'amount'    => $amount,
                ],
                ['module' => 'procurement', 'url' => $url]
            );
        }
    }

    private function notifyProcurementOfProfileUpdate(
        int $tenantId,
        string $supplier,
        string $contact,
        string $categories,
        string $url
    ): void {
        foreach ($this->procurementRecipients($tenantId) as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'supplier.profile_updated',
                [
                    'name'       => $recipient->name,
                    'supplier'   => $supplier,
                    'contact'    => $contact,
                    'categories' => $categories ?: 'None specified',
                ],
                ['module' => 'procurement', 'url' => $url]
            );
        }
    }
}
