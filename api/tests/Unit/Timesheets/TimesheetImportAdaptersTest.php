<?php

namespace Tests\Unit\Timesheets;

use App\Modules\Timesheets\Import\ClockifyDetailedReportAdapter;
use App\Modules\Timesheets\Import\TimesheetFormatDetector;
use App\Modules\Timesheets\Import\TimesheetMidnightSplitter;
use App\Modules\Timesheets\Import\TimesheetRowFingerprint;
use App\Modules\Timesheets\Import\TimesheetSpreadsheetLoader;
use PHPUnit\Framework\TestCase;

class TimesheetImportAdaptersTest extends TestCase
{
    public function test_detects_clockify_detailed_headers(): void
    {
        $headers = ['Project', 'Email', 'Description', 'Activity', 'User', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Duration (decimal)', 'Billable'];
        $detected = TimesheetFormatDetector::detect($headers);
        $this->assertSame(TimesheetFormatDetector::FORMAT_CLOCKIFY, $detected['format']);
        $this->assertGreaterThanOrEqual(6, $detected['recognised']);
    }

    public function test_detects_nexus_template_headers(): void
    {
        $headers = ['employee_email', 'start_date', 'hours', 'activity', 'description', 'project', 'type'];
        $detected = TimesheetFormatDetector::detect($headers);
        $this->assertSame(TimesheetFormatDetector::FORMAT_NEXUS, $detected['format']);
    }

    public function test_fingerprint_is_stable_and_case_insensitive(): void
    {
        $a = TimesheetRowFingerprint::make(1, [
            'user_id' => 9,
            'work_date' => '2025-09-10',
            'start_time' => '08:00',
            'end_time' => '12:00:00',
            'project' => 'SRHR Programme',
            'activity' => 'Policy',
            'description' => 'Briefing  note',
            'hours' => 4,
        ]);
        $b = TimesheetRowFingerprint::make(1, [
            'user_id' => 9,
            'work_date' => '2025-09-10',
            'start_time' => '08:00:00',
            'end_time' => '12:00',
            'project' => 'srhr programme',
            'activity' => 'policy',
            'description' => 'Briefing note',
            'hours' => 4.0,
        ]);
        $this->assertSame($a, $b);
    }

    public function test_midnight_split_creates_two_day_slices(): void
    {
        $slices = TimesheetMidnightSplitter::split([
            'start_date' => '2025-09-10',
            'start_time' => '22:00:00',
            'end_date' => '2025-09-11',
            'end_time' => '03:00:00',
            'description' => 'Overnight',
        ]);
        $this->assertCount(2, $slices);
        $this->assertSame('2025-09-10', $slices[0]['work_date']);
        $this->assertSame(2.0, $slices[0]['hours']);
        $this->assertSame('2025-09-11', $slices[1]['work_date']);
        $this->assertSame(3.0, $slices[1]['hours']);
        $this->assertSame(0, $slices[0]['split_index']);
        $this->assertSame(1, $slices[1]['split_index']);
    }

    public function test_clockify_adapter_maps_email_and_decimal_duration(): void
    {
        $headers = ['Project', 'Description', 'Activity', 'User', 'Email', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Duration (decimal)', 'Billable Amount'];
        $values = ['HIV Programme', 'Drafted memo', 'Writing', 'Ada', 'ada@sadcpf.org', '2025-09-10', '08:00:00', '2025-09-10', '12:00:00', '4.00', '12.50'];
        $row = (new ClockifyDetailedReportAdapter)->mapRow($headers, $values);
        $this->assertSame('ada@sadcpf.org', $row['employee_email']);
        $this->assertSame('4.00', $row['hours']);
        $this->assertSame('HIV Programme', $row['project']);
        $this->assertSame('12.50', $row['billable_amount']);
    }

    public function test_loader_reads_clockify_csv_fixture(): void
    {
        $path = dirname(__DIR__, 2).'/fixtures/timesheets/clockify-detailed-sample.csv';
        $rows = TimesheetSpreadsheetLoader::load($path, 'csv');
        $this->assertGreaterThanOrEqual(3, count($rows));
        $this->assertSame('Project', $rows[0][0]);
        $detected = TimesheetFormatDetector::detect($rows[0]);
        $this->assertSame(TimesheetFormatDetector::FORMAT_CLOCKIFY, $detected['format']);
    }
}
