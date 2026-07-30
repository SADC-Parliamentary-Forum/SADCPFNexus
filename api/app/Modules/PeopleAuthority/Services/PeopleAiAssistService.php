<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\PeopleAiSuggestion;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Phase 3 AI assist — suggestions only.
 * NEVER auto-grants access, authority, delegation, signing rights, or privileged roles.
 */
class PeopleAiAssistService
{
    public function __construct(private readonly IdentityAuditService $audit) {}

    public function canAutoGrantAccess(): bool
    {
        return false;
    }

    public function canAutoGrantAuthority(): bool
    {
        return false;
    }

    public function canAutoCreateDelegation(): bool
    {
        return false;
    }

    public function canAutoGrantSigningRights(): bool
    {
        return false;
    }

    public function canAutoAssignPrivilegedRole(): bool
    {
        return false;
    }

    public function suggest(array $data, User $user): PeopleAiSuggestion
    {
        if (! config('people_authority.ai_enabled', true)) {
            throw ValidationException::withMessages(['ai' => 'People AI assist is disabled for this environment.']);
        }

        $kind = $data['kind'] ?? '';
        $allowed = config('people_authority.allowed_suggestion_kinds', []);
        if (! in_array($kind, $allowed, true)) {
            throw ValidationException::withMessages([
                'kind' => 'AI kind is not allowed. Forbidden kinds include granting access, authority, delegation, signing, or privileged roles.',
            ]);
        }

        $provider = (string) config('people_authority.ai_provider', 'stub');
        $suggestion = $provider === 'http'
            ? $this->httpSuggest($kind, $data)
            : $this->stubSuggest($kind, $data);

        $row = PeopleAiSuggestion::create([
            'tenant_id' => $user->tenant_id,
            'kind' => $kind,
            'provider' => $provider,
            'status' => 'pending_confirmation',
            'auto_applied' => false,
            'input_context' => $data['context'] ?? [],
            'suggestion' => $suggestion,
            'created_by' => $user->id,
        ]);

        $this->audit->record($user, 'people.ai.suggested', null, PeopleAiSuggestion::class, $row->id, [
            'kind' => $kind,
            'provider' => $provider,
        ]);

        return $row;
    }

    public function apply(PeopleAiSuggestion $suggestion, array $data, User $user): PeopleAiSuggestion
    {
        if ((int) $suggestion->tenant_id !== (int) $user->tenant_id) {
            throw ValidationException::withMessages(['tenant' => ['Tenant mismatch.']]);
        }

        if ($suggestion->status !== 'pending_confirmation') {
            throw ValidationException::withMessages(['status' => ['Suggestion is not pending confirmation.']]);
        }

        $action = $data['action'] ?? '';
        $forbidden = config('people_authority.forbidden_apply_actions', []);
        if (in_array($action, $forbidden, true)) {
            throw ValidationException::withMessages([
                'action' => 'AI must never grant access, authority, delegation, signing rights, or privileged roles.',
            ]);
        }

        if (empty($data['confirmed'])) {
            throw ValidationException::withMessages([
                'confirmed' => 'Human confirmation is required before any AI suggestion is applied.',
            ]);
        }

        $allowed = config('people_authority.allowed_apply_actions', []);
        if (! in_array($action, $allowed, true)) {
            throw ValidationException::withMessages([
                'action' => 'Only safe attach-note / search-hint / open-review-item actions are permitted after human confirmation.',
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

        $this->audit->record($user, 'people.ai.applied', null, PeopleAiSuggestion::class, $suggestion->id, [
            'action' => $action,
        ]);

        return $suggestion->fresh();
    }

    private function stubSuggest(string $kind, array $data): array
    {
        return match ($kind) {
            'access_recommendation' => [
                'summary' => 'Consider reviewing role fit against position duties.',
                'items' => [
                    ['suggestion' => 'Confirm least-privilege roles for the position (human decision required).'],
                ],
                'auto_grant' => false,
            ],
            'anomalous_privilege' => [
                'summary' => 'Possible privilege concentration detected in context.',
                'items' => [
                    ['suggestion' => 'Open a privilege alert and require human acknowledgement.'],
                ],
                'auto_grant' => false,
            ],
            'nl_org_search' => [
                'summary' => 'Interpret search intent as directory/org keyword filters.',
                'items' => [
                    ['hint' => $data['context']['query'] ?? 'org search'],
                ],
                'auto_grant' => false,
            ],
            'succession_hint' => [
                'summary' => 'Draft succession readiness notes for human review.',
                'items' => [
                    ['suggestion' => 'Mark candidate readiness only after HR confirmation.'],
                ],
                'auto_grant' => false,
            ],
            'skills_gap' => [
                'summary' => 'Possible skills gap relative to job description.',
                'items' => [
                    ['suggestion' => 'Record development actions; do not auto-assign roles.'],
                ],
                'auto_grant' => false,
            ],
            default => ['summary' => 'No-op stub suggestion', 'auto_grant' => false],
        };
    }

    private function httpSuggest(string $kind, array $data): array
    {
        $url = (string) config('people_authority.ai_http_url');
        if ($url === '') {
            return $this->stubSuggest($kind, $data);
        }

        $response = Http::timeout(20)
            ->withToken((string) config('people_authority.ai_http_token'))
            ->acceptJson()
            ->post($url, [
                'kind' => $kind,
                'context' => $data['context'] ?? [],
            ]);

        if (! $response->successful()) {
            return $this->stubSuggest($kind, $data);
        }

        $payload = $response->json() ?? [];
        $payload['auto_grant'] = false;

        return $payload;
    }
}
