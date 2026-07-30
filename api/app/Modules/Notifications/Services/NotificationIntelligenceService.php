<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationAiSuggestion;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDigest;
use App\Models\Notifications\NotificationDigestItem;
use App\Models\Notifications\NotificationPreference;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Phase 3 AI assists — suggestions only; never fabricate / approve / suppress mandatory.
 */
class NotificationIntelligenceService
{
    public function summariseDigest(NotificationDigest $digest): NotificationAiSuggestion
    {
        $items = NotificationDigestItem::query()->where('digest_id', $digest->id)->get();
        $summaries = $items->pluck('summary')->filter()->values()->all();

        // Never invent events — only compress existing item summaries.
        $text = $this->providerSummarise($summaries);

        $digest->update([
            'ai_summary' => $text,
            'ai_summary_provider' => (string) config('notifications.ai_provider', 'stub'),
        ]);

        return NotificationAiSuggestion::create([
            'tenant_id' => $digest->tenant_id,
            'user_id' => $digest->user_id,
            'kind' => 'digest_summary',
            'suggestion' => [
                'digest_id' => $digest->id,
                'summary' => $text,
                'source_item_count' => count($summaries),
                'invented' => false,
            ],
            'status' => 'pending',
            'provider' => (string) config('notifications.ai_provider', 'stub'),
        ]);
    }

