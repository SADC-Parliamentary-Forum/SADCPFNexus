<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SADCPFNexus Weekly Summary</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
        .wrapper { max-width: 640px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
        .header { background: #fff; padding: 20px 32px 16px; border-bottom: 3px solid #1d85ed; display: flex; align-items: center; gap: 14px; }
        .logo-box { width: 44px; height: 44px; background: #1d85ed; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-box span { color: #fff; font-weight: 900; font-size: 14px; font-style: italic; }
        .org-name { font-size: 14px; font-weight: 700; color: #0f1f3d; margin: 0 0 2px; }
        .org-sub  { font-size: 10px; font-weight: 600; color: #1d85ed; text-transform: uppercase; letter-spacing: .06em; }
        .period-bar { background: #1d85ed; padding: 10px 32px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
        .period-label { font-size: 13px; font-weight: 700; color: #fff; }
        .scope-pill { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.85); background: rgba(255,255,255,.15); border-radius: 20px; padding: 2px 10px; }
        .body { padding: 24px 32px 28px; }
        .greeting { font-size: 14px; color: #374151; margin: 0 0 20px; }
        /* Highlights */
        .highlights { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px; }
        .highlights h3 { margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: .06em; }
        .highlights ul { margin: 0; padding: 0 0 0 18px; }
        .highlights li { font-size: 13px; color: #78350f; line-height: 1.6; }
        /* Sections */
        .section { margin-bottom: 22px; }
        .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
        .section-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .section-title { font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .06em; }
        /* Tables */
        .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .data-table th { background: #f9fafb; text-align: left; padding: 7px 10px; font-weight: 700; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
        .data-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: top; }
        .data-table tr:last-child td { border-bottom: none; }
        /* Stat row */
        .stat-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 4px; }
        .stat-box { flex: 1; min-width: 80px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; text-align: center; }
        .stat-num { font-size: 22px; font-weight: 800; color: #0f1f3d; line-height: 1; }
        .stat-lbl { font-size: 11px; color: #6b7280; margin-top: 3px; }
        /* Personal section */
        .personal-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; }
        .personal-box h3 { margin: 0 0 12px; font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: .06em; }
        .personal-row { font-size: 13px; color: #374151; margin-bottom: 6px; }
        .personal-row strong { color: #0f1f3d; }
        .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 12px; }
        .badge-ok  { background: #dcfce7; color: #166534; }
        .badge-warn { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fee2e2; color: #991b1b; }
        /* Empty state */
        .empty { font-size: 12px; color: #9ca3af; font-style: italic; }
        /* Footer */
        .cta { text-align: center; margin: 24px 0 8px; }
        .cta a { display: inline-block; padding: 12px 32px; background: #1d85ed; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 8px; }
        .footer { border-top: 1px solid #e5e7eb; padding: 14px 32px; background: #f9fafb; }
        .footer p { font-size: 11px; color: #9ca3af; margin: 0; line-height: 1.5; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 18px 0; }
    </style>
</head>
<body>
<div class="wrapper">

    {{-- Header --}}
    <div class="header">
        <div class="logo-box"><span>SP</span></div>
        <div>
            <p class="org-name">SADC Parliamentary Forum</p>
            <p class="org-sub">SADC-PF Nexus — Weekly Summary</p>
        </div>
    </div>

    {{-- Period bar --}}
    <div class="period-bar">
        <span class="period-label">
            {{ \Carbon\Carbon::parse($payload['meta']['period_start'])->format('d M') }}
            –
            {{ \Carbon\Carbon::parse($payload['meta']['period_end'])->format('d M Y') }}
        </span>
        <span class="scope-pill">{{ $payload['meta']['scope']['label'] }}</span>
    </div>

    <div class="body">
        <p class="greeting">Dear {{ $user->name }},<br>Here is your weekly institutional summary from SADCPFNexus.</p>

        {{-- Highlights --}}
        @if(!empty($payload['highlights']))
        <div class="highlights">
            <h3>⚡ Key Highlights</h3>
            <ul>
                @foreach($payload['highlights'] as $h)
                <li>{{ $h }}</li>
                @endforeach
            </ul>
        </div>
        @endif

        {{-- Who is Out --}}
        <div class="section">
            <div class="section-header">
                <span class="section-dot" style="background:#ef4444"></span>
                <span class="section-title">Who is Out / Away</span>
            </div>
            @if(!empty($payload['who_is_out']))
            <table class="data-table">
                <thead>
                    <tr><th>Name</th><th>Department</th><th>Status</th><th>Location</th><th>Returns</th></tr>
                </thead>
                <tbody>
                    @foreach($payload['who_is_out'] as $person)
                    <tr>
                        <td><strong>{{ $person['name'] }}</strong></td>
                        <td>{{ $person['department'] }}</td>
                        <td>{{ $person['status'] }}</td>
                        <td>{{ $person['location'] }}</td>
                        <td>{{ \Carbon\Carbon::parse($person['return_date'])->format('d M') }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
            @else
            <p class="empty">No staff absent this week.</p>
            @endif
        </div>

        {{-- Travel --}}
        <div class="section">
            <div class="section-header">
                <span class="section-dot" style="background:#3b82f6"></span>
                <span class="section-title">Travel & Missions</span>
            </div>
            <div class="stat-row">
                <div class="stat-box">
                    <div class="stat-num">{{ count($payload['travel']['ongoing'] ?? []) }}</div>
                    <div class="stat-lbl">Active Missions</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ count($payload['travel']['next_week_departures'] ?? []) }}</div>
                    <div class="stat-lbl">Departing Next Week</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['travel']['approved_this_week'] ?? 0 }}</div>
                    <div class="stat-lbl">Approved This Week</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['travel']['pending_count'] ?? 0 }}</div>
                    <div class="stat-lbl">Pending Approval</div>
                </div>
            </div>
        </div>

        {{-- Leave --}}
        <div class="section">
            <div class="section-header">
                <span class="section-dot" style="background:#f59e0b"></span>
                <span class="section-title">Leave</span>
            </div>
            <div class="stat-row">
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['leave']['approved'] ?? 0 }}</div>
                    <div class="stat-lbl">Approved</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['leave']['submitted'] ?? 0 }}</div>
                    <div class="stat-lbl">Pending</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['leave']['total'] ?? 0 }}</div>
                    <div class="stat-lbl">Total This Week</div>
                </div>
            </div>
        </div>

        {{-- Timesheets --}}
        <div class="section">
            <div class="section-header">
                <span class="section-dot" style="background:#8b5cf6"></span>
                <span class="section-title">Timesheets</span>
            </div>
            <div class="stat-row">
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['timesheets']['submitted'] ?? 0 }}</div>
                    <div class="stat-lbl">Submitted</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['timesheets']['approved'] ?? 0 }}</div>
                    <div class="stat-lbl">Approved</div>
                </div>
                <div class="stat-box" style="{{ ($payload['timesheets']['missing'] ?? 0) > 0 ? 'background:#fff7ed;border-color:#fed7aa' : '' }}">
                    <div class="stat-num" style="color:{{ ($payload['timesheets']['missing'] ?? 0) > 0 ? '#c2410c' : '#0f1f3d' }}">
                        {{ $payload['timesheets']['missing'] ?? 0 }}
                    </div>
                    <div class="stat-lbl">Missing</div>
                </div>
            </div>
        </div>

        {{-- Assignments --}}
        <div class="section">
            <div class="section-header">
                <span class="section-dot" style="background:#10b981"></span>
                <span class="section-title">Assignments & Tasks</span>
            </div>
            <div class="stat-row">
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['assignments']['completed_this_week'] ?? 0 }}</div>
                    <div class="stat-lbl">Completed</div>
                </div>
                <div class="stat-box" style="{{ ($payload['assignments']['overdue'] ?? 0) > 0 ? 'background:#fff1f2;border-color:#fecdd3' : '' }}">
                    <div class="stat-num" style="color:{{ ($payload['assignments']['overdue'] ?? 0) > 0 ? '#be123c' : '#0f1f3d' }}">
                        {{ $payload['assignments']['overdue'] ?? 0 }}
                    </div>
                    <div class="stat-lbl">Overdue</div>
                </div>
                <div class="stat-box">
                    <div class="stat-num">{{ $payload['assignments']['due_next_week'] ?? 0 }}</div>
                    <div class="stat-lbl">Due Next Week</div>
                </div>
            </div>
        </div>

        {{-- Approvals --}}
        @if(($payload['approvals']['pending_with_me'] ?? 0) > 0)
        <div class="section">
            <div class="section-header">
                <span class="section-dot" style="background:#f97316"></span>
                <span class="section-title">Approvals Awaiting Your Action</span>
            </div>
            <div class="stat-row">
                <div class="stat-box" style="background:#fff7ed;border-color:#fed7aa">
                    <div class="stat-num" style="color:#c2410c">{{ $payload['approvals']['pending_with_me'] }}</div>
                    <div class="stat-lbl">Pending</div>
                </div>
                @if(($payload['approvals']['overdue'] ?? 0) > 0)
                <div class="stat-box" style="background:#fff1f2;border-color:#fecdd3">
                    <div class="stat-num" style="color:#be123c">{{ $payload['approvals']['overdue'] }}</div>
                    <div class="stat-lbl">Overdue (&gt;2 days)</div>
                </div>
                @endif
            </div>
        </div>
        @endif

        <hr>

        {{-- Personal Summary --}}
        <div class="personal-box">
            <h3>👤 Your Personal Summary</h3>
            <div class="personal-row">
                <strong>Timesheet:</strong>
                @if($payload['personal']['timesheet_submitted'] ?? false)
                    <span class="badge badge-ok">Submitted ✓</span>
                @else
                    <span class="badge badge-warn">Not submitted</span>
                @endif
            </div>
            @if(!empty($payload['personal']['leave']))
            <div class="personal-row">
                <strong>Leave this week:</strong>
                @foreach($payload['personal']['leave'] as $lv)
                    {{ $lv['leave_type'] }} ({{ $lv['status'] }}){{ !$loop->last ? ', ' : '' }}
                @endforeach
            </div>
            @endif
            @if(!empty($payload['personal']['travel']))
            <div class="personal-row">
                <strong>Travel:</strong>
                @foreach($payload['personal']['travel'] as $tr)
                    {{ $tr['purpose'] }} → {{ $tr['destination_country'] }} ({{ $tr['status'] }}){{ !$loop->last ? ', ' : '' }}
                @endforeach
            </div>
            @endif
            @if(($payload['personal']['pending_approvals'] ?? 0) > 0)
            <div class="personal-row">
                <strong>Approvals pending from you:</strong>
                <span class="badge badge-warn">{{ $payload['personal']['pending_approvals'] }}</span>
            </div>
            @endif
            @if(($payload['personal']['overdue_tasks'] ?? 0) > 0)
            <div class="personal-row">
                <strong>Overdue tasks:</strong>
                <span class="badge badge-danger">{{ $payload['personal']['overdue_tasks'] }}</span>
            </div>
            @endif
        </div>

        {{-- CTA --}}
        <div class="cta">
            <a href="{{ env('APP_FRONTEND_URL', config('app.url')) }}/dashboard">Open Your Dashboard →</a>
        </div>
    </div>

    {{-- Footer --}}
    <div class="footer">
        <p>
            Report ID: {{ $report->id }} &nbsp;·&nbsp;
            Generated: {{ \Carbon\Carbon::parse($payload['meta']['generated_at'])->format('d M Y H:i') }} UTC<br>
            This is an automated weekly summary from SADC-PF Nexus. Do not reply to this email.<br>
            To manage your email preferences, visit
            <a href="{{ env('APP_FRONTEND_URL', config('app.url')) }}/profile/security" style="color:#1d85ed">your profile settings</a>.
        </p>
    </div>

</div>
</body>
</html>
