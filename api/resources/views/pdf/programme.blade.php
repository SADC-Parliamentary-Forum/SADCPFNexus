<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: sans-serif; font-size: 11px; }
        h1 { font-size: 16px; }
        h2 { font-size: 13px; border-bottom: 1px solid #333; margin-top: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        td, th { padding: 3px 6px; text-align: left; vertical-align: top; }
        .label { font-weight: bold; width: 35%; }
        .qr { text-align: right; }
        .banner { background: #1d85ed; color: #fff; padding: 10px 12px; margin-bottom: 14px; }
    </style>
</head>
<body>
    <div class="banner"><strong>SADC PF Nexus — Programme Implementation Form</strong></div>
    <table>
        <tr>
            <td>
                <div>Reference: {{ $programme->reference_number }}</div>
                <div>Status: {{ ucwords(str_replace('_', ' ', $programme->status)) }}</div>
            </td>
            <td class="qr"><img src="data:image/png;base64,{{ $qrBase64 }}" width="90" height="90"></td>
        </tr>
    </table>

    <h2>Section A — Requester and Activity Information</h2>
    <table>
        <tr><td class="label">Title</td><td>{{ $programme->title }}</td></tr>
        <tr><td class="label">Created by</td><td>{{ $programme->creator?->name }}</td></tr>
        <tr><td class="label">Responsible Officer</td><td>{{ $programme->responsibleOfficer?->name }}</td></tr>
        <tr><td class="label">Start / End Date</td><td>{{ $programme->start_date }} — {{ $programme->end_date }}</td></tr>
    </table>

    <h2>Section C — Proposed Venue</h2>
    <table>
        <tr><td class="label">Country / City</td><td>{{ $programme->venue_country }} / {{ $programme->venue_city }}</td></tr>
        <tr><td class="label">Proposed hotel</td><td>{{ $programme->venue_proposed_hotel }}</td></tr>
        <tr><td class="label">Accommodation required</td><td>{{ $programme->venue_accommodation_required ? 'Yes (' . $programme->venue_accommodation_count . ')' : 'No' }}</td></tr>
    </table>

    <h2>Section D — Budget and Participant Provisions</h2>
    <table>
        <tr><td class="label">Proposed DSA rate</td><td>{{ $programme->proposed_dsa_rate }}</td></tr>
        <tr><td class="label">Budget availability status</td><td>{{ $programme->budget_availability_status }}</td></tr>
        <tr><td class="label">Finance comments</td><td>{{ $programme->finance_comments }}</td></tr>
    </table>

    <h2>Section M — Conflict of Interest</h2>
    <table>
        <tr><td class="label">Declared</td><td>{{ $programme->conflict_declared ? 'Yes' : 'No' }}</td></tr>
        @if($programme->conflict_declared)
        <tr><td class="label">Details</td><td>{{ $programme->conflict_details }}</td></tr>
        <tr><td class="label">Mitigation</td><td>{{ $programme->conflict_mitigation }}</td></tr>
        <tr><td class="label">Declared by</td><td>{{ $programme->conflictDeclaredBy?->name }} on {{ $programme->conflict_declared_at }}</td></tr>
        @endif
    </table>

    <h2>Attachments</h2>
    <table>
        <tr><th>Type</th><th>Uploaded by</th><th>Date</th></tr>
        @foreach($attachments as $a)
        <tr><td>{{ $a->document_type }}</td><td>{{ $a->uploader?->name }}</td><td>{{ $a->created_at?->format('d M Y H:i') }}</td></tr>
        @endforeach
    </table>

    <h2>Approval History</h2>
    <table>
        <tr><th>Step</th><th>Approver</th><th>Decision</th><th>Date</th><th>Comment</th></tr>
        @foreach($approvalHistory as $h)
        <tr>
            <td>{{ isset($h['step_index']) ? 'Step ' . ((int) $h['step_index'] + 1) : '' }}</td>
            <td>{{ $h['actor']['name'] ?? '' }}</td>
            <td>{{ isset($h['status']) ? ucfirst($h['status']) : ($h['action'] ?? '') }}</td>
            <td>{{ !empty($h['created_at']) ? \Illuminate\Support\Carbon::parse($h['created_at'])->format('d M Y H:i') : '' }}</td>
            <td>{{ $h['comment'] ?? '' }}</td>
        </tr>
        @endforeach
    </table>

    <p>Verify this document: {{ $verifyUrl }}</p>
</body>
</html>
