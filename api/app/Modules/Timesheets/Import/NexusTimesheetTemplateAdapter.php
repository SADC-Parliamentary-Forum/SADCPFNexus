<?php

namespace App\Modules\Timesheets\Import;

final class NexusTimesheetTemplateAdapter implements TimesheetImportAdapterInterface
{
    public function supports(array $headers): bool
    {
        $detected = TimesheetFormatDetector::detect($headers);

        return $detected['format'] === TimesheetFormatDetector::FORMAT_NEXUS;
    }

    public function mapRow(array $headers, array $values, array $columnMap = []): array
    {
        $index = TimesheetHeaderIndex::index($headers);
        $row = [];
        foreach (NexusTimesheetTemplateWorkbook::HEADERS as $field) {
            $row[$field] = TimesheetHeaderIndex::value($index, $values, [$field]);
        }
        foreach ($columnMap as $header => $field) {
            if ($field === '') {
                continue;
            }
            $value = TimesheetHeaderIndex::value($index, $values, [$header]);
            if ($value !== null) {
                $row[$field] = $value;
            }
        }
        if (($row['source'] ?? null) === null || $row['source'] === '') {
            $row['source'] = 'Nexus template';
        }

        return $row;
    }
}
