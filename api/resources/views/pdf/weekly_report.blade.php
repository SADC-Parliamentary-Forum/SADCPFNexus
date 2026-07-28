<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $report->reference }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #222; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 13px; margin-top: 18px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        .meta { margin-bottom: 12px; }
        .meta td { padding: 2px 8px 2px 0; }
        .item { margin: 8px 0; padding: 6px; background: #f7f7f7; }
        .item strong { display: block; }
        .muted { color: #666; font-size: 10px; }
        .banner { background: #0b3d2e; color: #fff; padding: 10px 12px; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="banner">
        <strong>SADC PF Nexus — Weekly Summary Report</strong>
    </div>
    <h1>{{ $report->reference }}</h1>
    <table class="meta">
        <tr><td>Type</td><td>{{ $report->report_type }}</td></tr>
        <tr><td>Status</td><td>{{ $report->status }}</td></tr>
        <tr><td>Period</td><td>{{ optional($report->period)->start_date?->toDateString() }} – {{ optional($report->period)->end_date?->toDateString() }}</td></tr>
        @if($report->employee)
            <tr><td>Employee</td><td>{{ $report->employee->name }}</td></tr>
        @endif
        @if($report->department)
            <tr><td>Department</td><td>{{ $report->department->name }}</td></tr>
        @endif
        <tr><td>Version</td><td>{{ $report->version }}</td></tr>
    </table>

    <h2>Report content</h2>
    @forelse($payload['rows'] as $row)
        <div class="item">
            <strong>[{{ strtoupper($row['section']) }}] {{ $row['title'] }}</strong>
            <div>{{ $row['narrative'] }}</div>
            <div class="muted">{{ $row['source'] }} · {{ $row['confidentiality'] }}</div>
        </div>
    @empty
        <p class="muted">No reportable items for this export.</p>
    @endforelse

    @if($report->additional_notes)
        <h2>Additional notes</h2>
        <p>{{ $report->additional_notes }}</p>
    @endif

    <p class="muted" style="margin-top:24px;">
        Generated {{ now()->toDateTimeString() }}. Weekly Summaries reuse source data; this export is not a timesheet, M&amp;E report, or performance appraisal.
    </p>
</body>
</html>
