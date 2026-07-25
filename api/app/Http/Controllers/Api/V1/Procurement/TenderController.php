<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tender;
use App\Models\TenderCommittee;
use App\Models\TenderCommitteeMeeting;
use App\Models\TenderCommitteeMember;
use App\Modules\Procurement\Services\TenderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TenderController extends Controller
{
    public function __construct(private readonly TenderService $tenderService) {}

    private function gate(Request $request): void
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin'])) {
            abort(403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->gate($request);
        $query = Tender::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['procurementRequest:id,reference_number,title,status,estimated_value', 'committee:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function evaluations(Request $request): JsonResponse
    {
        $this->gate($request);
        $rows = Tender::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereIn('status', [Tender::STATUS_OPENED, Tender::STATUS_EVALUATING])
            ->with(['procurementRequest.quotes' => fn ($q) => $q->where('is_current', true), 'committee'])
            ->orderByDesc('bids_opened_at')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function bidSubmissions(Request $request): JsonResponse
    {
        $this->gate($request);
        $tenders = Tender::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['procurementRequest.quotes' => fn ($q) => $q->where('is_current', true)->with('vendor')])
            ->orderByDesc('created_at')
            ->get();

        $rows = [];
        foreach ($tenders as $tender) {
            $sealed = $tender->isSealed();
            foreach ($tender->procurementRequest?->quotes ?? [] as $quote) {
                $row = [
                    'tender_id'        => $tender->id,
                    'tender_reference' => $tender->reference_number,
                    'quote_id'         => $quote->id,
                    'vendor_name'      => $quote->vendor_name,
                    'version'          => $quote->version,
                    'status'           => $tender->status,
                    'financials_sealed'=> $sealed,
                ];
                if (!$sealed) {
                    $row['quoted_amount'] = $quote->quoted_amount;
                }
                $rows[] = $row;
            }
        }

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gate($request);
        $data = $request->validate([
            'procurement_request_id' => ['required', 'integer', 'exists:procurement_requests,id'],
            'title'                  => ['required', 'string', 'max:255'],
            'notice'                 => ['nullable', 'string'],
            'tender_committee_id'    => ['nullable', 'integer', 'exists:tender_committees,id'],
            'submission_deadline'    => ['nullable', 'date'],
            'sealed_mode'            => ['nullable', 'boolean'],
            'technical_weight'       => ['nullable', 'numeric', 'min:0', 'max:100'],
            'financial_weight'       => ['nullable', 'numeric', 'min:0', 'max:100'],
            'min_technical_score'    => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $tender = $this->tenderService->create($data, $request->user());

        return response()->json(['message' => 'Tender created.', 'data' => $tender], 201);
    }

    public function show(Request $request, Tender $tender): JsonResponse
    {
        $this->gate($request);
        if ((int) $tender->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $tender->load(['procurementRequest.quotes.vendor', 'committee.members.user', 'createdBy']),
        ]);
    }

    public function publish(Request $request, Tender $tender): JsonResponse
    {
        $this->gate($request);
        return response()->json([
            'message' => 'Tender published.',
            'data'    => $this->tenderService->publish($tender, $request->user()),
        ]);
    }

    public function close(Request $request, Tender $tender): JsonResponse
    {
        $this->gate($request);
        return response()->json([
            'message' => 'Tender closed.',
            'data'    => $this->tenderService->close($tender, $request->user()),
        ]);
    }

    public function openBids(Request $request, Tender $tender): JsonResponse
    {
        $this->gate($request);
        return response()->json([
            'message' => 'Bids opened.',
            'data'    => $this->tenderService->openBids($tender, $request->user()),
        ]);
    }

    public function startEvaluation(Request $request, Tender $tender): JsonResponse
    {
        $this->gate($request);
        return response()->json([
            'message' => 'Evaluation started.',
            'data'    => $this->tenderService->startEvaluation($tender, $request->user()),
        ]);
    }
}
