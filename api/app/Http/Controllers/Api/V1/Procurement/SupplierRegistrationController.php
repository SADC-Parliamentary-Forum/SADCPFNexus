<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\SupplierApprovalLog;
use App\Models\SupplierCategory;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class SupplierRegistrationController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function register(Request $request): JsonResponse
    {
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
            'category_ids'         => ['required', 'array', 'min:1', 'max:3'],
            'category_ids.*'       => ['integer', 'exists:supplier_categories,id'],
            'documents'            => ['required', 'array', 'min:1'],
            'documents.*'          => ['file', 'max:25600'],
            'document_types'       => ['nullable', 'array'],
            'document_types.*'     => ['nullable', 'string', 'in:' . implode(',', Attachment::VENDOR_DOCUMENT_TYPES)],
        ]);

        $categoryIds = SupplierCategory::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('id', $data['category_ids'])
            ->pluck('id')
            ->all();

        if (count(array_unique($categoryIds)) !== count(array_unique($data['category_ids']))) {
            return response()->json(['message' => 'One or more selected categories are invalid for this tenant.'], 422);
        }

        $vendor = Vendor::create([
            'tenant_id'           => $tenant->id,
            'supplier_type'       => $data['supplier_type'] ?? 'company',
            'name'                => $data['company_name'],
            'contact_name'        => $data['contact_name'],
            'registration_number' => $data['registration_number'],
            'tax_number'          => $data['tax_number'],
            'contact_email'       => $data['contact_email'],
            'contact_phone'       => $data['contact_phone'],
            'website'             => $data['website'] ?? null,
            'address'             => $data['address'],
            'country'             => $data['country'],
            'payment_terms'       => $data['payment_terms'] ?? null,
            'bank_name'           => $data['bank_name'],
            'bank_account'        => $data['bank_account'],
            'bank_branch'         => $data['bank_branch'],
            'status'              => 'pending_approval',
            'submitted_at'        => now(),
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
        ]);
        $user->assignRole(Role::findByName('Supplier', 'sanctum'));

        foreach ($request->file('documents', []) as $index => $file) {
            $documentTypes = $request->input('document_types', []);
            $documentType = $documentTypes[$index] ?? Attachment::DOCUMENT_TYPE_COMPANY_PROFILE;
            $path = $file->store('attachments/vendors/' . $vendor->id, ['disk' => 'local']);
            $vendor->attachments()->create([
                'tenant_id'         => $tenant->id,
                'uploaded_by'       => $user->id,
                'document_type'     => $documentType,
                'original_filename' => $file->getClientOriginalName(),
                'storage_path'      => $path,
                'mime_type'         => $file->getMimeType(),
                'size_bytes'        => $file->getSize(),
            ]);
        }

        SupplierApprovalLog::create([
            'tenant_id'    => $tenant->id,
            'vendor_id'    => $vendor->id,
            'action'       => 'submitted',
            'reason'       => null,
            'metadata'     => ['portal_user_id' => $user->id],
            'performed_by' => $user->id,
            'performed_at' => now(),
        ]);

        $procurementUsers = $this->procurementRecipients($tenant->id);

        foreach ($procurementUsers as $procurementUser) {
            $this->notifications->dispatch(
                $procurementUser,
                'supplier.application_submitted',
                [
                    'name'     => $procurementUser->name,
                    'supplier' => $vendor->name,
                    'contact'  => $vendor->contact_name,
                ],
                ['module' => 'procurement', 'record_id' => $vendor->id, 'url' => '/procurement/vendors/' . $vendor->id]
            );
        }

        return response()->json([
            'message' => 'Supplier registration submitted. Your account will be activated after procurement approval.',
            'data'    => [
                'vendor_id' => $vendor->id,
                'user_id'   => $user->id,
                'status'    => $vendor->status,
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
