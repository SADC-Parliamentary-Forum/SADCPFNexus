<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\SupplierApprovalLog;
use App\Models\SupplierCategory;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorOwner;
use App\Modules\Procurement\Services\SupplierCatalogueSeeder;
use App\Modules\Procurement\Services\SupplierDocumentService;
use App\Modules\Procurement\Services\SupplierEmailVerificationService;
use App\Services\CaptchaService;
use App\Services\NotificationService;
use App\Support\FrontendUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class SupplierRegistrationController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly CaptchaService $captcha,
        private readonly SupplierEmailVerificationService $emailVerification,
        private readonly SupplierCatalogueSeeder $catalogue,
        private readonly SupplierDocumentService $documents,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $this->captcha->assertBrowserSubmission($request, consume: false, allowMobileBypass: false);
        $tenant = $this->resolveTenant($request);

        $isIndividual = $request->input('supplier_type', 'company') === 'individual';

        $data = $request->validate([
            'tenant_id'            => ['nullable', 'integer'],
            'supplier_type'        => ['nullable', 'string', 'in:company,individual'],
            'company_name'         => ['required', 'string', 'max:300'],
            'registration_number'  => [$isIndividual ? 'nullable' : 'required', 'string', 'max:100'],
            'tax_number'           => [$isIndividual ? 'nullable' : 'required', 'string', 'max:100'],
            'contact_name'         => ['required', 'string', 'max:255'],
            'contact_email'        => ['required', 'email', 'max:255', 'unique:users,email'],
            'contact_phone'        => ['required', 'string', 'max:50'],
            'website'              => ['nullable', 'url', 'max:255'],
            'address'              => ['required', 'string', 'max:500'],
            'country'              => ['required', 'string', 'max:100'],
            'bank_name'            => ['required', 'string', 'max:255'],
            'bank_account'         => ['required', 'string', 'max:100'],
            'bank_branch'          => ['required', 'string', 'max:255'],
            'payment_terms'        => ['nullable', 'string', 'max:50'],
            'password'             => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation'=> ['required', 'string'],
            'category_ids'         => ['required', 'array', 'min:1'],
            'category_ids.*'       => ['integer', 'exists:supplier_categories,id'],
            'documents'            => ['required', 'array', 'min:1', 'max:15'],
            'documents.*'          => ['file', 'max:25600'],
            'document_types'       => ['nullable', 'array', 'max:15'],
            'document_types.*'     => ['nullable', 'string', 'max:80'],
            'trading_name'         => ['nullable', 'string', 'max:300'],
            'incorporation_date'   => ['nullable', 'date'],
            'business_type'        => ['nullable', 'string', 'max:80'],
            'postal_address'       => ['nullable', 'string', 'max:500'],
            'owners'               => ['nullable', 'array', 'max:50'],
            'owners.*.full_name'   => ['required_with:owners', 'string', 'max:255'],
            'owners.*.role'        => ['nullable', 'string', 'max:80'],
            'owners.*.ownership_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'captcha_token'        => ['nullable', 'string'],
            CaptchaService::HONEYPOT_FIELD => ['nullable', 'string'],
        ]);

        $categoryIds = SupplierCategory::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $data['category_ids'])
            ->pluck('id')
            ->all();

        if (count(array_unique($categoryIds)) !== count(array_unique($data['category_ids']))) {
            return response()->json(['message' => 'One or more selected categories are invalid for this tenant.'], 422);
        }

        $this->catalogue->ensureForTenant((int) $tenant->id);

        $vendor = Vendor::create([
            'tenant_id'           => $tenant->id,
            'supplier_type'       => $data['supplier_type'] ?? 'company',
            'name'                => $data['company_name'],
            'trading_name'        => $data['trading_name'] ?? null,
            'incorporation_date'  => $data['incorporation_date'] ?? null,
            'business_type'       => $data['business_type'] ?? null,
            'contact_name'        => $data['contact_name'],
            'registration_number' => $data['registration_number'] ?? null,
            'tax_number'          => $data['tax_number'] ?? null,
            'contact_email'       => $data['contact_email'],
            'contact_phone'       => $data['contact_phone'],
            'website'             => $data['website'] ?? null,
            'address'             => $data['address'],
            'postal_address'      => $data['postal_address'] ?? null,
            'country'             => $data['country'],
            'payment_terms'       => $data['payment_terms'] ?? null,
            'bank_name'           => $data['bank_name'],
            'bank_account'        => $data['bank_account'],
            'bank_branch'         => $data['bank_branch'],
            'status'              => Vendor::STATUS_DRAFT,
            'is_approved'         => false,
            'is_active'           => true,
        ]);
        $vendor->syncLegacyFlagsFromStatus();
        $vendor->save();
        $vendor->categories()->sync($categoryIds);
        $vendor->update([
            'category' => SupplierCategory::whereIn('id', $categoryIds)->orderBy('name')->pluck('name')->join(', '),
        ]);

        $user = User::create([
            'tenant_id'       => $tenant->id,
            'vendor_id'       => $vendor->id,
            'name'            => $data['contact_name'],
            'email'           => $data['contact_email'],
            'password'        => Hash::make($data['password']),
            'job_title'       => 'Supplier',
            'classification'  => 'UNCLASSIFIED',
            'is_active'       => false,
            'account_status'  => User::STATUS_ACTIVE,
            'setup_completed' => true,
            'email_verified_at' => null,
        ]);
        $user->assignRole(Role::findByName('Supplier', 'sanctum'));

        foreach ($request->file('documents', []) as $index => $file) {
            $documentTypes = $request->input('document_types', []);
            $documentType = $documentTypes[$index] ?? Attachment::DOCUMENT_TYPE_COMPANY_PROFILE;
            try {
                $this->documents->storeForVendor($vendor, $file, $documentType, $user);
            } catch (\Illuminate\Validation\ValidationException $e) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "documents.{$index}" => $e->errors()['file'] ?? $e->errors()['type_code'] ?? ['The uploaded file type is not allowed.'],
                ]);
            }
        }

        foreach ($data['owners'] ?? [] as $index => $owner) {
            VendorOwner::create([
                'tenant_id' => $tenant->id,
                'vendor_id' => $vendor->id,
                'full_name' => $owner['full_name'],
                'role' => $owner['role'] ?? null,
                'ownership_percent' => $owner['ownership_percent'] ?? null,
                'sort_order' => $index,
            ]);
        }

        $this->emailVerification->send($user);

        SupplierApprovalLog::create([
            'tenant_id'    => $tenant->id,
            'vendor_id'    => $vendor->id,
            'action'       => 'draft_created',
            'reason'       => null,
            'metadata'     => ['portal_user_id' => $user->id],
            'performed_by' => $user->id,
            'performed_at' => now(),
        ]);

        $this->notifications->dispatch(
            $user,
            'supplier.application_received',
            [
                'name'      => $user->name,
                'supplier'  => $vendor->name,
                'login_url' => FrontendUrl::to('supplier/login'),
            ],
            [
                'module'          => 'procurement',
                'record_id'       => $vendor->id,
                'url'             => '/supplier',
                'allow_inactive'  => true,
                'include_acting'  => false,
                'include_delegates' => false,
                'idempotency_key' => 'supplier.application_received:'.$vendor->id.':'.$user->id,
            ]
        );

        $documents = $vendor->attachments()
            ->get(['id', 'original_filename', 'document_type', 'mime_type', 'size_bytes', 'created_at'])
            ->values();

        $this->captcha->consumeBrowserChallenge($request);

        return response()->json([
            'message' => 'Supplier account created. Verify your email, then log in to complete declarations and submit the application.',
            'data'    => [
                'vendor_id' => $vendor->id,
                'user_id'   => $user->id,
                'status'    => $vendor->status,
                'documents' => $documents,
                'email_verification_required' => true,
            ],
        ], 201);
    }

    private function resolveTenant(Request $request): Tenant
    {
        $tenantId = (int) ($request->input('tenant_id')
            ?: Tenant::query()->where('is_active', true)->value('id')
            ?: Tenant::query()->value('id'));

        $tenant = Tenant::query()->find($tenantId);
        abort_if(!$tenant, 422, 'Unable to resolve a tenant for supplier registration.');

        return $tenant;
    }
}
