<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Travel Authorisation — {{ $travel->reference_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; margin-top: 16px; border-bottom: 1px solid #333; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; }
        .meta { margin-bottom: 12px; color: #555; }
        .right { text-align: right; }
    </style>
</head>
<body>
    <h1>SADC PF Travel Requisition / Authorisation Form</h1>
    <p class="meta">
        Reference: <strong>{{ $travel->reference_number }}</strong>
        &nbsp;|&nbsp; Status: {{ $travel->status }}
        &nbsp;|&nbsp; Currency: {{ $travel->currency ?? 'NAD' }}
    </p>

    <h2>Part A — Traveller &amp; Mission</h2>
    <table>
        <tr>
            <th>Staff member</th>
            <td>{{ $travel->requester?->name }}</td>
            <th>Department</th>
            <td>{{ $travel->requester?->department?->name ?? '—' }}</td>
        </tr>
        <tr>
            <th>Purpose / objectives</th>
            <td colspan="3">{{ $travel->purpose }}</td>
        </tr>
        <tr>
            <th>Destination</th>
            <td>{{ trim(($travel->destination_city ? $travel->destination_city.', ' : '').($travel->destination_country ?? '')) }}</td>
            <th>Host organisation</th>
            <td>{{ $travel->host_organization ?? '—' }}</td>
        </tr>
        <tr>
            <th>Departure</th>
            <td>{{ optional($travel->departure_date)->toDateString() }}</td>
            <th>Return</th>
            <td>{{ optional($travel->return_date)->toDateString() }}</td>
        </tr>
        <tr>
            <th>Cabin class</th>
            <td>{{ $travel->cabin_class ?? 'economy' }}</td>
            <th>Visa</th>
            <td>
                @if($travel->visa_required)
                    {{ $travel->visa_status ?? 'pending' }}
                    @if($travel->visa_expiry_date) (expiry {{ optional($travel->visa_expiry_date)->toDateString() }}) @endif
                @else
                    Not required
                @endif
            </td>
        </tr>
    </table>

    <h2>Part B — Itinerary</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>From</th>
                <th>To</th>
                <th>Mode</th>
                <th>Day type</th>
            </tr>
        </thead>
        <tbody>
            @forelse($travel->itineraries as $leg)
                <tr>
                    <td>{{ optional($leg->travel_date)->toDateString() ?? '—' }}</td>
                    <td>{{ $leg->from_location }}</td>
                    <td>{{ $leg->to_location }}</td>
                    <td>{{ $leg->transport_mode }}</td>
                    <td>{{ $leg->day_type ?? 'official' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="5">
                        {{ optional($travel->departure_date)->toDateString() }}
                        → {{ optional($travel->return_date)->toDateString() }}
                        ({{ $travel->destination_city ?? $travel->destination_country }})
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    @php
        $hasHealth = $travel->health_vaccination_required
            || $travel->health_prophylaxis_required
            || filled($travel->health_vaccination_status)
            || filled($travel->health_prophylaxis_status)
            || $travel->health_estimated_cost !== null
            || filled($travel->health_notes);
    @endphp
    @if($hasHealth)
    <h2>Health precautions</h2>
    <table>
        <tr>
            <th>Vaccination required</th>
            <td>{{ $travel->health_vaccination_required ? 'Yes' : 'No' }}</td>
            <th>Vaccination status</th>
            <td>{{ $travel->health_vaccination_status ?? '—' }}</td>
        </tr>
        <tr>
            <th>Prophylaxis required</th>
            <td>{{ $travel->health_prophylaxis_required ? 'Yes' : 'No' }}</td>
            <th>Prophylaxis status</th>
            <td>{{ $travel->health_prophylaxis_status ?? '—' }}</td>
        </tr>
        <tr>
            <th>Estimated health cost</th>
            <td>{{ $travel->health_estimated_cost !== null ? number_format((float) $travel->health_estimated_cost, 2) : '—' }}</td>
            <th>Cleared at</th>
            <td>{{ optional($travel->health_cleared_at)->toDateTimeString() ?? '—' }}</td>
        </tr>
        <tr>
            <th>Notes</th>
            <td colspan="3">{{ $travel->health_notes ?? '—' }}</td>
        </tr>
    </table>
    @endif

    <h2>Part C — DSA Calculation</h2>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Destination</th>
                <th>Rate type</th>
                <th class="right">Daily rate</th>
                <th class="right">Meal deduction</th>
                <th class="right">Adjustments</th>
                <th class="right">Payable</th>
                <th>Personal?</th>
            </tr>
        </thead>
        <tbody>
            @forelse($travel->dsaLines as $line)
                <tr>
                    <td>{{ optional($line->date)->toDateString() }}</td>
                    <td>{{ $line->destination }}</td>
                    <td>{{ $line->rate_type }}</td>
                    <td class="right">{{ number_format((float) $line->daily_rate, 2) }}</td>
                    <td class="right">{{ number_format((float) $line->meal_deduction, 2) }}</td>
                    <td class="right">{{ number_format((float) $line->adjustments, 2) }}</td>
                    <td class="right">{{ number_format((float) $line->daily_payable, 2) }}</td>
                    <td>{{ $line->is_personal ? 'Yes' : 'No' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="8">No Finance DSA lines yet. Estimated DSA: {{ number_format((float) ($travel->estimated_dsa ?? 0), 2) }}</td>
                </tr>
            @endforelse
        </tbody>
    </table>
    <p>
        Meal deductions total: <strong>{{ number_format((float) ($travel->meal_deduction_total ?? 0), 2) }}</strong>
        &nbsp;|&nbsp; Terminal/comms: <strong>{{ number_format((float) ($travel->terminal_comms_total ?? 0), 2) }}</strong>
        &nbsp;|&nbsp; Finance DSA total: <strong>{{ number_format((float) ($travel->finance_dsa_total ?? $travel->actual_dsa ?? 0), 2) }}</strong>
    </p>

    <h2>Part D — Funding &amp; Authorisation</h2>
    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th>Funding agency</th>
                <th>Budget line</th>
                <th class="right">Forum amount</th>
                <th class="right">Host amount</th>
            </tr>
        </thead>
        <tbody>
            @forelse($travel->fundingLines as $fund)
                <tr>
                    <td>{{ $fund->item }}</td>
                    <td>{{ $fund->funding_agency ?? '—' }}</td>
                    <td>{{ $fund->budget_line ?? '—' }}</td>
                    <td class="right">{{ number_format((float) $fund->forum_amount, 2) }}</td>
                    <td class="right">{{ number_format((float) $fund->host_amount, 2) }}</td>
                </tr>
            @empty
                <tr><td colspan="5">No funding lines recorded.</td></tr>
            @endforelse
        </tbody>
    </table>

    <table style="margin-top: 14px;">
        <thead>
            <tr>
                <th>Signatory / step</th>
                <th>Actor</th>
                <th>Action</th>
                <th>When</th>
            </tr>
        </thead>
        <tbody>
            @php $history = $travel->approvalRequest?->history ?? collect(); @endphp
            @forelse($history as $step)
                <tr>
                    <td>{{ $step->step_name ?? $step->action ?? '—' }}</td>
                    <td>{{ $step->user?->name ?? '—' }}</td>
                    <td>{{ $step->action ?? '—' }}</td>
                    <td>{{ optional($step->created_at)->toDateTimeString() }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4">
                        Approver: {{ $travel->approver?->name ?? '—' }}
                        @if($travel->approved_at) ({{ optional($travel->approved_at)->toDateTimeString() }}) @endif
                        @if($travel->director_finance_confirmed_at)
                            &nbsp;|&nbsp; Dir Finance: {{ $travel->directorFinanceConfirmer?->name ?? 'confirmed' }}
                            ({{ optional($travel->director_finance_confirmed_at)->toDateTimeString() }})
                        @endif
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
