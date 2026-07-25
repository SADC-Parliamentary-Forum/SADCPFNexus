<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementQuote;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use Illuminate\Validation\ValidationException;

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

        $summary = $this->buildStubSummary($tender, $rows, $techW, $finW, $minTech);
        $disclaimer = 'Assistive comparison only. This text must not be treated as an award decision or recommendation. A human officer must assess, recommend, and award.';

        AuditLog::record('procurement.comparison_summary_generated', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'new_values'     => [
                'source'     => 'stub',
                'quote_count'=> count($rows),
                'actor_id'   => $actor->id,
            ],
            'tags'           => 'procurement',
        ]);

        return [
            'tender_id'         => $tender->id,
            'source'            => 'stub',
            'provider'          => (string) ($effective['ai_comparison_provider'] ?? config('procurement.ai_comparison_provider', 'stub')),
            'summary'           => $summary,
            'disclaimer'        => $disclaimer,
            'is_recommendation' => false,
            'auto_award'        => false,
            'weights'           => [
                'technical' => $techW,
                'financial' => $finW,
                'min_technical_score' => $minTech,
            ],
            'bids'              => $rows,
            'generated_at'      => now()->toIso8601String(),
        ];
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
        $lines[] = count($eligible) . ' of ' . count($rows) . ' bid(s) meet the minimum technical score.';

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
