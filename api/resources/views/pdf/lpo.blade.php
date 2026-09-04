<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PURCHASE ORDER {{ $po->lpo_number ?? $po->reference_number }}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10.5px; color: #111; margin: 0; padding: 0; }
        h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 0.04em; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #333; padding: 5px 6px; vertical-align: top; }
        th { background: #f3f3f3; font-weight: bold; }
        .right { text-align: right; }
        .muted { color: #555; }
        .lh-header { border-bottom: 3px solid #1d85ed; padding: 16px 24px 12px; }
        .lh-org-name { font-size: 15px; font-weight: bold; color: #0f1f3d; margin: 0; }
        .lh-org-abbr { font-size: 10px; font-weight: bold; color: #1d85ed; text-transform: uppercase; }
        .lh-banner { background: #1d85ed; padding: 6px 24px; color: #fff; font-size: 10px; }
        .body-section { padding: 14px 24px 18px; }
        .sig { height: 42px; }
        .meta td { border: 0; padding: 2px 0; }
    </style>
</head>
<body>
@php
    $fmtMoney = fn ($v) => number_format((float) $v, 2);
    $lpoNo = $po->lpo_number ?: $po->reference_number;
    $lpoDate = $po->lpo_date?->format('Y/m/d') ?? now()->format('Y/m/d');
    $projectName = $po->project?->name ?? $po->procurementRequest?->programme?->title ?? '';
@endphp
<div class="lh-header">
    <p class="lh-org-name">{{ $letterhead['org_name'] ?? 'SADC Parliamentary Forum' }}</p>
    <p class="lh-org-abbr">{{ $letterhead['org_abbreviation'] ?? 'SADC-PF' }}</p>
</div>
<div class="lh-banner">
    PURCHASE ORDER &nbsp; No. {{ $lpoNo }}
</div>
<div class="body-section">
    <h1>PURCHASE ORDER No. {{ $lpoNo }}</h1>
    <table class="meta">
        <tr>
            <td width="55%"><strong>TO:</strong><br>{{ $po->vendor?->name }}<br>{!! nl2br(e($po->vendor?->address ?? '')) !!}</td>
            <td width="45%">
                <strong>DATE:</strong> {{ $lpoDate }}<br>
                <strong>PROJECT:</strong> {{ $projectName }}<br>
                @if($po->retrospective)
                    <span class="muted">Source: Retrospective invoice (not backdated)</span>
                @endif
            </td>
        </tr>
    </table>

    <table>
        <thead>
            <tr>
                <th style="width:12%">QTY</th>
                <th>DESCRIPTION</th>
                <th style="width:18%" class="right">PRICE UNIT</th>
                <th style="width:18%" class="right">TOTAL</th>
            </tr>
        </thead>
        <tbody>
        @foreach($po->items as $item)
            <tr>
                <td class="right">{{ rtrim(rtrim(number_format((float) $item->quantity, 3), '0'), '.') }}</td>
                <td>{{ $item->description }}</td>
                <td class="right">{{ $fmtMoney($item->unit_price) }}</td>
                <td class="right">{{ $fmtMoney($item->total_price) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>

    <table style="width:50%; margin-left:auto;">
        <tr><td>SUBTOTAL</td><td class="right">{{ $fmtMoney($po->subtotal ?? $po->total_amount) }}</td></tr>
        <tr>
            <td>VAT</td>
            <td class="right">
                @if($po->vat_identified)
                    {{ $fmtMoney($po->tax_amount) }}
                @else
                    Not identified — verify
                @endif
            </td>
        </tr>
        <tr><th>TOTAL</th><th class="right">{{ $po->currency === 'NAD' ? 'N$' : $po->currency }} {{ $fmtMoney($po->total_amount) }}</th></tr>
    </table>

    @if($po->items->first()?->account_code)
        <p><strong>CODE / ACCOUNT CODE:</strong> {{ $po->items->pluck('account_code')->filter()->unique()->implode(', ') }}</p>
    @endif

    <p><strong>REQUESTED BY:</strong> {{ $po->procurementRequest?->requester?->name ?? $po->createdBy?->name }}</p>
    <p><strong>PREPARED BY:</strong> {{ $po->createdBy?->name }}</p>

    <p><strong>AUTHORISED SIGNATORIES</strong></p>
    <table>
        <tr>
            <th>Role</th>
            <th>Name</th>
            <th>Date</th>
            <th>Signature</th>
        </tr>
        @forelse($po->approvalRequest?->history ?? [] as $hist)
            <tr>
                <td>{{ $hist->step_name ?? $hist->decision }}</td>
                <td>{{ $hist->actor?->name ?? $hist->user?->name }}</td>
                <td>{{ optional($hist->created_at)->format('Y/m/d H:i') }}</td>
                <td class="sig">Approved in Nexus</td>
            </tr>
        @empty
            <tr><td colspan="4" class="muted">{{ $po->status === 'issued' || $po->status === 'approved' ? 'Authorised in Nexus workflow' : 'Pending' }}</td></tr>
        @endforelse
    </table>
    <p class="muted">Generated {{ $generatedAt->toDateTimeString() }} · Hash recorded in Nexus · Official date is the LPO date above, not the supplier invoice date.</p>
</div>
</body>
</html>
