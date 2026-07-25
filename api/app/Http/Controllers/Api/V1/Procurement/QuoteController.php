<?php
namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementCoiDeclaration;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Modules\Procurement\Services\ProcurementCoiService;
use App\Modules\Procurement\Services\SealedBidService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function __construct(
        private readonly ProcurementCoiService $coiService,
        private readonly SealedBidService $sealedBidService,
    ) {}

    public function index(ProcurementRequest $procurementRequest): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) request()->user()->tenant_id) {
            abort(404);
        }
        $quotes = $procurementRequest->quotes()
            ->where(function ($q) {
                $q->where('is_current', true)->orWhereNull('is_current');
            })
            ->with(['vendor', 'assessor', 'invitation', 'attachments.uploader:id,name'])
            ->orderBy('quoted_amount')
            ->get();

        $procurementRequest->loadMissing('tender');

        return response()->json([
            'data' => $this->sealedBidService->redactQuotes($quotes, $procurementRequest),
        ]);
    }

    public function store(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'vendor_name'    => ['required', 'string', 'max:300'],
            'vendor_id'      => ['nullable', 'integer', 'exists:vendors,id'],
            'quoted_amount'  => ['required', 'numeric', 'min:0'],
            'currency'       => ['nullable', 'string', 'size:3'],
            'is_recommended' => ['nullable', 'boolean'],
            'compliance_passed' => ['nullable', 'boolean'],
            'compliance_notes'  => ['nullable', 'string', 'max:1000'],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'quote_date'     => ['nullable', 'date'],
        ]);

        $data['currency'] = $data['currency'] ?? $procurementRequest->currency;
        if (array_key_exists('compliance_passed', $data) || array_key_exists('compliance_notes', $data)) {
            $data['assessed_by'] = $request->user()->id;
            $data['assessed_at'] = now();
        }
        $data['submission_channel'] = 'internal';

        $quote = $procurementRequest->quotes()->create($data);
        return response()->json(['message' => 'Quote added.', 'data' => $quote->load(['vendor', 'assessor', 'attachments.uploader:id,name'])], 201);
    }

    public function update(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ((int) $quote->procurement_request_id !== (int) $procurementRequest->id) {
            abort(404);
        }
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'vendor_name'    => ['sometimes', 'string', 'max:300'],
            'vendor_id'      => ['nullable', 'integer', 'exists:vendors,id'],
            'quoted_amount'  => ['sometimes', 'numeric', 'min:0'],
            'currency'       => ['nullable', 'string', 'size:3'],
            'is_recommended' => ['nullable', 'boolean'],
            'compliance_passed' => ['nullable', 'boolean'],
            'compliance_notes'  => ['nullable', 'string', 'max:1000'],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'quote_date'     => ['nullable', 'date'],
            'coi_declared'     => ['nullable', 'boolean'],
            'coi_has_conflict' => ['nullable', 'boolean'],
            'coi_notes'        => ['nullable', 'string', 'max:2000'],
        ]);

        $isAssessing = array_key_exists('compliance_passed', $data)
            || array_key_exists('compliance_notes', $data)
            || array_key_exists('is_recommended', $data);

        if ($isAssessing) {
            $this->coiService->record($procurementRequest, $request->user(), $data, 'assess');
        }

        if ($isAssessing) {
            $data['assessed_by'] = $request->user()->id;
            $data['assessed_at'] = now();
        }

        unset($data['coi_declared'], $data['coi_has_conflict'], $data['coi_notes']);

        $quote->update($data);
        return response()->json(['message' => 'Quote updated.', 'data' => $quote->fresh(['vendor', 'assessor', 'attachments.uploader:id,name'])]);
    }

    public function destroy(ProcurementRequest $procurementRequest, ProcurementQuote $quote): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) request()->user()->tenant_id) {
            abort(404);
        }
        if ((int) $quote->procurement_request_id !== (int) $procurementRequest->id) {
            abort(404);
        }
        if (!request()->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }
        $quote->delete();
        return response()->json(['message' => 'Quote removed.']);
    }

    public function assess(Request $request, ProcurementRequest $procurementRequest, ProcurementQuote $quote): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ((int) $quote->procurement_request_id !== (int) $procurementRequest->id) {
            abort(404);
        }
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }

        $this->coiService->assertDeclared($procurementRequest, $request->user(), ProcurementCoiDeclaration::CONTEXT_ASSESS);

        $data = $request->validate([
            'compliance_passed' => ['required', 'boolean'],
            'compliance_notes'  => ['nullable', 'string', 'max:1000'],
            'is_recommended'    => ['nullable', 'boolean'],
        ]);

        $quote->update([
            'compliance_passed' => $data['compliance_passed'],
            'compliance_notes'  => $data['compliance_notes'] ?? null,
            'is_recommended'    => $data['is_recommended'] ?? $quote->is_recommended,
            'assessed_by'       => $request->user()->id,
            'assessed_at'       => now(),
        ]);

        return response()->json([
            'message' => 'Quote assessed.',
            'data'    => $quote->fresh(['vendor', 'assessor', 'attachments.uploader:id,name']),
        ]);
    }
}
