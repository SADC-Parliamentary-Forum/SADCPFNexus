<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementQuote;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Assistive tender comparison summaries.
 * Never awards, never mutates quote recommendations. Human confirm is audit-only.
 */
class ComparisonSummaryService
{
    public function __construct(private readonly ProcurementSettingsService $settings) {}

    public function summarize(Tender $tender, User $actor): array
    {
        if ((int) $tender->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $tenant = Tenant::findOrFail($tender->tenant_id);
        $effective = $this->settings->effective($tenant);

        if (empty($effective['ai_comparison_enabled'])) {
            throw ValidationException::withMessages([
                'ai_comparison' => 'AI comparison summaries are disabled. Enable them in Procurement Settings.',
            ]);
        }

        if ($tender->isSealed()) {
            throw ValidationException::withMessages([
                'tender' => 'Comparison summaries are available only after bids are opened.',
            ]);
        }

        $quotes = ProcurementQuote::query()
            ->where('procurement_request_id', $tender->procurement_request_id)
            ->where('is_current', true)
            ->orderByDesc('technical_score')
            ->get();

        $techW = (float) ($tender->technical_weight ?? 80);
        $finW = (float) ($tender->financial_weight ?? 20);
        $minTech = (float) ($tender->min_technical_score ?? 70);

        $rows = [];
        foreach ($quotes as $quote) {
            $tech = $quote->technical_score !== null ? (float) $quote->technical_score : null;
            $fin = $quote->financial_score !== null ? (float) $quote->financial_score : null;
            $combined = null;
            if ($tech !== null && $fin !== null) {
                $combined = round(($tech * $techW / 100) + ($fin * $finW / 100), 2);
            }
            $rows[] = [
                'quote_id'         => $quote->id,
                'vendor_name'      => $quote->vendor_name,
                'technical_score'  => $tech,
                'financial_score'  => $fin,
                'quoted_amount'    => $quote->quoted_amount,
                'combined_score'   => $combined,
                'meets_min_tech'   => $tech !== null ? $tech >= $minTech : null,
            ];
        }

        $stubSummary = $this->buildStubSummary($tender, $rows, $techW, $finW, $minTech);
        [$source, $provider, $summary] = $this->resolveSummaryText(
            $stubSummary,
            $tender,
            $rows,
            $techW,
            $finW,
            $minTech,
            (string) ($effective['ai_comparison_provider'] ?? config('procurement.ai_comparison_provider', 'stub'))
        );

        $disclaimer = 'Assistive comparison only. This text must not be treated as an award decision or recommendation. A human officer must assess, recommend, and award. Confirming review never awards a supplier.';

        AuditLog::record('procurement.comparison_summary_generated', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'new_values'     => [
                'source'      => $source,
                'provider'    => $provider,
                'quote_count' => count($rows),
                'actor_id'    => $actor->id,
                'auto_award'  => false,
            ],
            'tags'           => 'procurement',
        ]);

        return [
            'tender_id'              => $tender->id,
            'source'                 => $source,
            'provider'               => $provider,
            'summary'                => $summary,
            'disclaimer'             => $disclaimer,
            'is_recommendation'      => false,
            'auto_award'             => false,
            'requires_human_confirm' => true,
            'weights'                => [
                'technical' => $techW,
                'financial' => $finW,
                'min_technical_score' => $minTech,
            ],
            'bids'                   => $rows,
            'generated_at'           => now()->toIso8601String(),
        ];
    }

    /**
     * Human acknowledgment that an assistive summary was reviewed.
     * Does NOT award, recommend, or change tender status.
     */
    public function confirmReview(Tender $tender, User $actor, string $summaryFingerprint = ''): array
    {
        if ((int) $tender->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        $tenant = Tenant::findOrFail($tender->tenant_id);
        $effective = $this->settings->effective($tenant);

        if (empty($effective['ai_comparison_enabled'])) {
            throw ValidationException::withMessages([
                'ai_comparison' => 'AI comparison summaries are disabled. Enable them in Procurement Settings.',
            ]);
        }

        if ($tender->isSealed()) {
            throw ValidationException::withMessages([
                'tender' => 'Comparison confirm is available only after bids are opened.',
            ]);
        }

        AuditLog::record('procurement.comparison_summary_confirmed', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'new_values'     => [
                'actor_id'             => $actor->id,
                'summary_fingerprint'  => substr($summaryFingerprint, 0, 128),
                'auto_award'           => false,
                'award_mutated'        => false,
                'tender_status'        => $tender->status,
            ],
            'tags'           => 'procurement',
        ]);

        return [
            'tender_id'         => $tender->id,
            'confirmed'         => true,
            'confirmed_by'      => $actor->id,
            'confirmed_at'      => now()->toIso8601String(),
            'is_recommendation' => false,
            'auto_award'        => false,
            'award_mutated'     => false,
            'tender_status'     => $tender->status,
            'message'           => 'Human review of assistive comparison acknowledged. No award action taken.',
        ];
    }

