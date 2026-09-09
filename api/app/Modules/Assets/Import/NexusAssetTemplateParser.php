<?php

namespace App\Modules\Assets\Import;

/**
 * Future-facing clean Nexus template (header row matching field names).
 */
final class NexusAssetTemplateParser
{
    public const REQUIRED_HEADERS = ['asset_tag', 'asset_name'];

    /** Snake_case headers the bulk-upload workbook must use (first row of the Assets sheet). */
    public const HEADERS = [
        'asset_tag',
        'asset_name',
        'serial_number',
        'make',
        'model',
        'legacy_category',
        'acquisition_date',
        'original_cost',
        'current_book_value',
        'accumulated_depreciation',
        'currency',
        'funding_source',
        'legacy_location',
        'custodian_candidate',
        'legacy_description',
    ];

    /**
     * @return list<array<string, mixed>>
     */
    public function parseFile(string $path, string $originalName): array
    {
        $grid = SpreadsheetGrid::loadFirstSheet($path);

        return $this->parseRows($grid['rows'], $originalName, $grid['sheet']);
    }

    /**
     * @param  list<list<mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public function parseRows(array $rows, string $filename, string $sheet = 'Sheet1'): array
    {
        if ($rows === []) {
            return [];
        }
        $header = array_map(fn ($c) => strtolower(trim((string) $c)), $rows[0]);
        foreach (self::REQUIRED_HEADERS as $required) {
            if (! in_array($required, $header, true)) {
                throw new \InvalidArgumentException('Missing required column: '.$required);
            }
        }
        $records = [];
        for ($i = 1; $i < count($rows); $i++) {
            $assoc = [];
            foreach ($header as $idx => $key) {
                if ($key === '') {
                    continue;
                }
                $assoc[$key] = $rows[$i][$idx] ?? null;
            }
            $hasValue = false;
            foreach ($assoc as $value) {
                if (trim((string) ($value ?? '')) !== '') {
                    $hasValue = true;
                    break;
                }
            }
            if (! $hasValue) {
                continue;
            }
            $tag = strtoupper(trim((string) ($assoc['asset_tag'] ?? '')));
            $assoc['asset_tag'] = $tag !== '' ? $tag : null;
            $assoc['legacy_description'] = $assoc['legacy_description'] ?? ($assoc['asset_name'] ?? null);
            $assoc['source_filename'] = $filename;
            $assoc['source_sheet'] = $sheet;
            $assoc['source_row_number'] = $i + 1;
            $assoc['source_kind'] = 'template';
            $assoc['raw'] = $assoc;
            $records[] = $assoc;
        }

        return $records;
    }
}
