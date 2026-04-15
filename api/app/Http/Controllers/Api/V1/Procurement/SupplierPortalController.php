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
use App\Models\User;
use App\Models\Vendor;
use App\Modules\Procurement\Services\InvoiceService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class SupplierPortalController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly InvoiceService $invoiceService,
    ) {}

    public function me(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);
        $vendor->load(['categories', 'attachments', 'portalUsers:id,vendor_id,name,email,is_active']);

        return response()->json(['data' => $vendor]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request);

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

        return response()->json([
            'data' => [
                'vendor'                => $vendor->load('categories'),
                'open_rfq_count'        => $openRfqCount,
                'quote_count'           => ProcurementQuote::where('vendor_id', $vendor->id)->count(),
                'purchase_order_count'  => PurchaseOrder::where('tenant_id', $request->user()->tenant_id)->where('vendor_id', $vendor->id)->count(),
                'invoice_count'         => Invoice::where('tenant_id', $request->user()->tenant_id)->where('vendor_id', $vendor->id)->count(),
                'pending_compliance'    => $vendor->status === 'approved' ? 0 : 1,
            ],
        ]);
    }

    public function rfqs(Request $request): JsonResponse
    {
        $vendor = $this->currentVendor($request, true);

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
        $vendor = $this->currentVendor($request, true);

        $invitation = RfqInvitation::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('procurement_request_id', $procurementRequest->id)
            ->where('vendor_id', $vendor->id)
            ->with(['quote', 'procurementRequest.supplierCategories', 'procurementRequest.items'])
            ->firstOrFail();

        if (!$invitation->viewed_at) {
            $invitation->update(['viewed_at' => now(), 'status' => 'viewed']);
        }

        return response()->json([
            'data' => [
                'invitation' => $invitation->fresh(['quote']),
                'request'    => $procurementRequest->load(['supplierCategories', 'items']),
            ],
        ]);
    }

    public function submitQuote(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $vendor = $this->currentVendor($request, true);

        $invitation = RfqInvitation::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('procurement_request_id', $procurementRequest->id)
            ->where('vendor_id', $vendor->id)
            ->firstOrFail();

        if ($procurementRequest->status === 'awarded') {
            abort(422, 'This RFQ has already been awarded.');
        }

        if ($procurementRequest->rfq_deadline && now()->isAfter($procurementRequest->rfq_deadline->endOfDay())) {
            abort(422, 'The RFQ deadline has passed.');
        }

        $data = $request->validate([
            'quoted_amount' => ['required', 'numeric', 'min:0.01'],
            'currency'      => ['nullable', 'string', 'size:3'],
            'quote_date'    => ['nullable', 'date'],
            'notes'         => ['nullable', 'string', 'max:2000'],
        ]);

        $quote = ProcurementQuote::updateOrCreate(
            ['rfq_invitation_id' => $invitation->id],
            [
                'procurement_request_id' => $procurementRequest->id,
                'vendor_id'              => $vendor->id,
                'submitted_by_user_id'   => $request->user()->id,
                'vendor_name'            => $vendor->name,
                'quoted_amount'          => $data['quoted_amount'],
                'currency'               => $data['currency'] ?? $procurementRequest->currency,
                'submission_channel'     => 'system_portal',
                'notes'                  => $data['notes'] ?? null,
                'quote_date'             => $data['quote_date'] ?? now()->toDateString(),
                'is_recommended'         => false,
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
            'category_ids'   => ['nullable', 'array', 'min:1', 'max:3'],
            'category_ids.*' => ['integer', 'exists:supplier_categories,id'],
            'documents'      => ['nullable', 'array'],
            'documents.*'    => ['file', 'max:25600'],
            'document_types' => ['nullable', 'array'],
            'document_types.*' => ['nullable', 'string', 'in:' . implode(',', Attachment::VENDOR_DOCUMENT_TYPES)],
        ]);

        $vendor->update([
            'contact_name'  => array_key_exists('contact_name', $data) ? $data['contact_name'] : $vendor->contact_name,
            'contact_phone' => array_key_exists('contact_phone', $data) ? $data['contact_phone'] : $vendor->contact_phone,
            'website'       => array_key_exists('website', $data) ? $data['website'] : $vendor->website,
            'address'       => array_key_exists('address', $data) ? $data['address'] : $vendor->address,
            'country'       => array_key_exists('country', $data) ? $data['country'] : $vendor->country,
            'bank_name'     => array_key_exists('bank_name', $data) ? $data['bank_name'] : $vendor->bank_name,
            'bank_account'  => array_key_exists('bank_account', $data) ? $data['bank_account'] : $vendor->bank_account,
            'bank_branch'   => array_key_exists('bank_branch', $data) ? $data['bank_branch'] : $vendor->bank_branch,
            'payment_terms' => array_key_exists('payment_terms', $data) ? $data['payment_terms'] : $vendor->payment_terms,
        ]);

        if (!empty($data['category_ids'])) {
            $categoryIds = SupplierCategory::query()
                ->where('tenant_id', $request->user()->tenant_id)
                ->whereIn('id', $data['category_ids'])
                ->pluck('id')
                ->all();
            $vendor->categories()->sync($categoryIds);
            $vendor->update([
                'category'                  => SupplierCategory::whereIn('id', $categoryIds)->orderBy('name')->pluck('name')->join(', '),
                'status'                    => 'pending_approval',
                'last_info_request_reason'  => 'Category change submitted for procurement review.',
            ]);
            $vendor->syncLegacyFlagsFromStatus();
            $vendor->save();
            $vendor->portalUsers()->update(['is_active' => false]);

            $this->notifyProcurementOfProfileUpdate(
                tenantId: $request->user()->tenant_id,
                supplier: $vendor->name,
                contact: $vendor->contact_name ?: $vendor->name,
                categories: SupplierCategory::whereIn('id', $categoryIds)->orderBy('name')->pluck('name')->join(', '),
                url: '/procurement/vendors/' . $vendor->id
            );
        }

        foreach ($request->file('documents', []) as $index => $file) {
            $documentTypes = $request->input('document_types', []);
            $documentType = $documentTypes[$index] ?? Attachment::DOCUMENT_TYPE_COMPANY_PROFILE;
            $path = $file->store('attachments/vendors/' . $vendor->id, ['disk' => 'local']);
            $vendor->attachments()->create([
                'tenant_id'         => $vendor->tenant_id,
                'uploaded_by'       => $request->user()->id,
                'document_type'     => $documentType,
                'original_filename' => $file->getClientOriginalName(),
                'storage_path'      => $path,
                'mime_type'         => $file->getMimeType(),
                'size_bytes'        => $file->getSize(),
            ]);
        }

        return response()->json(['message' => 'Supplier profile updated.', 'data' => $vendor->fresh(['categories', 'attachments'])]);
    }

    private function currentVendor(Request $request, bool $approvedOnly = false): Vendor
    {
        $user = $request->user();
        abort_unless($user->isSupplier() && $user->vendor_id, 403);

        $vendor = Vendor::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', $user->vendor_id)
            ->firstOrFail();

        if ($approvedOnly && $vendor->status !== 'approved') {
            abort(403, 'Your supplier account has not been approved for transactions.');
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
