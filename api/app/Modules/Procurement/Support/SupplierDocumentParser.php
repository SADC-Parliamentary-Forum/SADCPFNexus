<?php

namespace App\Modules\Procurement\Support;

use App\Support\Money;

/**
 * Deterministic classification + field extraction from supplier document text.
 */
final class SupplierDocumentParser
{
    public const TYPES = [
        'quotation', 'proforma_invoice', 'invoice', 'credit_note',
        'statement', 'receipt', 'delivery_note', 'other',
    ];

    /**
     * @return array{
     *   document_type: string,
     *   classification_confidence: int,
     *   classification_method: string,
     *   needs_manual_classification: bool,
     *   fields: array<string, mixed>,
     *   lines: list<array<string, mixed>>,
     *   extraction_confidence: int
     * }
     */
    public function parse(string $text, array $extractMeta = []): array
    {
        if (($extractMeta['method'] ?? '') === OcrUnconfiguredAdapter::METHOD || trim($text) === '') {
            return [
                'document_type' => 'other',
                'classification_confidence' => 20,
                'classification_method' => $extractMeta['method'] ?? 'empty',
                'needs_manual_classification' => true,
                'fields' => [],
                'lines' => [],
                'extraction_confidence' => 0,
                'message' => $extractMeta['message'] ?? 'No extractable text. Manual classification required.',
                'ocr_available' => false,
            ];
        }

        $classification = $this->classify($text);
        $fields = $this->extractFields($text);
        $lines = $this->extractLines($text);
        $fields['lines'] = $lines;
        $confidence = $this->score($fields, $lines, $classification);

        return [
            'document_type' => $classification['type'],
            'classification_confidence' => $classification['confidence'],
            'classification_method' => 'heuristic_text',
            'needs_manual_classification' => $classification['confidence'] < 70,
            'fields' => $fields,
            'lines' => $lines,
            'extraction_confidence' => $confidence,
        ];
    }

    /**
     * @return array{type: string, confidence: int}
     */
    public function classify(string $text): array
    {
        $lower = strtolower($text);
        $rules = [
            'credit_note' => ['credit note', 'credit note no'],
            'proforma_invoice' => ['proforma', 'pro-forma', 'pro forma invoice'],
            'quotation' => ['quotation', 'quote no', 'quote number', 'rfq'],
            'delivery_note' => ['delivery note', 'goods received', 'delivery docket'],
            'statement' => ['account statement', 'statement of account'],
            'receipt' => ['official receipt', 'payment receipt'],
            'invoice' => ['tax invoice', 'invoice number', 'invoice no', 'invoice'],
        ];
        foreach ($rules as $type => $needles) {
            foreach ($needles as $needle) {
                if (str_contains($lower, $needle)) {
                    return ['type' => $type, 'confidence' => $type === 'invoice' && str_contains($lower, 'tax invoice') ? 96 : 88];
                }
            }
        }

        return ['type' => 'other', 'confidence' => 40];
    }

