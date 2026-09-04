<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementDocumentIntake;
use App\Modules\Procurement\Services\DocumentIntakeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentIntakeController extends Controller
{
    public function __construct(private readonly DocumentIntakeService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeOfficer($request);
        $rows = ProcurementDocumentIntake::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['vendor', 'project', 'lines'])
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeOfficer($request);
        $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'idempotency_key' => ['nullable', 'string', 'max:80'],
        ]);
        $intake = $this->service->createFromUpload(
            $request->user(),
            $request->file('file'),
            $request->input('idempotency_key'),
        );

        return response()->json(['message' => 'Document received.', 'data' => $this->payload($intake)], 201);
    }

    public function show(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->assertTenant($request, $intake);

        return response()->json(['data' => $this->payload($intake->load(['lines', 'vendor', 'project', 'procurementRequest', 'purchaseOrder']))]);
    }

    public function extract(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->authorizeOfficer($request);
        $this->assertTenant($request, $intake);
        $intake = $this->service->extract($intake);

        return response()->json(['message' => 'Extraction completed.', 'data' => $this->payload($intake)]);
    }

    public function confirm(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->authorizeOfficer($request);
        $this->assertTenant($request, $intake);
        $data = $request->validate([
            'fields' => ['nullable', 'array'],
            'lines' => ['nullable', 'array'],
            'vendor_id' => ['nullable', 'integer'],
            'procurement_project_id' => ['nullable', 'integer'],
            'category' => ['nullable', 'string', 'in:goods,services,works'],
            'use_supplier_master' => ['nullable', 'boolean'],
            'duplicate_override' => ['nullable', 'boolean'],
            'acknowledge_bank_hold' => ['nullable', 'boolean'],
            'exception' => ['nullable', 'array'],
        ]);
        $intake = $this->service->confirm($intake, $request->user(), $data);

        return response()->json(['message' => 'Intake confirmed.', 'data' => $this->payload($intake)]);
    }

    public function matches(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->authorizeOfficer($request);
        $this->assertTenant($request, $intake);

        return response()->json(['data' => $this->service->matches($intake)]);
    }

    public function linkRequest(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->authorizeOfficer($request);
        $this->assertTenant($request, $intake);
        $data = $request->validate(['procurement_request_id' => ['required', 'integer']]);
        $intake = $this->service->linkRequest($intake, $request->user(), (int) $data['procurement_request_id']);

        return response()->json(['message' => 'Procurement request linked.', 'data' => $this->payload($intake)]);
    }

    public function createRequest(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->authorizeOfficer($request);
        $this->assertTenant($request, $intake);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:300'],
            'description' => ['nullable', 'string'],
            'justification' => ['nullable', 'string'],
            'budget_line' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'in:goods,services,works'],
            'requester_id' => ['nullable', 'integer'],
            'programme_id' => ['nullable', 'integer'],
            'idempotency_key' => ['nullable', 'string'],
        ]);
        $pr = $this->service->createRequest($intake, $request->user(), $data);

        return response()->json(['message' => 'Procurement request created from document.', 'data' => $pr], 201);
    }

    private function payload(ProcurementDocumentIntake $intake): array
    {
        $data = $intake->toArray();
        $data['duplicate_matches'] = $intake->getAttribute('duplicate_matches');
        $data['vat_warning'] = $intake->vat_identified ? null : 'VAT not identified — verify';
        $confidence = (int) ($intake->extraction_confidence ?? 0);
        $data['confidence_band'] = $confidence >= 90 ? 'ok' : ($confidence >= 70 ? 'review' : 'attention');

        return $data;
    }

    private function authorizeOfficer(Request $request): void
    {
        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
    }

    private function assertTenant(Request $request, ProcurementDocumentIntake $intake): void
    {
        if ((int) $intake->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $this->authorizeOfficer($request);
    }
}
