<?php

namespace App\Modules\Timesheets\Import;

final class CustomColumnMapAdapter implements TimesheetImportAdapterInterface
{
    public function supports(array $headers): bool
    {
        return true;
    }

    public function mapRow(array $headers, array $values, array $columnMap = []): array
    {
        $index = TimesheetHeaderIndex::index($headers);
        $clockify = new ClockifyDetailedReportAdapter;
        $row = $clockify->mapRow($headers, $values, $columnMap);

        $aliases = [
            'employee_email' => ['employee email', 'staff email', 'user email'],
            'employee_name' => ['employee name', 'staff name', 'name'],
            'employee_id' => ['employee id', 'user_id', 'staff id'],
            'description' => ['notes', 'comment', 'work description'],
            'hours' => ['duration', 'time (hours)', 'decimal hours'],
            'work_date' => ['date', 'work date'],
            'start_date' => ['date', 'work date'],
            'activity' => ['task', 'work'],
            'project' => ['project name', 'charge code'],
        ];
        foreach ($aliases as $field => $names) {
            if (($row[$field] ?? null) === null || $row[$field] === '') {
                $row[$field] = TimesheetHeaderIndex::value($index, $values, $names);
            }
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
        if (empty($row['start_date']) && ! empty($row['work_date'])) {
            $row['start_date'] = $row['work_date'];
        }

        return $row;
    }
}
