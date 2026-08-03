<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 24px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #17202a; }
        h1 { font-size: 16px; margin: 0 0 6px; }
        .meta { color: #5b6770; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #e9eef2; font-weight: 700; }
        th, td { border: 1px solid #bdc7cf; padding: 4px; vertical-align: top; }
        tr:nth-child(even) td { background: #f7f9fa; }
    </style>
</head>
<body>
    <h1>{{ $title }}</h1>
    <div class="meta">Reference: {{ $reference }} | Generated: {{ $generatedAt }}</div>
    <table>
        @foreach ($rows as $index => $row)
            <tr>
                @foreach ($row as $cell)
                    @if ($index === 0)
                        <th>{{ $cell }}</th>
                    @else
                        <td>{{ $cell }}</td>
                    @endif
                @endforeach
            </tr>
        @endforeach
    </table>
</body>
</html>
