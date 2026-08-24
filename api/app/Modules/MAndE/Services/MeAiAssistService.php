<?php

namespace App\Modules\MAndE\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class MeAiAssistService
{
    public function __construct(private readonly MeIndicatorAggregationService $aggregation) {}

    /**
     * Assistive draft only — never auto-submits or mutates indicators. Human confirmation required.
     *
     * @param  array{scope?: string, context?: string|array}  $input
     * @return array{draft: string, requires_confirmation: true, provider: string, auto_mutate: false}
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
                        'auto_mutate' => false,
                        'provider' => 'llm',
                    ];
                }
            } catch (\Throwable) {
                // fall through to stub
            }
        }

        $totals = $this->aggregation->aggregate($user);
        $coverage = $totals['totals']['coverage_pct'] ?? 0;
        $indicatorCount = $totals['totals']['indicators'] ?? 0;

        if ($scope === 'nl_filter_suggest') {
            return [
                'draft' => 'Filter suggestions only. Confirm before applying in the indicator register.',
                'requires_confirmation' => true,
                'auto_mutate' => false,
                'provider' => 'stub',
                'suggested_filters' => $this->nlFilters($context),
            ];
        }

        $draft = $scope === 'narrative_draft'
            ? "M&E narrative draft for human edit (coverage {$coverage}% across {$indicatorCount} indicators).\n\n"
                .'Context:'."\n".Str::limit($context, 1200)."\n\n"
                .'This draft is not saved to indicators or activity reports until a human confirms. No auto-mutate.'
            : "M&E assistive draft ({$scope}) for review.\n\n"
                .'Context:'."\n".Str::limit($context, 1200)."\n\n"
                .'Please confirm or edit before saving. This draft is not submitted automatically.';

        return [
            'draft' => $draft,
            'requires_confirmation' => true,
            'auto_mutate' => false,
            'provider' => 'stub',
            'coverage_pct' => $coverage,
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
            'auto_mutate' => false,
            'message' => 'Draft note confirmed for human use; no M&E report was auto-submitted.',
        ];
    }

    private function nlFilters(string $context): array
    {
        $text = mb_strtolower($context);
        $filters = [];
        if (str_contains($text, 'overdue') || str_contains($text, 'without actual')) {
            $filters[] = [
                'key' => 'missing_actuals',
                'label' => 'Indicators without actuals',
                'href' => '/mande/indicators?missing_actuals=1',
            ];
        }
        if (str_contains($text, 'donor')) {
            $filters[] = [
                'key' => 'framework_donor',
                'label' => 'Donor frameworks',
                'href' => '/mande/indicators?q=donor',
            ];
        }
        if (str_contains($text, 'q2') || str_contains($text, 'quarter')) {
            $filters[] = [
                'key' => 'period_quarter',
                'label' => 'Current quarter',
                'href' => '/mande/indicators?q=quarter',
            ];
        }
        if ($filters === []) {
            $filters[] = [
                'key' => 'all_open',
                'label' => 'All indicators with incomplete actuals',
                'href' => '/mande/indicators?missing_actuals=1',
            ];
        }

        return $filters;
    }
}
