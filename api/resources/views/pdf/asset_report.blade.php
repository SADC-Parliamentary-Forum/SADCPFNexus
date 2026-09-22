<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }} — {{ $run['report_run_id'] }}</title>
    <style>
        @page { margin: 16mm 12mm 18mm 12mm; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #111; }
        h1 { font-size: 16px; margin: 0 0 4px; }
        h2 { font-size: 12px; margin: 14px 0 6px; }
        .muted { color: #555; }
        .meta { margin: 0 0 10px; }
        .badge { display: inline-block; padding: 2px 8px; border: 1px solid #333; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #bbb; padding: 4px 5px; text-align: left; vertical-align: top; }
        th { background: #1F4E79; color: #fff; }
        .totals { margin-top: 10px; }
        .box { border: 1px solid #999; padding: 10px; margin-top: 14px; }
        .sigs { width: 100%; margin-top: 16px; border: 0; }
        .sigs td { border: 0; padding: 18px 8px 0 0; }
        .line { border-top: 1px solid #333; padding-top: 4px; }
        footer { position: fixed; bottom: -8mm; left: 0; right: 0; font-size: 8px; color: #555; }
    </style>
</head>
<body>
    <h1>SADC Parliamentary Forum</h1>
    <p class="meta">
        <strong>{{ $title }}</strong>
        <span class="badge">{{ !empty($run['official']) ? 'Official' : 'Draft' }}</span>
    </p>
    <p class="muted">
        Report ID {{ $run['report_run_id'] }}
        · Template {{ $run['template_version'] }}
        · Data as of {{ $run['data_as_of'] }}
        · Generated {{ $run['generated_at'] }}
        · By {{ $run['generated_by']['name'] ?? '' }}
    </p>
    @if(!empty($scope))
        <p>
            @foreach($scope as $label => $value)
                <strong>{{ ucfirst(str_replace('_', ' ', $label)) }}:</strong> {{ $value }}
                @if(!$loop->last) · @endif
            @endforeach
        </p>
    @endif

    <table>
        <thead>
            <tr>
                @foreach($columns as $column)
                    <th>{{ $column['label'] }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse($data as $row)
                <tr>
                    @foreach($columns as $column)
                        <td>{{ $row[$column['key']] ?? '—' }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ max(1, count($columns)) }}">No assets match these parameters.</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="totals">
        <strong>Summary</strong>
        <p>
            @foreach($totals as $key => $value)
                {{ ucfirst(str_replace('_', ' ', $key)) }}: {{ is_scalar($value) ? $value : json_encode($value) }}
                @if(!$loop->last) · @endif
            @endforeach
        </p>
    </div>

    @if(!empty($exceptions))
        <h2>Exceptions</h2>
        <table>
            <thead>
                <tr>
                    <th>Asset</th>
                    <th>Exception</th>
                </tr>
            </thead>
            <tbody>
                @foreach($exceptions as $exception)
                    <tr>
                        <td>{{ $exception['asset_tag'] ?? $exception['description'] ?? '' }}</td>
                        <td>{{ $exception['reason'] ?? '' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    @if(!empty($declaration))
        <div class="box">
            <p><strong>Declaration</strong></p>
            <p>{{ $declaration }}</p>
            <table class="sigs">
                <tr>
                    <td class="line">Custodian · date</td>
                    <td class="line">Issuing officer · date</td>
                    <td class="line">Witness / approver · date</td>
                </tr>
            </table>
        </div>
    @endif

    <footer>
        Confidential — SADC PF Fixed Asset Register
        · Template {{ $run['template_version'] }}
        · {{ $run['checksum'] ?? $run['report_run_id'] }}
    </footer>
</body>
</html>
