<?php

namespace App\Modules\Assets\Import;

/**
 * Parses Crystal Reports "Asset Schedule in Detail (AMASSTSD01)" Excel exports.
 *
 * Each asset occupies two rows: the Asset ID + financial columns, then
 * "Asset Description:" / "Acquisition Date:". Groups appear as
 * "Location: …" or "Category: …". Totals, titles and filter banners are skipped.
 */
final class CrystalAssetListingParser
{
    public const KIND_LOCATION = 'location_listing';

    public const KIND_CATEGORY = 'category_listing';

    private const TAG_PATTERN = '/^(CE|FF|OE|MV|HS|LB|AS)-\d{4}$/i';

    /**
     * @return array{
     *     kind: string,
     *     sheet: string,
     *     records: list<array<string, mixed>>,
     *     skipped: list<array<string, mixed>>
     * }
     */
    public function parseFile(string $path, string $originalName): array
    {
        $grid = SpreadsheetGrid::loadFirstSheet($path);

        return $this->parseRows($grid['rows'], $originalName, $grid['sheet']);
    }

    /**
     * @param  list<list<mixed>>  $rows
     * @return array{
     *     kind: string,
     *     sheet: string,
     *     records: list<array<string, mixed>>,
     *     skipped: list<array<string, mixed>>
     * }
     */
    public function parseRows(array $rows, string $filename, string $sheet = 'Sheet1'): array
    {
        $kind = $this->detectKind($rows);
        $records = [];
        $skipped = [];
        $group = null;
        $i = 0;
        $n = count($rows);

        while ($i < $n) {
            $row = $rows[$i];
            $a = $this->cellString($row, 0);
            $excelRow = $i + 1;

            if ($a === '' && $this->rowIsEmpty($row)) {
                $i++;

                continue;
            }

            if ($this->isGroupHeader($a, 'Location:')) {
                $group = trim(substr($a, strlen('Location:')));
                $i++;

                continue;
            }
            if ($this->isGroupHeader($a, 'Category:')) {
                $group = trim(substr($a, strlen('Category:')));
                $i++;

                continue;
            }

            if ($this->isSkippable($a, $row)) {
                $skipped[] = [
                    'source_row_number' => $excelRow,
                    'reason' => 'header_footer_or_total',
                    'value' => $a,
                ];
                $i++;

                continue;
            }

            if (preg_match(self::TAG_PATTERN, $a)) {
                $tag = strtoupper($a);
                $detail = ($i + 1 < $n) ? $rows[$i + 1] : [];
                $descRow = $this->cellString($detail, 0);
                $hasDetail = str_starts_with($descRow, 'Asset Description:');
                $description = $hasDetail ? trim(substr($descRow, strlen('Asset Description:'))) : null;
                $acqRaw = $hasDetail ? $this->cellString($detail, 12) : '';
                $acquisition = null;
                if (str_starts_with($acqRaw, 'Acquisition Date:')) {
                    $acquisition = $this->parseUsDate(trim(substr($acqRaw, strlen('Acquisition Date:'))));
                }

                $raw = [];
                foreach ($row as $col => $value) {
                    if ($value !== null && $value !== '') {
                        $raw['c'.$col] = $value;
                    }
                }
                if ($hasDetail) {
                    $raw['detail'] = $descRow;
                    $raw['acquisition_raw'] = $acqRaw;
                }

                $records[] = [
                    'asset_tag' => $tag,
                    'group' => $group,
                    'legacy_location' => $kind === self::KIND_LOCATION ? $group : null,
                    'legacy_category' => $kind === self::KIND_CATEGORY ? $group : null,
                    'legacy_description' => $description,
                    'acquisition_date' => $acquisition,
                    'opening_cost' => $this->money($row, 4),
                    'additions_ytd' => $this->money($row, 7),
                    'adjustment_ytd' => $this->money($row, 9),
                    'disposals_ytd' => $this->money($row, 11),
                    'closing_cost' => $this->money($row, 14),
                    'opening_depreciation' => $this->money($row, 16),
                    'depreciation_ytd' => $this->money($row, 17),
                    'depreciation_on_disposal' => $this->money($row, 18),
                    'accumulated_depreciation' => $this->money($row, 20),
                    'opening_impairment' => $this->money($row, 21),
                    'impairment_ytd' => $this->money($row, 22),
                    'accumulated_impairment' => $this->money($row, 23),
                    'closing_book_value' => $this->money($row, 24),
                    'source_filename' => $filename,
                    'source_sheet' => $sheet,
                    'source_row_number' => $excelRow,
                    'source_kind' => $kind,
                    'raw' => $raw,
                ];

                $i += $hasDetail ? 2 : 1;

                continue;
            }

            $skipped[] = [
                'source_row_number' => $excelRow,
                'reason' => 'unrecognised_row',
                'value' => $a,
            ];
            $i++;
        }

        return [
            'kind' => $kind,
            'sheet' => $sheet,
            'records' => $records,
            'skipped' => $skipped,
        ];
    }