    /**
     * @return array{0: string, 1: string, 2: string} source, provider, summary
     */
    private function resolveSummaryText(
        string $stubSummary,
        Tender $tender,
        array $rows,
        float $techW,
        float $finW,
        float $minTech,
        string $configuredProvider
    ): array {
        $provider = strtolower(trim($configuredProvider));
        if ($provider !== 'llm') {
            return ['stub', 'stub', $stubSummary];
        }

        $endpoint = trim((string) config('procurement.ai_comparison_llm_endpoint', ''));
        $apiKey = trim((string) config('procurement.ai_comparison_llm_api_key', ''));

        if ($endpoint === '' || $apiKey === '') {
            // No fabricated keys — stay on stub when credentials are absent.
            return ['stub', 'stub', $stubSummary];
        }

        try {
            $payload = [
                'task' => 'procurement_comparison_assistive',
                'instruction' => 'Produce a short assistive comparison narrative. Do not recommend or award any supplier. State that a human must decide.',
                'tender' => [
                    'reference' => $tender->reference_number,
                    'title' => $tender->title,
                    'technical_weight' => $techW,
                    'financial_weight' => $finW,
                    'min_technical_score' => $minTech,
                ],
                'bids' => $rows,
                'stub_fallback' => $stubSummary,
            ];

            $response = Http::withToken($apiKey)
                ->timeout(20)
                ->acceptJson()
                ->post($endpoint, $payload);

            if ($response->successful()) {
                $text = $response->json('summary')
                    ?? $response->json('data.summary')
                    ?? $response->json('choices.0.message.content')
                    ?? null;
                if (is_string($text) && trim($text) !== '') {
                    $guarded = trim($text)."\n\nHuman confirmation required. This assistive text never awards a supplier.";

                    return ['llm', 'llm', $guarded];
                }
            }
        } catch (\Throwable) {
            // Fall through to stub — never fail open into an award path.
        }

        return ['stub', 'stub', $stubSummary];
    }

    private function buildStubSummary(Tender $tender, array $rows, float $techW, float $finW, float $minTech): string
    {
        if ($rows === []) {
            return "No current bid submissions are available for tender {$tender->reference_number}. Open evaluation cannot proceed until bids are recorded.";
        }

        $lines = [
            "Deterministic comparison stub for {$tender->reference_number} ({$tender->title}).",
            "Weights: technical {$techW}% / financial {$finW}%; minimum technical score {$minTech}.",
        ];

        $eligible = array_values(array_filter($rows, fn ($r) => ($r['meets_min_tech'] ?? false) === true));
        $lines[] = count($eligible).' of '.count($rows).' bid(s) meet the minimum technical score.';

        usort($rows, function ($a, $b) {
            $ca = $a['combined_score'] ?? -1;
            $cb = $b['combined_score'] ?? -1;

            return $cb <=> $ca;
        });

        foreach (array_slice($rows, 0, 5) as $i => $row) {
            $rank = $i + 1;
            $combined = $row['combined_score'] !== null ? (string) $row['combined_score'] : 'n/a';
            $tech = $row['technical_score'] !== null ? (string) $row['technical_score'] : 'n/a';
            $fin = $row['financial_score'] !== null ? (string) $row['financial_score'] : 'n/a';
            $lines[] = "#{$rank} {$row['vendor_name']}: tech {$tech}, financial {$fin}, combined {$combined}.";
        }

        $lines[] = 'This stub does not recommend or award any supplier.';

        return implode(' ', $lines);
    }
}
