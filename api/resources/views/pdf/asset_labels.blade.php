<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 0; }
        body { margin: 0; padding: 0; font-family: DejaVu Sans, sans-serif; color: #111; }
        .sheet { width: {{ $template->page_width_mm }}mm; }
        .grid { width: 100%; border-collapse: collapse; }
        .cell {
            width: {{ $template->label_width_mm }}mm;
            padding: 0;
            padding-right: {{ $template->h_gap_mm }}mm;
            padding-bottom: {{ $template->v_gap_mm }}mm;
            vertical-align: top;
        }
        .label {
            position: relative;
            width: {{ $template->label_width_mm }}mm;
            height: {{ $template->label_height_mm }}mm;
            overflow: hidden;
        }
        .field { position: absolute; overflow: hidden; line-height: 1.15; }
        .org { font-size: 7pt; font-weight: bold; letter-spacing: 0.04em; text-transform: uppercase; color: #1a365d; }
        .notice { font-size: 6pt; color: #444; }
        .tag { font-size: 11pt; font-weight: bold; font-family: DejaVu Sans Mono, monospace; }
        .name { font-size: {{ $template->font_pt }}pt; }
        .meta { font-size: 6.5pt; color: #333; }
        .qr img { display: block; }
    </style>
</head>
<body>
@php
    $perPage = max(1, (int) $template->rows * (int) $template->columns);
    $chunks = array_chunk($labels, $perPage);
    $items = $layoutItems ?? [];
@endphp
@foreach ($chunks as $pageIndex => $pageLabels)
    <div class="sheet" style="padding-top: {{ $template->margin_top_mm }}mm; padding-left: {{ $template->margin_left_mm }}mm;@if(!$loop->last) page-break-after: always;@endif">
        <table class="grid">
            @foreach (array_chunk($pageLabels, (int) $template->columns) as $row)
                <tr>
                    @foreach ($row as $label)
                        <td class="cell">
                            <div class="label">
                                @foreach ($items as $item)
                                    @if(empty($item['visible']))
                                        @continue
                                    @endif
                                    @php
                                        $id = $item['id'];
                                        $text = null;
                                        $class = 'meta';
                                        if ($id === 'org') { $text = 'SADC Parliamentary Forum'; $class = 'org'; }
                                        elseif ($id === 'notice') { $text = 'Property of SADC PF'; $class = 'notice'; }
                                        elseif ($id === 'tag') { $text = $label['asset_tag']; $class = 'tag'; }
                                        elseif ($id === 'name') { $text = $label['name']; $class = 'name'; }
                                        elseif ($id === 'model') { $text = $label['model'] ? 'Model: '.$label['model'] : null; }
                                        elseif ($id === 'serial') { $text = $label['serial'] ? 'S/N: '.$label['serial'] : null; }
                                        elseif ($id === 'location') { $text = $label['location'] ? 'Location: '.$label['location'] : null; }
                                        elseif ($id === 'custodian') { $text = $label['custodian'] ? 'Custodian: '.$label['custodian'] : null; }
                                    @endphp
                                    @if($id === 'qr')
                                        <div class="field qr" style="left: {{ $item['x_mm'] }}mm; top: {{ $item['y_mm'] }}mm; width: {{ $item['w_mm'] }}mm; height: {{ $item['h_mm'] }}mm;">
                                            <img src="data:image/png;base64,{{ $label['qr_base64'] }}" alt="QR" style="width: {{ $item['w_mm'] }}mm; height: {{ $item['h_mm'] }}mm;">
                                        </div>
                                    @elseif($text)
                                        <div class="field {{ $class }}" style="left: {{ $item['x_mm'] }}mm; top: {{ $item['y_mm'] }}mm; width: {{ $item['w_mm'] }}mm; height: {{ $item['h_mm'] }}mm;">{{ $text }}</div>
                                    @endif
                                @endforeach
                            </div>
                        </td>
                    @endforeach
                </tr>
            @endforeach
        </table>
    </div>
@endforeach
</body>
</html>