    /**
     * @param  list<list<mixed>>  $rows
     */
    private function detectKind(array $rows): string
    {
        foreach ($rows as $row) {
            $a = $this->cellString($row, 0);
            $b = $this->cellString($row, 5);
            if ($a === 'Group By:' && strcasecmp($b, 'Category') === 0) {
                return self::KIND_CATEGORY;
            }
            if ($a === 'Group By:' && strcasecmp($b, 'Location') === 0) {
                return self::KIND_LOCATION;
            }
            if (str_starts_with($a, 'Category:')) {
                return self::KIND_CATEGORY;
            }
            if (str_starts_with($a, 'Location:')) {
                return self::KIND_LOCATION;
            }
        }

        return self::KIND_LOCATION;
    }

    private function isGroupHeader(string $a, string $prefix): bool
    {
        return str_starts_with($a, $prefix);
    }

    /**
     * @param  list<mixed>  $row
     */
    private function isSkippable(string $a, array $row): bool
    {
        if ($a === 'Asset ID' || $a === 'SADC Parliamentary Forum') {
            return true;
        }
        if (str_starts_with($a, 'Date:') || str_starts_with($a, 'A/M')) {
            return true;
        }
        if (in_array($a, ['For Fiscal Year:', 'As of Period:', 'Group By:', 'From Asset ID:', 'From Cost Center:', 'From Category:', 'From Location:', 'From Resp. Person:'], true)) {
            return true;
        }
        $b = $this->cellString($row, 1);
        if ($a === 'Subtotal :' || $b === 'Subtotal :' || str_contains($a, 'Subtotal')) {
            return true;
        }
        if (str_contains(strtolower($a), 'grand total')) {
            return true;
        }

        return false;
    }

    /**
     * @param  list<mixed>  $row
     */
    private function rowIsEmpty(array $row): bool
    {
        foreach ($row as $value) {
            if ($value !== null && $value !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  list<mixed>  $row
     */
    private function cellString(array $row, int $index): string
    {
        $v = $row[$index] ?? '';
        if ($v instanceof \DateTimeInterface) {
            return $v->format('Y-m-d');
        }

        return trim((string) $v);
    }

    /**
     * @param  list<mixed>  $row
     */
    private function money(array $row, int $index): ?float
    {
        $v = $row[$index] ?? null;
        if ($v === null || $v === '') {
            return null;
        }
        if (is_numeric($v)) {
            return round((float) $v, 2);
        }

        $cleaned = preg_replace('/[^0-9.\-]/', '', (string) $v);
        if ($cleaned === '' || $cleaned === '-' || $cleaned === '.') {
            return null;
        }

        return round((float) $cleaned, 2);
    }

    private function parseUsDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        foreach (['n/j/Y', 'm/d/Y', 'n/j/y', 'Y-m-d'] as $fmt) {
            $dt = \DateTimeImmutable::createFromFormat($fmt, $value);
            if ($dt instanceof \DateTimeImmutable) {
                return $dt->format('Y-m-d');
            }
        }

        return null;
    }
}
