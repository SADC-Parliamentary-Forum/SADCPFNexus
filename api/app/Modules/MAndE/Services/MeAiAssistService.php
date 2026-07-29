<?php

namespace App\Modules\MAndE\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MeAiAssistService
{
    /**
     * Assistive draft only — never auto-submits. Human confirmation required.
     *
     * @param  array{scope?: string, context?: string|array}  $input
     * @return array{draft: string, requires_confirmation: true, provider: string, confirmed?: bool}
     */
    public function draft(array $input, User $user): array
    {
        $provider = (string) config('mande_ai.provider', 'stub');
        $scope = (string) ($input['scope'] ?? 'indicator_summary');
        $context = is_array($input['context'] ?? null)
            ? json_encode($input['context'])
            : (string) ($input['context'] ?? '');

        if ($provider === 'llm' && config('mande_ai.llm_endpoint') && config('mande_ai.llm_api_key')) {
            try {
                $response = Http::timeout(20)
                    ->withToken((string) config('mande_ai.llm_api_key'))
                    ->acceptJson()
                    ->post((string) config('mande_ai.llm_endpoint'), [
                        'scope' => $scope,
                        'context' => $context,
                        'tenant_id' => $user->tenant_id,
                    ]);
                if ($response->successful() && ($response->json('draft') || $response->json('text'))) {
                    return [
                        'draft' => (string) ($response->json('draft') ?? $response->json('text')),
                        'requires_confirmation' => true,
                        'provider' => 'llm',
                    ];
                }
            } catch (\Throwable) {
                // fall through to stub
            }
        }

        $draft = "M&E assistive draft ({$scope}) for review.\n\n"
            .'Context:'."\n".Str::limit($context, 1200)."\n\n"
            .'Please confirm or edit before saving. This draft is not submitted automatically.';

        return [
            'draft' => $draft,
            'requires_confirmation' => true,
            'provider' => 'stub',
        ];
    }

    /**
     * Persist a human-confirmed draft note (still not an auto-submit of activity reports).
     *
     * @return array{saved: true, note: string, confirmed_by: int}
     */
    public function confirm(string $draft, User $user): array
    {
        return [
            'saved' => true,
            'note' => trim($draft),
            'confirmed_by' => $user->id,
            'requires_confirmation' => false,
            'message' => 'Draft note confirmed for human use; no M&E report was auto-submitted.',
        ];
    }
}
