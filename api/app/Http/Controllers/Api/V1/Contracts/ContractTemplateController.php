<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ContractTemplate;
use App\Models\ContractTemplateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Central, versioned contract template library (PRD §26–§29). Only APPROVED/
 * ACTIVE versions may generate production contracts; historical contracts keep
 * the exact version they were generated from.
 */
class ContractTemplateController extends Controller
{
    private function gate(Request $request, bool $write = false): void
    {
        $user = $request->user();
        if ($write) {
            abort_unless($user->hasAnyPermission(['contract.manage_template']) || $user->hasAnyRole(['Procurement Officer', 'System Admin']), 403);

            return;
        }
        abort_unless(
            $user->hasAnyPermission(['contract.manage_template', 'contract.create', 'contract.view', 'contract.view_all'])
            || $user->hasAnyRole(['Procurement Officer']),
            403
        );
    }

    private function tenantGuard(Request $request, ContractTemplate $template): void
    {
        abort_if((int) $template->tenant_id !== (int) $request->user()->tenant_id, 404);
    }

    public function index(Request $request): JsonResponse
    {
        $this->gate($request);

        $templates = ContractTemplate::where('tenant_id', $request->user()->tenant_id)
            ->with(['versions', 'currentVersion', 'contractType'])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $templates]);
    }

    public function show(Request $request, ContractTemplate $template): JsonResponse
    {
        $this->gate($request);
        $this->tenantGuard($request, $template);

        return response()->json(['data' => $template->load(['versions', 'currentVersion', 'contractType'])]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gate($request, true);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contract_type_id' => ['nullable', 'integer', 'exists:contract_types,id'],
            'counterparty_type' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string'],
            'body' => ['required', 'string'],
            'variables' => ['nullable', 'array'],
            'version' => ['nullable', 'string', 'max:20'],
        ]);

        $template = ContractTemplate::create([
            'tenant_id' => $request->user()->tenant_id,
            'contract_type_id' => $data['contract_type_id'] ?? null,
            'name' => $data['name'],
            'counterparty_type' => $data['counterparty_type'] ?? null,
            'description' => $data['description'] ?? null,
            'status' => 'DRAFT',
            'created_by' => $request->user()->id,
        ]);

        $version = ContractTemplateVersion::create([
            'tenant_id' => $request->user()->tenant_id,
            'template_id' => $template->id,
            'version' => $data['version'] ?? 'v1.0',
            'body' => $data['body'],
            'variables' => $data['variables'] ?? null,
            'status' => 'DRAFT',
            'created_by' => $request->user()->id,
        ]);

        AuditLog::record('contract.template_created', [
            'auditable_type' => ContractTemplate::class,
            'auditable_id' => $template->id,
            'new_values' => ['name' => $template->name, 'version' => $version->version],
            'tags' => ['contract', 'template'],
        ]);

        return response()->json(['message' => 'Template created.', 'data' => $template->load('versions')], 201);
    }

    public function storeVersion(Request $request, ContractTemplate $template): JsonResponse
    {
        $this->gate($request, true);
        $this->tenantGuard($request, $template);

        $data = $request->validate([
            'version' => ['required', 'string', 'max:20'],
            'body' => ['required', 'string'],
            'variables' => ['nullable', 'array'],
        ]);

        $version = ContractTemplateVersion::create([
            'tenant_id' => $template->tenant_id,
            'template_id' => $template->id,
            'version' => $data['version'],
            'body' => $data['body'],
            'variables' => $data['variables'] ?? null,
            'status' => 'DRAFT',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Template version added.', 'data' => $version], 201);
    }

    /** Activate a version: it becomes ACTIVE and supersedes the prior active one. */
    public function activateVersion(Request $request, ContractTemplate $template, ContractTemplateVersion $version): JsonResponse
    {
        $this->gate($request, true);
        $this->tenantGuard($request, $template);
        abort_if((int) $version->template_id !== (int) $template->id, 404);

        // Supersede any currently active/approved versions.
        ContractTemplateVersion::where('template_id', $template->id)
            ->whereIn('status', ['ACTIVE', 'APPROVED'])
            ->where('id', '!=', $version->id)
            ->update(['status' => 'SUPERSEDED', 'superseded_at' => now()]);

        $version->update([
            'status' => 'ACTIVE',
            'effective_date' => $version->effective_date ?? now()->toDateString(),
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        $template->update(['status' => 'ACTIVE', 'current_version_id' => $version->id]);

        AuditLog::record('contract.template_activated', [
            'auditable_type' => ContractTemplate::class,
            'auditable_id' => $template->id,
            'new_values' => ['active_version' => $version->version],
            'tags' => ['contract', 'template'],
        ]);

        return response()->json(['message' => 'Template version activated.', 'data' => $template->fresh(['versions', 'currentVersion'])]);
    }
}
