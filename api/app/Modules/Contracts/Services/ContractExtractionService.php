<?php

namespace App\Modules\Contracts\Services;

use Illuminate\Support\Carbon;

/**
 * AI-assisted legacy contract extraction (PRD §103/§129).
 *
 * Proposes structured metadata (counterparty, value, currency, dates, type) from
 * the text of an uploaded/pasted legacy contract. Every suggestion is returned as
 * UNVERIFIED — a human must review and confirm before a legacy contract is
 * created. This service never persists or approves anything (PRD §104).
 */
class ContractExtractionService
{
    private const CURRENCY_SYMBOLS = ['N$' => 'NAD', 'US$' => 'USD', 'R' => 'ZAR', '€' => 'EUR', '£' => 'GBP', '$' => 'USD'];

    private const TYPE_KEYWORDS = [
        'interpreter' => 'Interpreter Agreement',
        'rapporteur' => 'Rapporteur Agreement',
        'resource person' => 'Resource Person Agreement',
        'consultant' => 'Independent Consultant Agreement',
        'professional services' => 'Professional Services Agreement',
        'maintenance' => 'Maintenance Agreement',
        'works' => 'Works Contract',
        'supply' => 'Goods Supply Agreement',
    ];

    /**
     * @return array{unverified: bool, disclaimer: string, suggestions: array<string, array{value: mixed, confidence: string}>, amounts_found: list<array{currency: string, amount: float}>, dates_found: list<string>}
     */
    public function extract(string $text): array
    {
        $amounts = $this->amounts($text);
        $dates = $this->dates($text);

        $suggestions = [];

        // Counterparty — prefer an explicitly labelled name.
        if (preg_match('/(?:Contractor|Consultant|Interpreter|Counterparty|Name|Rapporteur)\s*[:\-]\s*([A-Z][\p{L}\'.\-]+(?:\s+[A-Z][\p{L}\'.\-]+){0,3})/u', $text, $m)) {
            $suggestions['counterparty_name'] = ['value' => trim($m[1]), 'confidence' => 'high'];
        } elseif (preg_match('/\band\s+([A-Z][\p{L}\'.\-]+(?:\s+[A-Z][\p{L}\'.\-]+){1,3})\b/u', $text, $m)) {
            $suggestions['counterparty_name'] = ['value' => trim($m[1]), 'confidence' => 'low'];
        }

        // Value & currency — take the largest money mention as the contract value.
        if ($amounts !== []) {
            $top = collect($amounts)->sortByDesc('amount')->first();
            $suggestions['value'] = ['value' => $top['amount'], 'confidence' => count($amounts) === 1 ? 'high' : 'medium'];
            $suggestions['currency'] = ['value' => $top['currency'], 'confidence' => 'medium'];
        }

        // Signed date (extracted first so it can be excluded from the term).
        $signed = null;
        if (preg_match('/sign(?:ed)?\s+(?:on\s+)?(\d{1,2}\s+\p{L}+\s+\d{4}|\d{4}-\d{2}-\d{2})/iu', $text, $m)) {
            $signed = $this->normaliseDate($m[1]);
            if ($signed) {
                $suggestions['signed_at'] = ['value' => $signed, 'confidence' => 'medium'];
            }
        }

        // Prefer an explicit term ("Duration: X to Y" / "from X to Y").
        $rangePattern = '/(?:Duration|Period|Term|from)\s*[:\-]?\s*(\d{1,2}\s+\p{L}+\s+\d{4}|\d{4}-\d{2}-\d{2})\s*(?:to|until|\-|–|—)\s*(\d{1,2}\s+\p{L}+\s+\d{4}|\d{4}-\d{2}-\d{2})/iu';
        if (preg_match($rangePattern, $text, $rm)) {
            $start = $this->normaliseDate($rm[1]);
            $end = $this->normaliseDate($rm[2]);
            if ($start) {
                $suggestions['start_date'] = ['value' => $start, 'confidence' => 'high'];
            }
            if ($end) {
                $suggestions['end_date'] = ['value' => $end, 'confidence' => 'high'];
            }
        } else {
            // Fall back to earliest/latest of the remaining dates (excluding signed).
            $term = collect($dates)->reject(fn ($d) => $d === $signed)->sort()->values();
            if ($term->isNotEmpty()) {
                $suggestions['start_date'] = ['value' => $term->first(), 'confidence' => $term->count() === 1 ? 'low' : 'medium'];
                if ($term->count() > 1) {
                    $suggestions['end_date'] = ['value' => $term->last(), 'confidence' => 'medium'];
                }
            }
        }

        // Type hint.
        $lower = mb_strtolower($text);
        foreach (self::TYPE_KEYWORDS as $keyword => $typeName) {
            if (str_contains($lower, $keyword)) {
                $suggestions['type_hint'] = ['value' => $typeName, 'confidence' => 'medium'];
                break;
            }
        }

        return [
            'unverified' => true,
            'disclaimer' => 'These values were extracted automatically and are UNVERIFIED. Review and confirm each field before importing the contract.',
            'suggestions' => $suggestions,
            'amounts_found' => $amounts,
            'dates_found' => $dates,
        ];
    }

    /**
     * @return list<array{currency: string, amount: float}>
     */
    private function amounts(string $text): array
    {
        $found = [];
        // e.g. "USD 450", "US$450", "N$ 900", "ZAR 1,000.50", "$450"
        preg_match_all('/(N\$|US\$|R|€|£|\$|USD|NAD|ZAR|EUR|GBP|BWP|ZMW)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/u', $text, $matches, PREG_SET_ORDER);
        foreach ($matches as $match) {
            $code = self::CURRENCY_SYMBOLS[$match[1]] ?? strtoupper($match[1]);
            $amount = (float) str_replace(',', '', $match[2]);
            if ($amount > 0) {
                $found[] = ['currency' => $code, 'amount' => $amount];
            }
        }

        return $found;
    }

    /**
     * @return list<string> ISO (Y-m-d) dates, de-duplicated.
     */
    private function dates(string $text): array
    {
        $iso = [];
        // "7 September 2026" / "07 Sep 2026"
        preg_match_all('/\b(\d{1,2}\s+\p{L}{3,}\s+\d{4})\b/u', $text, $m1);
        // "2026-09-07"
        preg_match_all('/\b(\d{4}-\d{2}-\d{2})\b/', $text, $m2);
        // "07/09/2026"
        preg_match_all('/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/', $text, $m3);

        foreach (array_merge($m1[1] ?? [], $m2[1] ?? [], $m3[1] ?? []) as $raw) {
            $norm = $this->normaliseDate($raw);
            if ($norm && ! in_array($norm, $iso, true)) {
                $iso[] = $norm;
            }
        }

        return $iso;
    }

    private function normaliseDate(string $raw): ?string
    {
        try {
            return Carbon::parse($raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }
}
