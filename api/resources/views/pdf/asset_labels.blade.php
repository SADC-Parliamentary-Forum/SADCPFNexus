<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 0; }
        body { margin: 0; padding: 0; font-family: DejaVu Sans, sans-serif; color: #111; }
        .sheet { width: {{ $template->page_width_mm }}mm; }
        .grid { width: 100%; border-collapse: collapse; }
        .label {
            width: {{ $template->label_width_mm }}mm;
            height: {{ $template->label_height_mm }}mm;
            padding: 2mm;
            vertical-align: top;
            overflow: hidden;
        }
        .org { font-size: 7pt; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase; color: #1a365d; }
        .property { font-size: 6pt; color: #444; margin-bottom: 1mm; }
        .tag { font-size: 11pt; font-weight: bold; font-family: DejaVu Sans Mono, monospace; }
        .name { font-size: {{ $template->font_pt }}pt; margin-top: 0.5mm; }
        .meta { font-size: 6.5pt; color: #333; }
        .qr { text-align: right; }
        .qr img { width: {{ $template->qr_mm }}mm; height: {{ $template->qr_mm }}mm; }
        table.inner { width: 100%; }
        table.inner td { vertical-align: top; }
    </style>
</head>
<body>
@php
    $perPage = max(1, (int) $template->rows * (int) $template->columns);
    $chunks = array_chunk($labels, $perPage);
@endphp
@foreach ($chunks as $pageIndex => $pageLabels)
    <div class="sheet" style="padding-top: {{ $template->margin_top_mm }}mm; padding-left: {{ $template->margin_left_mm }}mm;@if(!$loop->last) page-break-after: always;@endif">
        <table class="grid">
            @foreach (array_chunk($pageLabels, (int) $template->columns) as $row)
                <tr>
                    @foreach ($row as $label)
                        <td class="label" style="padding-right: {{ $template->h_gap_mm }}mm; padding-bottom: {{ $template->v_gap_mm }}mm;">
                            <div class="org">SADC Parliamentary Forum</div>
                            <div class="property">Property of SADC PF</div>
                            <table class="inner">
                                <tr>
                                    <td>
                                        <div class="tag">{{ $label['asset_tag'] }}</div>
                                        <div class="name">{{ $label['name'] }}</div>
                                        @if($label['model'])
                                            <div class="meta">Model: {{ $label['model'] }}</div>
                                        @endif
                                        @if($label['serial'])
                                            <div class="meta">S/N: {{ $label['serial'] }}</div>
                                        @endif
                                        @if($label['location'])
                                            <div class="meta">Location: {{ $label['location'] }}</div>
                                        @endif
                                        @if($label['custodian'])
                                            <div class="meta">Custodian: {{ $label['custodian'] }}</div>
                                        @endif
                                    </td>
                                    <td class="qr"><img src="data:image/png;base64,{{ $label['qr_base64'] }}" alt="QR"></td>
                                </tr>
                            </table>
                        </td>
                    @endforeach
                </tr>
            @endforeach
        </table>
    </div>
@endforeach
</body>
</html>
