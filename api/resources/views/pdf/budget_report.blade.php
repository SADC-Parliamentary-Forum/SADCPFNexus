<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #222; }
        h1 { font-size: 16px; margin: 0 0 6px; }
        .banner { background: #1d85ed; color: #fff; padding: 10px 12px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 9px; }
        th { background: #f3f3f3; }
        .muted { color: #666; font-size: 10px; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="banner"><strong>SADC PF Nexus — {{ $title }}</strong></div>
    <p class="muted">Generated {{ $generatedAt }}</p>
    <table>
        <thead>
            <tr>
                @php $headers = count($rows) ? array_keys($rows[0]) : array_keys($totals ?? []); @endphp
                @foreach ($headers as $h)
                    <th>{{ $h }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse ($rows as $row)
                <tr>
                    @foreach ($headers as $h)
                        <td>
                            @php $v = $row[$h] ?? ''; @endphp
                            {{ is_array($v) ? json_encode($v) : $v }}
                        </td>
                    @endforeach
                </tr>
            @empty
                <tr><td colspan="{{ max(count($headers), 1) }}">No rows</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
