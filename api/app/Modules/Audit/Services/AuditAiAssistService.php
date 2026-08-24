<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditAiSuggestion;
use App\Models\AuditEngagement;
use App\Models\AuditFinding;
use App\Models\AuditWorkpaper;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Phase 3 AI assist — suggestions only. Hard guards prevent auto-issue/close/verify/blame.
 */
class AuditAiAssistService
{
    public function __construct(private readonly AuditEventRecorder $events) {}

    public function canAutoIssueFindings(): bool
    {
        return false;
    }

    public function canAutoCloseFindings(): bool
    {
        return false;
    }

    public function canAutoVerifyImplementation(): bool
    {
        return false;
    }

    public function canAssignBlame(): bool
    {
        return false;
    }

    public function canModifyFinalConclusions(): bool
    {
        return false;
    }

    public function suggest(array $data, User $user): AuditAiSuggestion
    {
        if (! config('audit.ai_enabled', true)) {
            throw ValidationException::withMessages(['ai' => 'AI assist is disabled for this environment.']);
        }

        $kind = $data['kind'] ?? '';
        $allowed = config('audit.allowed_suggestion_kinds', []);
        if (! in_array($kind, $allowed, true)) {
            throw ValidationException::withMessages([
                'kind' => 'AI kind is not allowed. Forbidden kinds include issuing findings, assigning blame, or closing work.',
            ]);
        }

        if (! empty($data['engagement_id'])) {
            AuditEngagement::where('tenant_id', $user->tenant_id)->findOrFail($data['engagement_id']);
        }

        $provider = (string) config('audit.ai_provider', 'stub');
        $suggestion = $provider === 'http'
            ? $this->httpSuggest($kind, $data)
            : $this->stubSuggest($kind, $data, $user);

        $row = AuditAiSuggestion::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $data['engagement_id'] ?? null,
            'kind' => $kind,
            'provider' => $provider,
            'status' => 'pending_confirmation',
            'auto_applied' => false,
            'input_context' => $data['context'] ?? [],
            'suggestion' => $suggestion,
            'created_by' => $user->id,
        ]);

        $this->events->record('audit.ai.suggested', $user, AuditAiSuggestion::class, $row->id, [
            'kind' => $kind,
            'provider' => $provider,
        ]);

        return $row;
    }

    public function apply(AuditAiSuggestion $suggestion, array $data, User $user): AuditAiSuggestion
    {
        $this->assertTenant($suggestion->tenant_id, $user);

        if ($suggestion->status !== 'pending_confirmation') {
            throw ValidationException::withMessages(['status' => 'Suggestion is not pending confirmation.']);
        }

        $action = $data['action'] ?? '';
        $forbidden = config('audit.forbidden_apply_actions', []);
        if (in_array($action, $forbidden, true)) {
            throw ValidationException::withMessages([
                'action' => 'AI must never issue findings, assign blame, approve management responses, close findings, verify implementation, determine misconduct, or modify final conclusions.',
            ]);
        }

        if (empty($data['confirmed'])) {
            throw ValidationException::withMessages([
                'confirmed' => 'Human confirmation is required before any AI suggestion is applied.',
            ]);
        }

        $allowed = config('audit.allowed_apply_actions', []);
        if (! in_array($action, $allowed, true)) {
            throw ValidationException::withMessages([
                'action' => 'Only safe attach-note / draft-text / search-hint actions are permitted after human confirmation.',
            ]);
        }

        $suggestion->update([
            'status' => 'applied',
            'applied_action' => $action,
            'application_note' => $data['note'] ?? null,
            'confirmed_by' => $user->id,
            'confirmed_at' => now(),
            'auto_applied' => false,
        ]);

        $this->events->record('audit.ai.applied', $user, AuditAiSuggestion::class, $suggestion->id, [
            'action' => $action,
        ]);

        return $suggestion->fresh();
    }

    private function stubSuggest(string $kind, array $data, User $user): array
    {
        $context = $data['context'] ?? [];

        return match ($kind) {
            'workpaper_summary' => [
                'summary' => 'Stub summary: review objectives, testing performed, and exceptions noted. Confirm before attaching.',
                'requires_human_confirm' => true,
            ],
            'duplicate_findings' => [
                'candidates' => $this->duplicateHints($user, $context),
                'disclaimer' => 'Suggestions only — does not issue or merge findings.',
                'requires_human_confirm' => true,
            ],
            'root_cause' => [
                'suggestions' => ['policy_gap', 'control_operating', 'capacity'],
                'disclaimer' => 'Root-cause suggestions are advisory; auditor retains judgement.',
                'requires_human_confirm' => true,
            ],
            'draft_report' => [
                'draft_outline' => ['Executive summary', 'Scope', 'Findings', 'Recommendations', 'Appendices'],
                'disclaimer' => 'Draft assistance only — does not finalise or issue the report.',
                'requires_human_confirm' => true,
            ],
            'evidence_index' => [
                'hints' => ['Bank confirmations', 'Sample working papers', 'Policy extracts'],
                'requires_human_confirm' => true,
            ],
            'nl_search' => [
                'suggested_queries' => [
                    'open high findings overdue corrective',
                    'engagements without independence clearance',
                ],
                'requires_human_confirm' => true,
            ],
            'investigation_pack' => $this->investigationPack($user, $data),
            default => ['message' => 'No suggestion', 'requires_human_confirm' => true],
        };
    }

    private function httpSuggest(string $kind, array $data): array
    {
        $url = config('audit.ai_http_url');
        if (! $url) {
            return [
                'message' => 'AUDIT_AI_HTTP_URL not configured; falling back to stub-shaped empty hint.',
                'requires_human_confirm' => true,
            ];
        }

        try {
            $req = Http::timeout(8)->acceptJson();
            $token = config('audit.ai_http_token');
            if ($token) {
                $req = $req->withToken($token);
            }
            $res = $req->post($url, [
                'kind' => $kind,
                'context' => $data['context'] ?? [],
                'guards' => [
                    'auto_issue' => false,
                    'auto_close' => false,
                    'auto_verify' => false,
                    'assign_blame' => false,
                ],
            ]);
            if (! $res->successful()) {
                return ['message' => 'Provider unavailable', 'requires_human_confirm' => true];
            }
            $body = $res->json();
            if (! is_array($body)) {
                return ['message' => 'Invalid provider payload', 'requires_human_confirm' => true];
            }
            $body['requires_human_confirm'] = true;
            unset($body['auto_apply'], $body['issue_finding'], $body['close_finding']);

            return $body;
        } catch (\Throwable $e) {
            Log::warning('audit.ai_http_failed', ['message' => $e->getMessage()]);

            return ['message' => 'Provider error', 'requires_human_confirm' => true];
        }
    }

    private function investigationPack(User $user, array $data): array
    {
        $engagementId = $data['engagement_id'] ?? null;
        $findings = AuditFinding::query()
            ->where('tenant_id', $user->tenant_id)
            ->when($engagementId, fn ($q) => $q->where('engagement_id', $engagementId))
            ->orderByDesc('id')
            ->limit(20)
            ->get(['id', 'title', 'rating', 'status', 'engagement_id']);

        $workpapers = AuditWorkpaper::query()
            ->where('tenant_id', $user->tenant_id)
            ->when($engagementId, fn ($q) => $q->where('engagement_id', $engagementId))
            ->orderByDesc('id')
            ->limit(20)
            ->get(['id', 'reference', 'title', 'status']);

        $openHigh = $findings->filter(function ($finding) {
            return in_array((string) $finding->rating, ['high', 'critical'], true)
                && ! in_array((string) $finding->status, ['closed', 'verified', 'implemented'], true);
        });

        return [
            'engagement_id' => $engagementId,
            'findings' => $findings->toArray(),
            'workpapers' => $workpapers->toArray(),
            'status_counts' => $findings->groupBy('status')->map->count()->all(),
            'open_high_critical' => $openHigh->values()->toArray(),
            'next_questions' => [
                'Which finding still lacks corroborating workpapers?',
                'What management response is overdue, and who owns it?',
                'Is any item ready to recommend for close — without closing it here?',
            ],
            'evidence_gaps' => $workpapers->isEmpty()
                ? ['No workpapers indexed for this engagement yet.']
                : [],
            'checklist' => [
                'Review related findings and workpapers',
                'Record notes after human confirmation',
                'Never close, issue, or verify from this pack',
            ],
            'auto_close' => false,
            'never_auto_closes' => true,
            'disclaimer' => 'Investigation assistant only. Does not close findings, engagements, or corrective actions.',
            'requires_human_confirm' => true,
        ];
    }

    private function duplicateHints(User $user, array $context): array
    {
        $findingId = $context['finding_id'] ?? null;
        $q = AuditFinding::query()->where('tenant_id', $user->tenant_id)->limit(5);
        if ($findingId) {
            $base = AuditFinding::where('tenant_id', $user->tenant_id)->find($findingId);
            if ($base) {
                $q->where('id', '!=', $base->id)->where('title', 'like', '%'.mb_substr($base->title, 0, 24).'%');
            }
        }

        return $q->get(['id', 'title', 'rating', 'status'])->toArray();
    }

    private function assertTenant(int $tenantId, User $user): void
    {
        if ((int) $tenantId !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
