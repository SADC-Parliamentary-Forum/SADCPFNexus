<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementException;
use App\Models\ProcurementInboxMessage;
use App\Models\ProcurementProject;
use App\Models\Tenant;
use App\Modules\Procurement\Services\LpoSequenceAllocator;
use App\Modules\Procurement\Services\ProcurementProjectService;
use App\Modules\Procurement\Services\ProcurementWorkbenchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementAutomationController extends Controller
{
    public function workbench(Request $request, ProcurementWorkbenchService $workbench): JsonResponse
    {
        $this->assertOfficer($request);

        return response()->json(['data' => $workbench->cards($request->user())]);
    }

    public function sequence(Request $request, LpoSequenceAllocator $allocator): JsonResponse
    {
        $this->assertOfficer($request);

        return response()->json(['data' => $allocator->status((int) $request->user()->tenant_id)]);
    }

    public function activateSequence(Request $request, LpoSequenceAllocator $allocator): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'last_legacy_number' => ['required', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $status = $allocator->activate(
            (int) $request->user()->tenant_id,
            $request->user(),
            (int) $data['last_legacy_number'],
            $data['reason'],
        );

        return response()->json(['message' => 'LPO sequence activated.', 'data' => $status]);
    }

    public function projects(Request $request, ProcurementProjectService $projects): JsonResponse
    {
        $this->assertOfficer($request);

        return response()->json(['data' => $projects->list(Tenant::findOrFail($request->user()->tenant_id))]);
    }

    public function storeProject(Request $request, ProcurementProjectService $projects): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:180'],
            'funding_source' => ['nullable', 'string', 'max:80'],
            'donor_id' => ['nullable', 'string', 'max:80'],
            'programme_id' => ['nullable', 'integer'],
            'policy_profile_id' => ['nullable', 'integer'],
            'account_code' => ['nullable', 'string', 'max:80'],
            'cost_centre' => ['nullable', 'string', 'max:80'],
            'allows_no_po_payment' => ['nullable', 'boolean'],
        ]);
        $row = $projects->create(Tenant::findOrFail($request->user()->tenant_id), $request->user(), $data);

        return response()->json(['data' => $row], 201);
    }

    public function exceptions(Request $request): JsonResponse
    {
        $this->assertOfficer($request);
        $rows = ProcurementException::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($rows);
    }

    public function approveException(Request $request, ProcurementException $exception): JsonResponse
    {
        $this->assertAdmin($request);
        if ((int) $exception->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $exception->update([
            'status' => ProcurementException::STATUS_APPROVED,
            'approved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);
        \App\Models\AuditLog::record('procurement.exception_approved', [
            'auditable_type' => ProcurementException::class,
            'auditable_id' => $exception->id,
            'tags' => 'procurement',
        ]);

        return response()->json(['data' => $exception]);
    }

    public function inbox(Request $request): JsonResponse
    {
        $this->assertOfficer($request);
        $configured = (bool) config('procurement.inbox_imap_host');
        $rows = ProcurementInboxMessage::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => $rows,
            'imap_configured' => $configured,
            'note' => $configured ? null : 'IMAP intake adapter is not configured. Forward files via upload or POST /inbox.',
        ]);
    }

    public function ingestInbox(Request $request): JsonResponse
    {
        $this->assertOfficer($request);
        $data = $request->validate([
            'from_email' => ['required', 'email'],
            'subject' => ['nullable', 'string'],
            'file' => ['required', 'file', 'max:25600'],
        ]);
        $msg = ProcurementInboxMessage::create([
            'tenant_id' => $request->user()->tenant_id,
            'from_email' => $data['from_email'],
            'subject' => $data['subject'] ?? null,
            'received_at' => now(),
            'status' => 'received',
            'payload' => ['filename' => $request->file('file')->getClientOriginalName()],
        ]);
        $intake = app(\App\Modules\Procurement\Services\DocumentIntakeService::class)
            ->createFromUpload($request->user(), $request->file('file'), null, 'email');
        $msg->update(['intake_id' => $intake->id, 'status' => 'extracted']);
        \App\Models\AuditLog::record('procurement.document_email_received', [
            'auditable_type' => ProcurementInboxMessage::class,
            'auditable_id' => $msg->id,
            'tags' => 'procurement',
        ]);

        return response()->json(['data' => $msg->fresh('intake'), 'intake' => $intake], 201);
    }

    private function assertOfficer(Request $request): void
    {
        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
    }

    private function assertAdmin(Request $request): void
    {
        if (! $request->user()->hasAnyRole(['System Admin', 'Procurement Officer', 'Secretary General'])) {
            abort(403);
        }
    }
}
