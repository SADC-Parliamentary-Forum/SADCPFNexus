<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\ProcurementQuote;
use App\Models\PurchaseOrder;
use App\Models\RfqInvitation;
use App\Models\SupplierChangeRequest;
use App\Models\SupplierDocument;
use App\Models\Vendor;
use App\Modules\Procurement\Services\SupplierChangeRequestService;
use App\Modules\Procurement\Services\SupplierDocumentService;
use App\Modules\Procurement\Services\SupplierEligibilityService;
use App\Modules\Procurement\Services\VendorService;
use App\Modules\Procurement\Support\BankAccountMasker;
use App\Modules\Procurement\Support\VendorPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierStaff360Controller extends Controller
{
    public function __construct(
        private readonly SupplierDocumentService $documents,
        private readonly SupplierChangeRequestService $changeRequests,
        private readonly SupplierEligibilityService $eligibility,
        private readonly VendorService $vendors,
    ) {}

    public function show(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertView($request, $vendor);
        $payload = VendorPresenter::forStaff($vendor, $request->user());
        $payload['recent_quotes'] = $vendor->quotes()
            ->with(['procurementRequest:id,reference_number,title,status,category,currency'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get()
            ->map(function (ProcurementQuote $quote) {
                $request = $quote->procurementRequest;

                return [
                    'id' => $quote->id,
                    'vendor_name' => $quote->vendor_name,
                    'quoted_amount' => $quote->quoted_amount,
                    'currency' => $quote->currency,
                    'is_recommended' => $quote->is_recommended,
                    'quote_date' => $quote->quote_date,
                    'created_at' => $quote->created_at,
                    'procurement_request' => $request ? [
                        'id' => $request->id,
                        'reference_number' => $request->reference_number,
                        'title' => $request->title,
                        'status' => $request->status,
                        'category' => $request->category,
                        'currency' => $request->currency,
                    ] : null,
                ];
            });

        return response()->json(['data' => $payload]);
    }

    public function activity(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertView($request, $vendor);

        return response()->json([
            'data' => [
                'rfqs' => RfqInvitation::query()
                    ->where('vendor_id', $vendor->id)
                    ->with('procurementRequest:id,reference_number,title,status,rfq_deadline')
                    ->orderByDesc('invited_at')
                    ->limit(50)
                    ->get(),
                'quotes' => ProcurementQuote::query()
                    ->where('vendor_id', $vendor->id)
                    ->with('procurementRequest:id,reference_number,title,status')
                    ->orderByDesc('created_at')
                    ->limit(50)
                    ->get(['id', 'procurement_request_id', 'quoted_amount', 'currency', 'quote_date', 'created_at']),
                'purchase_orders' => PurchaseOrder::query()
                    ->where('vendor_id', $vendor->id)
                    ->where('tenant_id', $vendor->tenant_id)
                    ->orderByDesc('created_at')
                    ->limit(50)
                    ->get(['id', 'reference_number', 'title', 'status', 'total_amount', 'currency', 'created_at']),
                'invoices' => Invoice::query()
                    ->where('vendor_id', $vendor->id)
                    ->where('tenant_id', $vendor->tenant_id)
                    ->orderByDesc('created_at')
                    ->limit(50)
                    ->get(['id', 'vendor_invoice_number', 'status', 'amount', 'currency', 'created_at']),
            ],
        ]);
    }

    public function documents(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertView($request, $vendor);

        return response()->json([
            'data' => $vendor->supplierDocuments()
                ->with('verifiedBy:id,name')
                ->orderByDesc('is_current')
                ->orderByDesc('version')
                ->get(),
        ]);
    }

    public function verifyDocument(Request $request, Vendor $vendor, SupplierDocument $supplierDocument): JsonResponse
    {
        $this->assertManage($request, $vendor);
        $this->assertDocument($vendor, $supplierDocument);
        $data = $request->validate(['remarks' => ['nullable', 'string', 'max:2000']]);

        return response()->json([
            'message' => 'Document verified.',
            'data' => $this->documents->verify($supplierDocument, $request->user(), $data['remarks'] ?? null),
        ]);
    }

    public function rejectDocument(Request $request, Vendor $vendor, SupplierDocument $supplierDocument): JsonResponse
    {
        $this->assertManage($request, $vendor);
        $this->assertDocument($vendor, $supplierDocument);
        $data = $request->validate(['remarks' => ['required', 'string', 'max:2000']]);

        return response()->json([
            'message' => 'Document rejected.',
            'data' => $this->documents->reject($supplierDocument, $request->user(), $data['remarks']),
        ]);
    }

    public function downloadDocument(Request $request, Vendor $vendor, SupplierDocument $supplierDocument): StreamedResponse|JsonResponse
    {
        $this->assertView($request, $vendor);
        $this->assertDocument($vendor, $supplierDocument);
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

    public function changeRequests(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertView($request, $vendor);
        $rows = $vendor->changeRequests()->with(['requester:id,name', 'reviewer:id,name'])->latest()->get();
        $canSeeBank = BankAccountMasker::canViewFull($request->user());
        $rows->transform(fn (SupplierChangeRequest $row) => $this->presentChangeRequest($row, $canSeeBank));

        return response()->json(['data' => $rows]);
    }

    public function approveChangeRequest(Request $request, Vendor $vendor, SupplierChangeRequest $changeRequest): JsonResponse
    {
        $this->assertManage($request, $vendor);
        $this->assertChangeRequest($vendor, $changeRequest);
        if ($changeRequest->field_group === SupplierChangeRequest::GROUP_BANKING) {
            $this->assertBank($request);
        }
        $data = $request->validate(['remarks' => ['nullable', 'string', 'max:2000']]);

        return response()->json([
            'message' => 'Change request approved.',
            'data' => $this->presentChangeRequest(
                $this->changeRequests->approve($changeRequest, $request->user(), $data['remarks'] ?? null),
                BankAccountMasker::canViewFull($request->user())
            ),
        ]);
    }

    public function rejectChangeRequest(Request $request, Vendor $vendor, SupplierChangeRequest $changeRequest): JsonResponse
    {
        $this->assertManage($request, $vendor);
        $this->assertChangeRequest($vendor, $changeRequest);
        if ($changeRequest->field_group === SupplierChangeRequest::GROUP_BANKING) {
            $this->assertBank($request);
        }
        $data = $request->validate(['remarks' => ['required', 'string', 'max:2000']]);

        return response()->json([
            'message' => 'Change request rejected.',
            'data' => $this->presentChangeRequest(
                $this->changeRequests->reject($changeRequest, $request->user(), $data['remarks']),
                BankAccountMasker::canViewFull($request->user())
            ),
        ]);
    }

    public function verifyBanking(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertManage($request, $vendor);
        $this->assertBank($request);

        return response()->json([
            'message' => 'Banking details verified.',
            'data' => VendorPresenter::forStaff($this->vendors->verifyBanking($vendor, $request->user()), $request->user()),
        ]);
    }

    public function approveConditional(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertManage($request, $vendor);

        return response()->json([
            'message' => 'Vendor conditionally approved.',
            'data' => $this->vendors->approveVendor($vendor, $request->user(), true),
        ]);
    }

    public function markUnderReview(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertManage($request, $vendor);

        return response()->json([
            'message' => 'Vendor marked under review.',
            'data' => $this->vendors->markUnderReview($vendor, $request->user()),
        ]);
    }

    public function eligibility(Request $request, Vendor $vendor): JsonResponse
    {
        $this->assertView($request, $vendor);

        return response()->json(['data' => $this->eligibility->evaluate($vendor)]);
    }

    public function overrideInvitation(Request $request, Vendor $vendor, RfqInvitation $invitation): JsonResponse
    {
        $this->assertManage($request, $vendor);
        if ((int) $invitation->vendor_id !== (int) $vendor->id || (int) $invitation->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $user = $request->user();
        abort_unless($user->isSystemAdmin() || $user->can('procurement.admin'), 403);

        $invitation->update([
            'eligibility_override' => true,
            'eligibility_override_by' => $user->id,
            'eligibility_override_at' => now(),
        ]);

        return response()->json(['message' => 'Eligibility override recorded.', 'data' => $invitation->fresh()]);
    }

    private function assertView(Request $request, Vendor $vendor): void
    {
        $user = $request->user();
        if ((int) $vendor->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        abort_unless(
            $user->isSystemAdmin()
            || $user->hasAnyRole(['Procurement Officer'])
            || $user->can('procurement.view')
            || $user->can('procurement.manage_vendors')
            || $user->can('procurement.admin')
            || $user->can('procurement.supplier.read'),
            403
        );
    }

    private function assertManage(Request $request, Vendor $vendor): void
    {
        $this->assertView($request, $vendor);
        $user = $request->user();
        abort_unless(
            $user->isSystemAdmin()
            || $user->hasAnyRole(['Procurement Officer'])
            || $user->can('procurement.manage_vendors')
            || $user->can('procurement.admin')
            || $user->can('procurement.supplier.approve'),
            403
        );
    }

    private function assertBank(Request $request): void
    {
        abort_unless(BankAccountMasker::canViewFull($request->user()), 403);
    }

    private function assertDocument(Vendor $vendor, SupplierDocument $document): void
    {
        if ((int) $document->vendor_id !== (int) $vendor->id) {
            abort(404);
        }
    }

    private function assertChangeRequest(Vendor $vendor, SupplierChangeRequest $request): void
    {
        if ((int) $request->vendor_id !== (int) $vendor->id) {
            abort(404);
        }
    }

    private function presentChangeRequest(SupplierChangeRequest $change, bool $canSeeBank): SupplierChangeRequest
    {
        if ($change->field_group === SupplierChangeRequest::GROUP_BANKING && ! $canSeeBank) {
            $change->payload = BankAccountMasker::maskPayload($change->payload ?? []);
            $change->previous_payload = BankAccountMasker::maskPayload($change->previous_payload ?? []);
        }

        return $change;
    }
}