    public function suggestPreferences(User $user): NotificationAiSuggestion
    {
        $volume = NotificationChannelDelivery::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('recipient_id', function ($q) use ($user) {
                $q->select('id')->from('notification_recipients')->where('user_id', $user->id);
            })
            ->where('created_at', '>=', now()->subDays(14))
            ->count();

        $suggestion = [
            'message' => $volume > 40
                ? 'You received many optional notices recently. Consider daily digest for operational category.'
                : 'Current preference volume looks healthy.',
            'proposed' => $volume > 40 ? [
                ['category' => 'operational', 'digest_mode' => 'daily'],
            ] : [],
            'requires_confirmation' => true,
            'cannot_disable_mandatory' => true,
        ];

        return NotificationAiSuggestion::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'kind' => 'preference_opt',
            'suggestion' => $suggestion,
            'status' => 'pending',
            'provider' => (string) config('notifications.ai_provider', 'stub'),
        ]);
    }

    public function fatigueAnalysis(int $tenantId): NotificationAiSuggestion
    {
        $byUser = NotificationChannelDelivery::query()
            ->join('notification_recipients as r', 'r.id', '=', 'notification_channel_deliveries.recipient_id')
            ->where('notification_channel_deliveries.tenant_id', $tenantId)
            ->where('notification_channel_deliveries.created_at', '>=', now()->subDays(7))
            ->selectRaw('r.user_id, count(*) as cnt')
            ->groupBy('r.user_id')
            ->orderByDesc('cnt')
            ->limit(20)
            ->get();

        return NotificationAiSuggestion::create([
            'tenant_id' => $tenantId,
            'user_id' => null,
            'kind' => 'fatigue',
            'suggestion' => [
                'window_days' => 7,
                'high_volume_users' => $byUser,
                'admin_hint' => 'Review optional categories and digest policies. Do not suppress mandatory alerts.',
                'cannot_suppress_mandatory' => true,
            ],
            'status' => 'pending',
            'provider' => (string) config('notifications.ai_provider', 'stub'),
        ]);
    }

    public function predictChannel(User $user, array $policy): NotificationAiSuggestion
    {
        // Suggestion only — policy still decides mandatory channels.
        $suggested = ['in_app'];
        if ($policy['email_enabled'] ?? true) {
            $suggested[] = 'email';
        }
        if (($policy['push_enabled'] ?? false) && ! ($policy['mandatory'] ?? false)) {
            $suggested[] = 'push';
        }

        return NotificationAiSuggestion::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'kind' => 'channel_predict',
            'suggestion' => [
                'suggested_channels' => $suggested,
                'advisory_only' => true,
                'policy_mandatory_channels_override' => (bool) ($policy['mandatory'] ?? false),
                'note' => 'Policy decides mandatory channels; AI cannot suppress them.',
            ],
            'status' => 'pending',
            'provider' => (string) config('notifications.ai_provider', 'stub'),
        ]);
    }

    /**
     * Basic NL filter assist → structured inbox filters (no invented results).
     *
     * @return array{filters: array, suggestion_id: int}
     */
    public function nlInboxSearch(User $user, string $query): array
    {
        $q = Str::lower($query);
        $filters = ['filter' => 'all'];

        if (str_contains($q, 'action') || str_contains($q, 'required') || str_contains($q, 'ack')) {
            $filters['filter'] = 'action_required';
        } elseif (str_contains($q, 'unread')) {
            $filters['filter'] = 'unread';
        } elseif (str_contains($q, 'archiv')) {
            $filters['filter'] = 'archived';
        }

        if (preg_match('/\b(workflow|leave|travel|assignment|programme|pif|audit|security)\b/', $q, $m)) {
            $filters['module'] = $m[1] === 'pif' ? 'programme' : $m[1];
        }

        $row = NotificationAiSuggestion::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'kind' => 'nl_search',
            'suggestion' => [
                'query' => $query,
                'filters' => $filters,
                'invents_results' => false,
            ],
            'status' => 'pending',
            'provider' => (string) config('notifications.ai_provider', 'stub'),
        ]);

        return ['filters' => $filters, 'suggestion_id' => $row->id];
    }

    public function confirmSuggestion(NotificationAiSuggestion $suggestion, User $actor, bool $apply = false): NotificationAiSuggestion
    {
        $forbidden = config('notifications.forbidden_ai_actions', []);
        $action = $suggestion->suggestion['action'] ?? null;
        if ($action && in_array($action, $forbidden, true)) {
            abort(422, 'AI action forbidden by policy guards');
        }

        // Preference apply: only optional categories, never mandatory disable.
        if ($apply && $suggestion->kind === 'preference_opt') {
            foreach ($suggestion->suggestion['proposed'] ?? [] as $pref) {
                $category = $pref['category'] ?? null;
                if (! $category || in_array($category, PolicyService::MANDATORY_CATEGORIES, true)) {
                    continue;
                }
                NotificationPreference::updateOrCreate(
                    ['user_id' => $actor->id, 'category' => $category],
                    array_merge(
                        ['tenant_id' => $actor->tenant_id],
                        collect($pref)->only(['digest_mode', 'email_enabled', 'push_enabled', 'in_app_enabled'])->all()
                    )
                );
            }
        }

        // Channel predict / fatigue / digest / nl_search: confirm visibility only — no policy mutation that suppresses mandatory.
        $suggestion->update([
            'status' => 'accepted',
            'human_confirmed' => true,
            'confirmed_by' => $actor->id,
            'confirmed_at' => now(),
        ]);

        return $suggestion->fresh();
    }

    public function guards(): array
    {
        return [
            'ai_enabled' => (bool) config('notifications.ai_enabled', true),
            'provider' => config('notifications.ai_provider', 'stub'),
            'forbidden_actions' => config('notifications.forbidden_ai_actions', []),
            'sms_status' => 'Governance Configuration Pending',
            'whatsapp_status' => 'Governance Configuration Pending',
            'sms_provider' => config('notifications.sms_provider', 'null'),
            'whatsapp_provider' => config('notifications.whatsapp_provider', 'null'),
            'sms_enabled' => false,
            'whatsapp_enabled' => false,
        ];
    }

    /**
     * @param  list<string>  $summaries
     */
    private function providerSummarise(array $summaries): string
    {
        if ($summaries === []) {
            return 'No digest items to summarise.';
        }

        $provider = (string) config('notifications.ai_provider', 'stub');
        if ($provider === 'http' && config('notifications.ai_http_url') && config('notifications.ai_enabled', true)) {
            try {
                $response = Http::withToken((string) config('notifications.ai_http_token', ''))
                    ->timeout(15)
                    ->post((string) config('notifications.ai_http_url'), [
                        'task' => 'digest_summarise',
                        'items' => $summaries,
                        'rules' => ['do_not_invent_events' => true],
                    ]);
                if ($response->successful() && is_string($response->json('summary'))) {
                    return $response->json('summary');
                }
            } catch (\Throwable) {
                // fall through to stub
            }
        }

        $lines = array_slice($summaries, 0, 12);

        return 'Digest of '.count($summaries).' existing notices: '.implode('; ', $lines);
    }
}
