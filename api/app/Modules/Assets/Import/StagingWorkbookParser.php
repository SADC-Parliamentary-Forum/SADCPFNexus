<?php

namespace App\Modules\Assets\Import;

/**
 * Parses the Nexus Asset Register staging workbook (Asset_Import sheet).
 * Used as assist data only — financials still come from Crystal listings.
 */
final class StagingWorkbookParser
{
    /**
     * @return array{
     *     records: list<array<string, mixed>>,
     *     location_mappings: list<array<string, mixed>>,
     *     issues: list<array<string, mixed>>
     * }
     */
    public function parseFile(string $path, string $originalName): array
    {
        $sheets = SpreadsheetGrid::loadAllSheets($path);
        $byName = [];
        foreach ($sheets as $sheet) {
            $byName[$sheet['sheet']] = $sheet['rows'];
        }

        return [
            'records' => $this->parseAssetImport($byName['Asset_Import'] ?? [], $originalName),
            'location_mappings' => $this->parseKeyedSheet($byName['Location_User_Mapping'] ?? []),
            'issues' => $this->parseKeyedSheet($byName['Validation_Issues'] ?? []),
        ];
    }

    /**
     * @param  list<list<mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function parseAssetImport(array $rows, string $filename): array
    {
        if ($rows === []) {
            return [];
        }
        $header = array_map(fn ($c) => trim((string) $c), $rows[0]);
        $records = [];
        for ($i = 1; $i < count($rows); $i++) {
            $row = $rows[$i];
            $assoc = [];
            foreach ($header as $idx => $key) {
                if ($key === '') {
                    continue;
                }
                $assoc[$key] = $row[$idx] ?? null;
            }
            $tag = strtoupper(trim((string) ($assoc['Asset Tag'] ?? '')));
            if ($tag === '') {
                continue;
            }
            $records[] = [
                'asset_tag' => $tag,
                'asset_name' => $this->nullableString($assoc['Asset Name'] ?? null),
                'model' => $this->nullableString($assoc['Model (Candidate)'] ?? null),
                'serial_number' => $this->nullableString($assoc['Serial Number'] ?? null),
                'legacy_category' => $this->nullableString($assoc['Category'] ?? null),
                'acquisition_date' => $this->excelOrIsoDate($assoc['Acquisition Date'] ?? null),
                'legacy_location' => $this->nullableString($assoc['Location'] ?? null),
                'custodian_candidate' => $this->nullableString($assoc['Responsible User (Candidate)'] ?? null),
                'legacy_description' => $this->nullableString($assoc['Source Description'] ?? null),
                'staging_status' => $this->nullableString($assoc['Validation Status'] ?? null),
                'staging_issues' => $this->nullableString($assoc['Issues'] ?? null),
                'source_filename' => $filename,
                'source_sheet' => 'Asset_Import',
                'source_row_number' => $i + 1,
                'source_kind' => 'staging',
                'raw' => $assoc,
            ];
        }

        return $records;
    }

    /**
     * @param  list<list<mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function parseKeyedSheet(array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $header = array_map(fn ($c) => trim((string) $c), $rows[0]);
        $out = [];
        for ($i = 1; $i < count($rows); $i++) {
            $assoc = [];
            foreach ($header as $idx => $key) {
                if ($key === '') {
                    continue;
                }
                $assoc[$key] = $rows[$i][$idx] ?? null;
            }
            if (count(array_filter($assoc, fn ($v) => $v !== null && $v !== '')) === 0) {
                continue;
            }
            $out[] = $assoc;
        }

        return $out;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    private function excelOrIsoDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            $n = (int) $value;
            $base = new \DateTimeImmutable('1899-12-30');

            return $base->modify('+'.$n.' days')->format('Y-m-d');
        }
        $s = trim((string) $value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $s)) {
            return substr($s, 0, 10);
        }

        return null;
    }
}
