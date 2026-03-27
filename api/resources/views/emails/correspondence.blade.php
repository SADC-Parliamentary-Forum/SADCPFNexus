<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $correspondence->subject }}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
        .wrapper { max-width: 640px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }

        /* ── Letterhead Header ── */
        .lh-header { background: #fff; padding: 24px 32px 20px; border-bottom: 3px solid #1d85ed; display: flex; align-items: center; gap: 20px; }
        .lh-logo { width: 60px; height: 60px; object-fit: contain; flex-shrink: 0; }
        .lh-logo-placeholder { width: 60px; height: 60px; background: #1d85ed; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .lh-logo-placeholder span { color: #fff; font-weight: 900; font-size: 18px; }
        .lh-org { flex: 1; }
        .lh-org-name { font-size: 17px; font-weight: 700; color: #0f1f3d; margin: 0 0 2px; }
        .lh-org-abbr { font-size: 12px; font-weight: 600; color: #1d85ed; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .06em; }
        .lh-tagline { font-size: 11px; color: #6b7280; margin: 0; font-style: italic; }

        /* ── Blue Banner ── */
        .lh-banner { background: #1d85ed; padding: 10px 32px; display: flex; justify-content: space-between; align-items: center; }
        .lh-banner-date { font-size: 12px; color: rgba(255,255,255,.85); }
        .lh-banner-ref { font-size: 12px; font-weight: 700; color: #fff; font-family: monospace; letter-spacing: .05em; }

        /* ── Subject ── */
        .lh-subject { padding: 20px 32px 0; }
        .lh-subject h1 { font-size: 16px; font-weight: 700; color: #0f1f3d; margin: 0 0 4px; }
        .lh-subject p { font-size: 12px; color: #6b7280; margin: 0; }

        /* ── Body ── */
        .lh-body { padding: 20px 32px 28px; }
        .salutation { font-size: 14px; color: #374151; margin-bottom: 4px; }
        .org-line { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
        .content-text { font-size: 14px; line-height: 1.65; color: #374151; white-space: pre-wrap; }

        /* ── Footer ── */
        .lh-footer { border-top: 1px solid #e5e7eb; padding: 14px 32px; background: #f9fafb; }
        .lh-footer-contacts { font-size: 11px; color: #9ca3af; display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 6px; }
        .lh-footer-contacts span { display: flex; align-items: center; gap: 4px; }
        .lh-footer-addr { font-size: 11px; color: #9ca3af; }
        .lh-footer-disclaimer { font-size: 10px; color: #d1d5db; margin-top: 8px; border-top: 1px solid #f3f4f6; padding-top: 8px; }
    </style>
</head>
<body>
<div class="wrapper">

    {{-- Letterhead Header --}}
    <div class="lh-header">
        @if(!empty($letterhead['org_logo_url']))
            <img src="{{ $letterhead['org_logo_url'] }}" alt="{{ $letterhead['org_abbreviation'] ?? '' }}" class="lh-logo" />
        @else
            <div class="lh-logo-placeholder">
                <span>{{ strtoupper(substr($letterhead['org_abbreviation'] ?? 'S', 0, 2)) }}</span>
            </div>
        @endif
        <div class="lh-org">
            <p class="lh-org-name">{{ $letterhead['org_name'] ?? 'SADC Parliamentary Forum' }}</p>
            <p class="lh-org-abbr">{{ $letterhead['org_abbreviation'] ?? 'SADC-PF' }}</p>
            @if(!empty($letterhead['letterhead_tagline']))
                <p class="lh-tagline">{{ $letterhead['letterhead_tagline'] }}</p>
            @endif
        </div>
    </div>

    {{-- Blue banner: date left, ref right --}}
    <div class="lh-banner">
        <span class="lh-banner-date">{{ $correspondence->sent_at?->format('d F Y') ?? now()->format('d F Y') }}</span>
        @if($correspondence->reference_number)
            <span class="lh-banner-ref">Ref: {{ $correspondence->reference_number }}</span>
        @else
            <span class="lh-banner-date"></span>
        @endif
    </div>

    {{-- Subject line --}}
    <div class="lh-subject">
        <h1>{{ $correspondence->subject }}</h1>
        @if($correspondence->title && $correspondence->title !== $correspondence->subject)
            <p>{{ $correspondence->title }}</p>
        @endif
    </div>

    {{-- Body --}}
    <div class="lh-body">
        <p class="salutation">Dear <strong>{{ $contact->full_name }}</strong>,</p>
        @if($contact->organization)
            <p class="org-line">{{ $contact->organization }}</p>
        @endif

        @if($correspondence->body)
            <div class="content-text">{{ $correspondence->body }}</div>
        @else
            <p class="content-text">Please find the attached correspondence for your reference.</p>
        @endif
    </div>

    {{-- Footer --}}
    <div class="lh-footer">
        <div class="lh-footer-contacts">
            @if(!empty($letterhead['letterhead_phone']))
                <span>&#x1F4DE; {{ $letterhead['letterhead_phone'] }}</span>
            @endif
            @if(!empty($letterhead['letterhead_fax']))
                <span>&#x1F4E0; {{ $letterhead['letterhead_fax'] }}</span>
            @endif
            @if(!empty($letterhead['letterhead_website']))
                <span>&#x1F310; {{ $letterhead['letterhead_website'] }}</span>
            @endif
        </div>
        @if(!empty($letterhead['org_address']))
            <p class="lh-footer-addr">{{ $letterhead['org_address'] }}</p>
        @endif
        <p class="lh-footer-disclaimer">This correspondence was sent via SADCPFNexus. Please do not reply to this automated message.</p>
    </div>

</div>
</body>
</html>
