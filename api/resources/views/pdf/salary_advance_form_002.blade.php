<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>FORM-002 Salary Advance — {{ $advance->reference_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; margin-top: 18px; border-bottom: 1px solid #333; padding-bottom: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f0f0f0; }
        .meta { margin-bottom: 12px; }
        .muted { color: #555; }
    </style>
</head>
<body>
    <h1>FORM-002 — Salary Advance Application</h1>
    <p class="meta muted">
        Reference: <strong>{{ $advance->reference_number }}</strong>
        @if($advance->policyVersion)
            &nbsp;|&nbsp; Policy: {{ $advance->policyVersion->version }}
            ({{ $advance->policyVersion->salary_basis }}, {{ $advance->policyVersion->max_salary_percentage }}%)
        @endif
        &nbsp;|&nbsp; Status: {{ $advance->status }}
    </p>

    <h2>Part A — Applicant</h2>
    <table>
        <tr><th>Name</th><td>{{ $advance->requester?->name }}</td><th>Department</th><td>{{ $advance->requester?->department?->name ?? '—' }}</td></tr>
        <tr><th>Advance type</th><td>{{ $advance->advance_type }}</td><th>Amount requested</th><td>{{ number_format((float) $advance->amount, 2) }} {{ $advance->currency }}</td></tr>
        <tr><th>Purpose</th><td colspan="3">{{ $advance->purpose }}</td></tr>
        <tr><th>Justification</th><td colspan="3">{{ $advance->justification }}</td></tr>
        <tr>
            <th>Confirmed net (snapshot)</th>
            <td>{{ $advance->net_salary_at_request !== null ? number_format((float) $advance->net_salary_at_request, 2) : '—' }}</td>
            <th>Max eligible</th>
            <td>{{ $advance->max_eligible_amount !== null ? number_format((float) $advance->max_eligible_amount, 2) : '—' }}</td>
        </tr>
        <tr>
            <th>Salary basis</th><td>{{ $advance->salary_basis ?? 'net_confirmed' }}</td>
            <th>Intended recovery</th><td>{{ optional($advance->intended_recovery_payroll_date)->format('Y-m-d') ?? '—' }}</td>
        </tr>
        <tr>
            <th>Deduction authority</th>
            <td colspan="3">
                {{ $advance->deduction_authority_confirmed ? 'Confirmed' : 'Not confirmed' }}
                @if($advance->deduction_authority_version)
                    ({{ $advance->deduction_authority_version }}
                    @if($advance->deduction_authority_confirmed_at)
                        at {{ $advance->deduction_authority_confirmed_at }}
                    @endif)
                @endif
            </td>
        </tr>
    </table>

    <h2>Part B — Finance Certification</h2>
    @php $review = $advance->financeReviews->where('outcome', 'certified')->last(); @endphp
    @if($review)
        <table>
            <tr><th>Certified by</th><td>{{ $review->reviewer?->name }}</td><th>Date</th><td>{{ $advance->finance_certified_at }}</td></tr>
            <tr><th>Confirmed net</th><td>{{ number_format((float) $review->confirmed_net_salary, 2) }}</td><th>Max eligible</th><td>{{ number_format((float) $review->max_eligible_amount, 2) }}</td></tr>
            <tr><th>Recommended amount</th><td>{{ number_format((float) $review->recommended_amount, 2) }}</td><th>Recovery date</th><td>{{ optional($review->intended_recovery_payroll_date)->format('Y-m-d') }}</td></tr>
            <tr><th>Comments</th><td colspan="3">{{ $review->comments ?? '—' }}</td></tr>
        </table>
    @else
        <p class="muted">Not yet certified by Finance.</p>
    @endif

    <h2>Part C — Approval, Payment &amp; Recovery</h2>
    <table>
        <tr><th>Approved amount</th><td>{{ $advance->approved_amount !== null ? number_format((float) $advance->approved_amount, 2) : '—' }}</td><th>Approved by</th><td>{{ $advance->approver?->name ?? '—' }}</td></tr>
        <tr><th>Payment status</th><td>{{ $advance->payment_status ?? '—' }}</td><th>Paid at</th><td>{{ $advance->paid_at ?? '—' }}</td></tr>
        <tr><th>Payment reference</th><td>{{ $advance->payment_reference ?? '—' }}</td><th>Method</th><td>{{ $advance->payment_method ?? '—' }}</td></tr>
        <tr><th>Recovery status</th><td>{{ $advance->recovery_status ?? '—' }}</td><th>Recovered</th><td>{{ $advance->recovered_amount !== null ? number_format((float) $advance->recovered_amount, 2) : '—' }}</td></tr>
        <tr><th>Ledger balance</th><td colspan="3">{{ number_format((float) ($ledger['balance'] ?? 0), 2) }}</td></tr>
    </table>

    @if($advance->approvalRequest)
        <h2>Workflow history</h2>
        <table>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Comment</th></tr></thead>
            <tbody>
            @foreach($advance->approvalRequest->history as $h)
                <tr>
                    <td>{{ $h->created_at }}</td>
                    <td>{{ $h->user?->name }}</td>
                    <td>{{ $h->action ?? $h->status ?? '—' }}</td>
                    <td>{{ $h->comment ?? '—' }}</td>
                </tr>
            @endforeach
            </tbody>
        </table>
    @endif
</body>
</html>
