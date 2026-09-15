<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $handover->reference }} — Custody certificate</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        h2 { font-size: 13px; margin: 18px 0 8px; }
        .muted { color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f3f3f3; }
        .box { border: 1px solid #ddd; padding: 10px; margin-top: 12px; }
    </style>
</head>
<body>
    <h1>Asset handover certificate</h1>
    <p class="muted">{{ $handover->reference }} · {{ strtoupper($handover->type) }} · {{ $handover->status }}</p>
    <p><strong>Owner:</strong> {{ $owner }}</p>
    <p><strong>Issued:</strong> {{ optional($handover->issued_at)->toDateTimeString() }}</p>
    <p><strong>Signed:</strong> {{ optional($handover->accepted_at)->toDateTimeString() }}</p>
    <p><strong>Prepared by:</strong> {{ $handover->createdBy->name ?? $actor->name }}</p>
    <p><strong>Custodian:</strong>
        @if($handover->toUser)
            {{ $handover->toUser->name }}
        @elseif($handover->toLocation)
            {{ $handover->toLocation->name }} ({{ $handover->custody_target_type }})
        @else
            {{ $handover->custody_target_type }}
        @endif
    </p>

    <h2>Assets</h2>
    <table>
        <thead>
            <tr>
                <th>Asset number</th>
                <th>Name</th>
                <th>Condition at issue</th>
                <th>Line status</th>
            </tr>
        </thead>
        <tbody>
            @foreach($handover->lines as $line)
                <tr>
                    <td>{{ $line->snapshot_tag }}</td>
                    <td>{{ $line->snapshot_name }}</td>
                    <td>{{ $line->condition_out }}</td>
                    <td>{{ $line->line_status }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="box">
        <p><strong>Declaration {{ $declaration->version_key }}</strong></p>
        <p>{{ $declaration->statement }}</p>
    </div>
</body>
</html>
