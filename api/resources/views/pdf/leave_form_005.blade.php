<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FORM-005 Leave Application - {{ $leave->reference_number }}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10.5px; color: #111; margin: 0; padding: 0; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        h2 { font-size: 12px; margin: 14px 0 6px; border-bottom: 1px solid #333; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 7px; }
        th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; font-weight: bold; }
        .meta { color: #555; margin: 0 0 10px; }
        .right { text-align: right; }
        .muted { color: #666; }
        .no-border td { border: 0; padding: 2px 0; }
        .signature-box { height: 38px; }

        /* ── Letterhead ── */
        .lh-header { border-bottom: 3px solid #1d85ed; padding: 16px 24px 12px; display: block; }
        .lh-org-name { font-size: 15px; font-weight: bold; color: #0f1f3d; margin: 0; }
        .lh-org-abbr { font-size: 10px; font-weight: bold; color: #1d85ed; text-transform: uppercase; letter-spacing: 0.06em; }
        .lh-tagline { font-size: 9px; color: #6b7280; font-style: italic; }
        .clearfix::after { content: ""; display: block; clear: both; }
        .lh-banner { background: #1d85ed; padding: 6px 24px; color: #fff; font-size: 10px; }
        .lh-banner-left { float: left; }
        .lh-banner-right { float: right; font-weight: bold; font-family: monospace; }
        .body-section { padding: 14px 24px 0; }
    </style>
</head>
<body>
@php
    $fmt = fn ($date) => $date ? \Carbon\Carbon::parse($date)->toDateString() : '-';
    $text = fn ($value) => filled($value) ? $value : '-';
    $totalCalendar = (float) $leave->segments->sum('calendar_days');
    $totalWorking = (float) $leave->segments->sum('amount_requested');
@endphp

{{-- Letterhead Header --}}
<div class="lh-header clearfix">
    <div style="float:left; width:44px; height:44px; background:#1d85ed; border-radius:6px; text-align:center; line-height:44px; color:#fff; font-weight:900; font-size:14px; margin-right:14px;">
        {{ strtoupper(substr($letterhead['org_abbreviation'] ?? 'S', 0, 2)) }}
    </div>
    <div style="float:left;">
        <p class="lh-org-name">{{ $letterhead['org_name'] ?? 'SADC Parliamentary Forum' }}</p>
        <p class="lh-org-abbr">{{ $letterhead['org_abbreviation'] ?? 'SADC-PF' }}</p>
        @if(!empty($letterhead['letterhead_tagline']))
            <p class="lh-tagline">{{ $letterhead['letterhead_tagline'] }}</p>
        @endif
    </div>
</div>

{{-- Blue Banner --}}
<div class="lh-banner clearfix">
    <span class="lh-banner-left">FORM-005 Leave Application</span>
    <span class="lh-banner-right">Ref: {{ $leave->reference_number }}</span>
</div>

<div class="body-section">
<h1>SADC PF FORM-005 Leave Application</h1>
<p class="meta">
    Reference: <strong>{{ $leave->reference_number }}</strong>
    | Status: {{ $leave->status }}
    | Generated: {{ $generatedAt->toDateTimeString() }}
</p>

<table>
    <tr>
        <th>Employee</th>
        <td>{{ $leave->requester?->name ?? '-' }}</td>
        <th>Employee number</th>
        <td>{{ $leave->requester?->employee_number ?? '-' }}</td>
    </tr>
    <tr>
        <th>Position</th>
        <td>{{ $leave->requester?->job_title ?? $leave->requester?->position?->title ?? '-' }}</td>
        <th>Department</th>
        <td>{{ $leave->requester?->department?->name ?? '-' }}</td>
    </tr>
    <tr>
        <th>Policy version</th>
        <td>{{ $leave->policyVersion?->name ?? '-' }} {{ $leave->policyVersion?->version ? '(' . $leave->policyVersion->version . ')' : '' }}</td>
        <th>Application date</th>
        <td>{{ $fmt($leave->created_at) }}</td>
    </tr>
</table>

<h2>Part A - Applicant</h2>
<table>
    <tr>
        <th>Reason for leave</th>
        <td colspan="3">{{ $text($leave->reason) }}</td>
    </tr>
    <tr>
        <th>Leave address</th>
        <td>{{ $text($leave->leave_address) }}</td>
        <th>Contact number</th>
        <td>{{ $text($leave->contact_number) }}</td>
    </tr>
    <tr>
        <th>Emergency contact</th>
        <td>{{ $text($leave->emergency_contact) }}</td>
        <th>Handover</th>
        <td>{{ $leave->handover_required ? 'Required' : 'Not recorded' }}</td>
    </tr>
</table>

<table>
    <thead>
        <tr>
            <th>Leave type</th>
            <th>From</th>
            <th>To and including</th>
            <th class="right">Calendar days</th>
            <th class="right">Working days</th>
            <th class="right">Public holidays excluded</th>
            <th class="right">Balance before</th>
            <th class="right">Balance after</th>
            <th>Source / document status</th>
        </tr>
    </thead>
    <tbody>
        @foreach($leave->segments as $segment)
            <tr>
                <td>{{ $segment->type?->name ?? ucfirst(str_replace('_', ' ', $segment->leave_type)) }}</td>
                <td>{{ $fmt($segment->start_date) }}</td>
                <td>{{ $fmt($segment->end_date) }}</td>
                <td class="right">{{ number_format((float) $segment->calendar_days, 2) }}</td>
                <td class="right">{{ number_format((float) $segment->amount_requested, 2) }}</td>
                <td class="right">{{ number_format((float) $segment->public_holidays_excluded, 2) }}</td>
                <td class="right">{{ number_format((float) $segment->balance_before, 2) }}</td>
                <td class="right">{{ number_format((float) $segment->balance_after, 2) }}</td>
                <td>
                    @if($segment->source_type)
                        Source: {{ class_basename($segment->source_type) }} #{{ $segment->source_id ?? '-' }}<br>
                    @endif
                    Document status: {{ $segment->document_status ?? 'not recorded' }}
                </td>
            </tr>
        @endforeach
        <tr>
            <th colspan="3">Total application</th>
            <th class="right">{{ number_format($totalCalendar, 2) }}</th>
            <th class="right">{{ number_format($totalWorking, 2) }}</th>
            <th colspan="4"></th>
        </tr>
    </tbody>
</table>

<h2>Head of Department Recommendation</h2>
<table>
    <tr>
        <th>Status</th>
        <td>{{ $leave->recommendation_status ?? '-' }}</td>
        <th>Recommended by</th>
        <td>{{ $leave->recommender?->name ?? '-' }}</td>
    </tr>
    <tr>
        <th>Date</th>
        <td>{{ $fmt($leave->recommended_at) }}</td>
        <th>Comments</th>
        <td>{{ $text($leave->recommendation_comments) }}</td>
    </tr>
</table>

<h2>Part B - Administration Certification</h2>
<table>
    <thead>
        <tr>
            <th>Segment</th>
            <th class="right">Accrued / balance before</th>
            <th class="right">Days now taken</th>
            <th class="right">Balance after</th>
            <th class="right">Eligible days</th>
            <th>Certification</th>
            <th>Documents</th>
        </tr>
    </thead>
    <tbody>
        @foreach($leave->segments as $segment)
            <tr>
                <td>{{ $segment->type?->name ?? ucfirst(str_replace('_', ' ', $segment->leave_type)) }}</td>
                <td class="right">{{ number_format((float) $segment->balance_before, 2) }}</td>
                <td class="right">{{ number_format((float) $segment->amount_requested, 2) }}</td>
                <td class="right">{{ number_format((float) $segment->balance_after, 2) }}</td>
                <td class="right">{{ $segment->eligible_days === null ? '-' : number_format((float) $segment->eligible_days, 2) }}</td>
                <td>{{ $segment->certification_status ?? '-' }}</td>
                <td>{{ $segment->document_status ?? 'not recorded' }}</td>
            </tr>
        @endforeach
    </tbody>
</table>
<table>
    <tr>
        <th>Certified by</th>
        <td>{{ $leave->certifier?->name ?? '-' }}</td>
        <th>Date</th>
        <td>{{ $fmt($leave->certified_at) }}</td>
    </tr>
    <tr>
        <th>Administration remarks</th>
        <td colspan="3">{{ $text($leave->certification_comments) }}</td>
    </tr>
</table>

<h2>Part C - Head of Institution Authorisation</h2>
<table>
    <tr>
        <th>Decision</th>
        <td>{{ in_array($leave->status, ['approved', 'rejected'], true) ? ucfirst($leave->status) : 'Pending' }}</td>
        <th>Authorised by</th>
        <td>{{ $leave->approver?->name ?? '-' }}</td>
    </tr>
    <tr>
        <th>Date</th>
        <td>{{ $fmt($leave->approved_at) }}</td>
        <th>Remarks</th>
        <td>{{ $leave->status === 'rejected' ? $text($leave->rejection_reason) : '-' }}</td>
    </tr>
    <tr>
        <th>Signature / digital action</th>
        <td colspan="3" class="signature-box">
            {{ $leave->approved_at ? 'Digital action recorded in Nexus audit trail.' : 'Pending digital action.' }}
        </td>
    </tr>
</table>

<h2>Workflow History</h2>
<table>
    <thead>
        <tr>
            <th>Date</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Step</th>
            <th>Comment</th>
        </tr>
    </thead>
    <tbody>
        @forelse($leave->approvalRequest?->history ?? [] as $event)
            <tr>
                <td>{{ $fmt($event->created_at) }}</td>
                <td>{{ $event->user?->name ?? '-' }}</td>
                <td>{{ $event->action }}</td>
                <td>{{ $event->step_index ?? '-' }}</td>
                <td>{{ $text($event->comment) }}</td>
            </tr>
        @empty
            <tr>
                <td colspan="5" class="muted">No workflow history recorded.</td>
            </tr>
        @endforelse
    </tbody>
</table>

<p class="muted">
    Sensitive medical details are intentionally excluded. This document records dates, leave category,
    entitlement certification, workflow actions, and document compliance status only.
</p>
</div>
</body>
</html>
