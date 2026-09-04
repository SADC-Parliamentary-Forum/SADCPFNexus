<?php

namespace App\Modules\Assets\Services;

use App\Models\AssetImportBatch;
use App\Models\AssetImportStaging;

class AssetReconciliationReportService
{
    public function build(AssetImportBatch $batch): array
    {
        $rows = AssetImportStaging::query()->where('import_batch_id', $batch->id)->get();
        $equation = app(AssetImportService::class)->equation($batch);

        return [
            'title' => 'SADC PF ASSET REGISTER MIGRATION RECONCILIATION REPORT',
            'batch_number' => $batch->batch_number,
            'source_files' => $batch->filenames,
            'file_hashes' => $batch->file_hashes,
            'source_row_count' => $batch->source_row_count,
            'parsed_row_count' => $batch->parsed_row_count,
            'unique_legacy_asset_tags' => $equation['unique_source_tags'],
            'created' => $equation['created'],
            'updated' => $batch->updated_count,
            'unchanged' => $batch->unchanged_count,
            'excluded' => $equation['approved_exclusions'],
            'duplicate_records' => $batch->duplicate_count,
            'missing_asset_numbers' => $rows->filter(fn ($r) => empty($r->asset_tag))->count(),
            'missing_serial_numbers' => $rows->filter(fn ($r) => empty($r->serial_number))->count(),
            'missing_locations' => $rows->filter(fn ($r) => empty($r->legacy_location) && empty($r->location_id))->count(),
            'unmapped_custodians' => $rows->filter(fn ($r) => empty($r->custodian_user_id) && empty($r->custodian_department_id))->count(),
            'financial_discrepancies' => $batch->discrepancies()->count(),
            'qr_codes_generated' => $batch->imported_count + $batch->updated_count + $batch->unchanged_count,
            'labels_generated' => 0,
            'awaiting_physical_verification' => $equation['created'] + $equation['matched_existing'],
            'blocking_remaining' => $rows->where('blocking', true)->count(),
            'equation' => $equation,
            'status' => $equation['balanced'] ? ($equation['outstanding_exceptions'] === 0 && $batch->status === 'committed' ? 'COMPLETE' : 'INCOMPLETE') : 'FAILED / INCOMPLETE',
        ];
    }

    public function toMarkdown(array $report): string
    {
        $eq = $report['equation'];
        $files = '';
        foreach ($report['source_files'] ?? [] as $role => $name) {
            $hash = $report['file_hashes'][$role] ?? '';
            $files .= "- {$role}: {$name} (`{$hash}`)\n";
        }

        return <<<MD
# {$report['title']}

## A. Source files
{$files}
## B. Import Batch ID
`{$report['batch_number']}`

## C–R. Population

| Metric | Count |
| --- | ---: |
| Source row count | {$report['source_row_count']} |
| Parsed rows | {$report['parsed_row_count']} |
| Unique legacy Asset Tags | {$report['unique_legacy_asset_tags']} |
| Nexus assets created | {$report['created']} |
| Existing Nexus assets updated | {$report['updated']} |
| Assets unchanged | {$report['unchanged']} |
| Records excluded | {$report['excluded']} |
| Duplicate records | {$report['duplicate_records']} |
| Missing asset numbers | {$report['missing_asset_numbers']} |
| Missing serial numbers | {$report['missing_serial_numbers']} |
| Missing locations | {$report['missing_locations']} |
| Unmapped custodians | {$report['unmapped_custodians']} |
| Financial discrepancies | {$report['financial_discrepancies']} |
| QR codes generated | {$report['qr_codes_generated']} |
| Labels generated | {$report['labels_generated']} |
| Awaiting physical verification | {$report['awaiting_physical_verification']} |
| Blocking issues remaining | {$report['blocking_remaining']} |

## Identity equation

```
{$eq['unique_source_tags']} unique source tags
= {$eq['created']} created
+ {$eq['matched_existing']} matched existing
+ {$eq['approved_exclusions']} approved exclusions
+ {$eq['outstanding_exceptions']} outstanding exceptions
= {$eq['explained']} explained
```

**Balanced:** {$this->yn($eq['balanced'])}
**Migration status:** {$report['status']}
MD;
    }

    public function writeMarkdown(array $report, string $relativePath = 'docs/validation/asset-register-migration-reconciliation.md'): string
    {
        $markdown = $this->toMarkdown($report);
        $path = base_path('../'.$relativePath);
        if (! is_dir(dirname($path))) {
            @mkdir(dirname($path), 0775, true);
        }
        file_put_contents($path, $markdown);

        return $path;
    }

    private function yn(bool $value): string
    {
        return $value ? 'yes' : 'no';
    }
}
