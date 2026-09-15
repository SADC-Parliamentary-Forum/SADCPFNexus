<?php

namespace App\Modules\Timesheets\Import;

final class ClockifyDetailedReportAdapter implements TimesheetImportAdapterInterface
{
    public function supports(array $headers): bool
    {
        $detected = TimesheetFormatDetector::detect($headers);

        return $detected['format'] === TimesheetFormatDetector::FORMAT_CLOCKIFY;
    }

    public function mapRow(array $headers, array $values, array $columnMap = []): array
    {
        $index = TimesheetHeaderIndex::index($headers);
        $get = fn (array $aliases) => TimesheetHeaderIndex::value($index, $values, $aliases);

        foreach ($columnMap as $header => $field) {
            $value = TimesheetHeaderIndex::value($index, $values, [$header]);
            if ($value !== null && $field !== '') {
                // applied below after defaults
            }
        }

        $row = [
            'employee_id' => $get(['employee_id', 'user id']),
            'employee_email' => $get(['email']),
            'employee_name' => $get(['user']),
            'project' => $get(['project']),
            'workplan_item' => $get(['workplan_item', 'workplan item']),
            'activity' => $get(['activity', 'task']),
            'description' => $get(['description']),
            'department' => $get(['department']),
            'programme' => $get(['programme', 'group']),
            'funding_source' => $get(['funding_source', 'funding source']),
            'donor' => $get(['donor']),
            'location' => $get(['location']),
            'tags' => $get(['tags']),
            'start_date' => $get(['start date', 'start_date']),
            'start_time' => $get(['start time', 'start_time']),
            'end_date' => $get(['end date', 'end_date']),
            'end_time' => $get(['end time', 'end_time']),
            'hours' => $get(['duration (decimal)', 'hours']),
            'duration_h' => $get(['duration (h)']),
            'type' => $get(['type']) ?: 'Normal',
            'source' => 'Clockify',
            'external_reference' => $get(['external_reference', 'id']),
            'original_created_date' => $get(['date of creation', 'original_created_date']),
            'billable' => $get(['billable']),
            'billable_rate' => $get(['billable rate']),
            'billable_amount' => $get(['billable amount']),
            'group' => $get(['group']),
        ];

        foreach ($columnMap as $header => $field) {
            if ($field === '') {
                continue;
            }
            $value = TimesheetHeaderIndex::value($index, $values, [$header]);
            if ($value !== null) {
                $row[$field] = $value;
            }
        }

        return $row;
    }
}