    /**
     * @return array<string, mixed>
     */
    public function extractFields(string $text): array
    {
        $fields = [
            'supplier_name' => $this->match($text, '/(?:supplier|from|issued by)\\s*[:\\-]?\\s*([^\\n]+)/i')
                ?? $this->guessSupplierName($text),
            'supplier_email' => $this->match($text, '/[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}/i'),
            'supplier_phone' => $this->match($text, '/(?:tel|phone|cell|mobile)\\s*[:\\-]?\\s*([0-9 +\\-]{7,})/i')
                ?? $this->match($text, '/\\b(0\\d{8,10})\\b/'),
            'supplier_tax_number' => $this->match($text, '/(?:vat|tax)\\s*(?:no|number|#)\\s*[:\\-]?\\s*([A-Z0-9\\-]{5,})/i'),
            'supplier_registration_number' => $this->match($text, '/(?:reg(?:istration)?\\s*(?:no|number))\\s*[:\\-]?\\s*([A-Z0-9\\/\\-]{4,})/i'),
            'document_number' => $this->match($text, '/(?:invoice|quote|quotation|proforma)\\s*(?:number|no\\.?|#)\\s*[:\\-]?\\s*([A-Z0-9\\-\\/]+)/i')
                ?? $this->match($text, '/\\b(INV\\d{3,})\\b/i'),
            'document_date' => $this->parseDate(
                $this->match($text, '/(?:invoice\\s*date|date)\\s*[:\\-]?\\s*(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2})/i')
            ),
            'due_date' => $this->parseDate($this->match($text, '/(?:due\\s*date|payment\\s*due)\\s*[:\\-]?\\s*(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4})/i')),
            'payment_terms' => $this->match($text, '/(?:payment\\s*terms|terms)\\s*[:\\-]?\\s*([^\\n]+)/i'),
            'currency' => $this->detectCurrency($text),
            'currency_ambiguous' => $this->currencyAmbiguous($text),
            'bank_account' => $this->match($text, '/(?:account\\s*(?:no|number)|acc\\s*no)\\s*[:\\-]?\\s*([0-9 \\-]{6,})/i'),
            'bank_name' => $this->match($text, '/(?:bank)\\s*[:\\-]?\\s*([^\\n]+)/i'),
        ];

        $totals = $this->extractTotals($text);
        $fields = array_merge($fields, $totals);

        return $fields;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function extractLines(string $text): array
    {
        $lines = [];
        $pattern = '/^\\s*(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})|[0-9]+\\.[0-9]{2})\\s+([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})|[0-9]+\\.[0-9]{2})\\s*$/m';
        if (preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
            $n = 1;
            foreach ($matches as $row) {
                $desc = trim($row[1]);
                if ($this->isHeaderOrTotal($desc)) {
                    continue;
                }
                $qty = (float) str_replace(',', '', $row[2]);
                $rate = Money::fromCents(Money::toCents($row[3]));
                $total = Money::fromCents(Money::toCents($row[4]));
                $lines[] = [
                    'line_no' => $n++,
                    'source_description' => $desc,
                    'lpo_description' => $desc,
                    'quantity' => $qty,
                    'unit' => 'unit',
                    'unit_price' => $rate,
                    'discount' => null,
                    'vat' => null,
                    'line_total' => $total,
                    'confidence_score' => 95,
                ];
            }
        }

        return $lines;
    }

    /**
     * @param  array<string, mixed>  $fields
     * @param  list<array<string, mixed>>  $lines
     * @param  array{type: string, confidence: int}  $classification
     */
    private function score(array $fields, array $lines, array $classification): int
    {
        $points = 0;
        foreach (['supplier_name', 'document_number', 'document_date', 'grand_total'] as $key) {
            if (! empty($fields[$key])) {
                $points += 15;
            }
        }
        if (count($lines) >= 1) {
            $points += 20;
        }
        if (count($lines) >= 5) {
            $points += 10;
        }

        return min(99, $points + (int) floor($classification['confidence'] / 10));
    }

    private function extractTotals(string $text): array
    {
        $subtotal = $this->matchMoney($text, '/subtotal\\s*[:]?\\s*(?:N\\$|R|USD|NAD)?\\s*([0-9,]+\.\\d{2})/i');
        $vat = $this->matchMoney($text, '/(?:vat|tax)\\s*(?:amount|total)?\\s*[:]?\\s*(?:N\\$|R)?\\s*([0-9,]+\.\\d{2})/i');
        $total = $this->matchMoney($text, '/(?:grand\\s*)?total\\s*[:]?\\s*(?:N\\$|R|USD|NAD)?\\s*([0-9,]+\.\\d{2})/i');
        $vatIdentified = $vat !== null && ! preg_match('/vat\\s+not/i', $text);

        return [
            'subtotal' => $subtotal,
            'vat_amount' => $vatIdentified ? $vat : null,
            'vat_identified' => $vatIdentified,
            'discount_amount' => $this->matchMoney($text, '/discount\\s*[:]?\\s*(?:N\\$)?\\s*([0-9,]+\.\\d{2})/i'),
            'grand_total' => $total ?? $subtotal,
        ];
    }

    private function detectCurrency(string $text): string
    {
        if (preg_match('/\\bN\\$|\\bNAD\\b/i', $text)) {
            return 'NAD';
        }
        if (preg_match('/\\bZAR\\b|\\bR\\s*[0-9]/', $text)) {
            return 'ZAR';
        }
        if (preg_match('/\\bUSD\\b|US\\$/i', $text)) {
            return 'USD';
        }
        if (preg_match('/\\bEUR\\b|€/', $text)) {
            return 'EUR';
        }
        if (preg_match('/\\bGBP\\b|£/', $text)) {
            return 'GBP';
        }

        return 'NAD';
    }

    private function currencyAmbiguous(string $text): bool
    {
        return (bool) preg_match('/\\$(?!\\s)/', $text)
            && ! preg_match('/\\bN\\$|\\bNAD\\b|\\bUSD\\b|US\\$/i', $text);
    }

    private function parseDate(?string $raw): ?string
    {
        if (! $raw) {
            return null;
        }
        $raw = trim($raw);
        foreach (['d/m/Y', 'd-m-Y', 'Y/m/d', 'Y-m-d', 'd/m/y'] as $fmt) {
            $dt = \DateTime::createFromFormat($fmt, $raw);
            if ($dt instanceof \DateTime) {
                return $dt->format('Y-m-d');
            }
        }

        return null;
    }

    private function guessSupplierName(string $text): ?string
    {
        if (preg_match('/\\b(j\\s*v\\s*j[^\\n]{0,40}plumb[^\\n]*)/i', $text, $m)) {
            return trim($m[1]);
        }
        $first = trim(explode("\n", $text)[0] ?? '');
        if ($first !== '' && ! preg_match('/invoice|tax|purchase order/i', $first)) {
            return $first;
        }

        return null;
    }

    private function isHeaderOrTotal(string $desc): bool
    {
        return (bool) preg_match('/^(qty|description|unit|price|total|subtotal|vat|tax|invoice)/i', $desc);
    }

    private function match(string $text, string $pattern): ?string
    {
        if (preg_match($pattern, $text, $m)) {
            return trim($m[1] ?? $m[0]);
        }

        return null;
    }

    private function matchMoney(string $text, string $pattern): ?string
    {
        $raw = $this->match($text, $pattern);
        if ($raw === null) {
            return null;
        }

        return Money::fromCents(Money::toCents($raw));
    }
}
