<?php

namespace App\Modules\WorkflowEngine\Services;

use App\Models\User;
use App\Models\WorkflowEngine\WorkflowAiSuggestion;
use App\Models\WorkflowEngine\WorkflowAuditEvent;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Phase 3 AI config assist ONLY (PRD §123).
 * NEVER publish, approve, grant authority, skip stage, resolve SoD, sign, or accept exception.
 */
class WorkflowAiAssistService
{
    public function canAutoPublish(): bool
    {
        return false;
    }

    public function canAutoApprove(): bool
    {
        return false;
    }

    public function canAutoGrantAuthority(): bool
    {
        return false;
    }

    public function canAutoSkipStage(): bool
    {
        return false;
    }

    public function canAutoResolveSod(): bool
    {
        return false;
    }

    public function canAutoApplySignature(): bool
    {
        return false;
    }

    public function canAutoAcceptException(): bool
    {
        return false;
    }

    public function suggest(array $data, User $user): WorkflowAiSuggestion
    {
        if (! config('workflow_engine.ai_enabled', true)) {
            throw ValidationException::withMessages(['ai' => 'Workflow AI assist is disabled for this environment.']);
        }

        $kind = $data['kind'] ?? '';
        $allowed = config('workflow_engine.allowed_suggestion_kinds', []);
        if (! in_array($kind, $allowed, true)) {
            throw ValidationException::withMessages([
                'kind' => 'AI kind is not allowed for workflow configuration assist.',
            ]);
        }

        $provider = (string) config('workflow_engine.ai_provider', 'stub');
        $suggestion = $provider === 'http'
            ? $this->httpSuggest($kind, $data)
            : $this->stubSuggest($kind, $data);

        $row = WorkflowAiSuggestion::create([
            'tenant_id' => $user->tenant_id,
            'kind' => $kind,
            'provider' => $provider,
            'status' => 'pending_confirmation',
            'auto_applied' => false,
            'input_context' => $data['context'] ?? [],
            'suggestion' => $suggestion,
            'definition_version_id' => $data['definition_version_id'] ?? null,
            'created_by' => $user->id,
        ]);

        WorkflowAuditEvent::create([
            'tenant_id' => $user->tenant_id,
            'workflow_definition_id' => $data['workflow_definition_id'] ?? null,
            'event_type' => 'WorkflowAiSuggested',
            'actor_user_id' => $user->id,
            'payload' => ['kind' => $kind, 'suggestion_id' => $row->id, 'auto_applied' => false],
            'occurred_at' => now(),
        ]);

        return $row;
    }

    public function apply(WorkflowAiSuggestion $suggestion, array $data, User $user): WorkflowAiSuggestion
    {
        if ((int) $suggestion->tenant_id !== (int) $user->tenant_id) {
            throw ValidationException::withMessages(['tenant' => ['Tenant mismatch.']]);
        }
        if ($suggestion->status !== 'pending_confirmation') {
            throw ValidationException::withMessages(['status' => ['Suggestion is not pending confirmation.']]);
        }

        $action = $data['action'] ?? '';
        $forbidden = config('workflow_engine.forbidden_apply_actions', []);
        if (in_array($action, $forbidden, true)) {
            throw ValidationException::withMessages([
                'action' => 'AI must never publish a workflow, approve a transaction, grant authority, skip a stage, resolve a segregation conflict, apply a signature, or accept an exception.',
            ]);
        }

        if (empty($data['confirmed'])) {
            throw ValidationException::withMessages([
                'confirmed' => 'Human confirmation is required before any AI suggestion is applied to a draft definition.',
            ]);
        }

        $allowed = config('workflow_engine.allowed_apply_actions', []);
        if (! in_array($action, $allowed, true)) {
            throw ValidationException::withMessages([
                'action' => 'Only safe draft-note / suggested-stage-edit / search-hint actions are permitted after human confirmation.',
            ]);
        }

        $suggestion->update([
            'status' => 'applied',
            'applied_action' => $action,
            'apply_note' => $data['note'] ?? null,
            'applied_by' => $user->id,
            'applied_at' => now(),
            'auto_applied' => false,
        ]);

        WorkflowAuditEvent::create([
            'tenant_id' => $user->tenant_id,
            'event_type' => 'WorkflowAiApplied',
            'actor_user_id' => $user->id,
            'payload' => [
                'suggestion_id' => $suggestion->id,
                'action' => $action,
                'auto_applied' => false,
            ],
            'occurred_at' => now(),
        ]);

        return $suggestion->fresh();
    }

    private function stubSuggest(string $kind, array $data): array
    {
        return match ($kind) {
            'config_suggestion' => [
                'summary' => 'Consider adding an explicit completion_rule for multi-actor stages.',
                'items' => [['suggestion' => 'Set completion_rule=all for parallel finance + programme review (human edit required).']],
                'auto_apply' => false,
            ],
            'bottleneck_prediction' => [
                'summary' => 'Stages with high avg cycle time may bottleneck under load.',
                'items' => [['suggestion' => 'Review SLA calendar and routing_strategy on the slowest stage (human decision).']],
                'auto_apply' => false,
            ],
            'approver_resolution_hint' => [
                'summary' => 'Prefer position/authority selectors over specific_user.',
                'items' => [['suggestion' => 'Replace hard-coded user with authority_holder where policy allows.']],
                'auto_apply' => false,
            ],
            'anomaly_detection' => [
                'summary' => 'Unusual return/reject pattern detected in context (informational).',
                'items' => [['suggestion' => 'Open an exception review — AI will not accept exceptions.']],
                'auto_apply' => false,
            ],
            'policy_to_workflow_hint' => [
                'summary' => 'Compare policy text to stage chain for gaps.',
                'items' => [['suggestion' => 'Ensure certify precedes authorise when policy requires dual control.']],
                'auto_apply' => false,
            ],
            'nl_workflow_search' => [
                'summary' => 'Interpret search as workflow name/module filters.',
                'items' => [['hint' => $data['context']['query'] ?? 'workflow search']],
                'auto_apply' => false,
            ],
            default => ['summary' => 'No-op stub', 'auto_apply' => false],
        };
    }

    private function httpSuggest(string $kind, array $data): array
    {
        $url = (string) config('workflow_engine.ai_http_url');
        if ($url === '') {
            return $this->stubSuggest($kind, $data);
        }

        $response = Http::timeout(20)
            ->withToken((string) config('workflow_engine.ai_http_token'))
            ->acceptJson()
            ->post($url, ['kind' => $kind, 'context' => $data['context'] ?? []]);

        if (! $response->successful()) {
            return $this->stubSuggest($kind, $data);
        }

        $payload = $response->json() ?? [];
        $payload['auto_apply'] = false;

        return $payload;
    }
}
