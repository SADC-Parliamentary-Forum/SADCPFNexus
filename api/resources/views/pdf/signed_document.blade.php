<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Signed Document</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 0; }

        /* ── Letterhead ── */
        .lh-header { border-bottom: 3px solid #1d85ed; padding: 18px 32px 14px; display: block; }
        .lh-logo { width: 52px; height: 52px; float: left; margin-right: 16px; }
        .lh-org-name { font-size: 16px; font-weight: bold; color: #0f1f3d; margin: 0; }
        .lh-org-abbr { font-size: 10px; font-weight: bold; color: #1d85ed; text-transform: uppercase; letter-spacing: 0.06em; }
        .lh-tagline { font-size: 10px; color: #6b7280; font-style: italic; }
        .clearfix::after { content: ""; display: block; clear: both; }

        /* ── Banner ── */
        .lh-banner { background: #1d85ed; padding: 7px 32px; color: #fff; font-size: 10px; }
        .lh-banner-left { float: left; }
        .lh-banner-right { float: right; font-weight: bold; font-family: monospace; }

        /* ── Body ── */
        .body-section { padding: 18px 32px 0; }
        .doc-title { font-size: 14px; font-weight: bold; color: #0f1f3d; margin: 0 0 4px; }
        .doc-meta { font-size: 10px; color: #6b7280; margin: 0 0 16px; }

        /* ── Approval chain table ── */
        .section-title { font-size: 10px; font-weight: bold; color: #374151; text-transform: uppercase;
            letter-spacing: 0.06em; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 16px 0 8px; }
        table.chain { width: 100%; border-collapse: collapse; font-size: 10px; }
        table.chain th { background: #f3f4f6; text-align: left; padding: 5px 8px; font-weight: bold; color: #374151; border: 1px solid #e5e7eb; }
        table.chain td { padding: 6px 8px; vertical-align: middle; border: 1px solid #e5e7eb; }
        table.chain tr:nth-child(even) td { background: #f9fafb; }
        .action-approve { color: #16a34a; font-weight: bold; }
        .action-reject  { color: #dc2626; font-weight: bold; }
        .action-review  { color: #d97706; font-weight: bold; }
        .action-return  { color: #6b7280; font-weight: bold; }
        .delegated-note { font-size: 9px; color: #6b7280; font-style: italic; }
        .sig-img { max-width: 80px; max-height: 32px; }

        /* ── Footer ── */
        .lh-footer { border-top: 1px solid #e5e7eb; margin: 20px 32px 0; padding: 10px 0; font-size: 9px; color: #9ca3af; }
        .lh-footer-contacts { margin-bottom: 3px; }
        .verify-section { margin-top: 14px; padding: 10px 32px; }
        .verify-title { font-size: 9px; font-weight: bold; color: #374151; margin-bottom: 4px; }
        .qr-img { width: 80px; height: 80px; float: right; margin-left: 12px; }
        .hash-text { font-family: monospace; font-size: 8px; color: #6b7280; word-break: break-all; }
    </style>
</head>
<body>

{{-- Letterhead Header --}}
<div class="lh-header clearfix">
    @if(!empty($letterhead['org_logo_url']) && str_starts_with($letterhead['org_logo_url'], '/'))
        {{-- Skip external image in PDF to avoid SSRF; use text placeholder --}}
    @endif
    <div style="float:left; width:52px; height:52px; background:#1d85ed; border-radius:6px; text-align:center; line-height:52px; color:#fff; font-weight:900; font-size:16px; margin-right:16px;">
        {{ strtoupper(substr($letterhead['org_abbreviation'] ?? 'S', 0, 2)) }}
    </div>
    <div style="float:left;">
        <p class="lh-org-name">{{ $letterhead['org_name'] ?? 'SADC Parliamentary Forum' }}</p>
        <p class="lh-org-abbr">{{ $letterhead['org_abbreviation'] ?? 'SADC-PF' }}</p>
        @if(!empty($letterhead['letterhead_tagline']))
            <p class="lh-tagline">{{ $letterhead['letterhead_tagline'] }}</p>
        @endif
    </div>
</div>

{{-- Blue Banner --}}
<div class="lh-banner clearfix">
    <span class="lh-banner-left">{{ now()->format('d F Y') }}</span>
    @if(!empty($signable->reference_number))
        <span class="lh-banner-right">Ref: {{ $signable->reference_number }}</span>
    @endif
</div>

{{-- Document identity --}}
<div class="body-section">
    <p class="doc-title">{{ $signable->title ?? $signable->subject ?? ('Document #' . $signable->id) }}</p>
    @if(!empty($signable->subject) && $signable->subject !== ($signable->title ?? ''))
        <p class="doc-meta">Subject: {{ $signable->subject }}</p>
    @endif
    <p class="doc-meta">Status: {{ ucwords(str_replace('_', ' ', $signable->status ?? '')) }}</p>
</div>

{{-- Approval Chain --}}
<div class="body-section">
    <p class="section-title">Approval & Signing Chain</p>

    @if(count($events) > 0)
        <table class="chain">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Signatory</th>
                    <th>Action</th>
                    <th>Step</th>
                    <th>Date &amp; Time</th>
                    <th>Comment</th>
                    <th>Signature</th>
                </tr>
            </thead>
            <tbody>
                @foreach($events as $i => $e)
                    <tr>
                        <td>{{ $i + 1 }}</td>
                        <td>
                            {{ $e['name'] }}
                            @if($e['job_title'])
                                <br><span style="color:#6b7280;">{{ $e['job_title'] }}</span>
                            @endif
                            @if($e['is_delegated'])
                                <br><span class="delegated-note">Acting under delegated authority</span>
                            @endif
                        </td>
                        <td class="action-{{ $e['action'] }}">{{ ucfirst($e['action']) }}</td>
                        <td>{{ $e['step_key'] ?: '—' }}</td>
                        <td>{{ $e['signed_at'] }}</td>
                        <td>{{ $e['comment'] ?: '—' }}</td>
                        <td>
                            @if($e['sig_base64'])
                                <img src="data:image/png;base64,{{ $e['sig_base64'] }}" class="sig-img" alt="signature" />
                            @else
                                <span style="color:#9ca3af;font-style:italic;">No image</span>
                            @endif
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @else
        <p style="color:#9ca3af;font-style:italic;">No signing events recorded yet.</p>
    @endif
</div>

{{-- Verification QR --}}
<div class="verify-section clearfix">
    @if($qrBase64)
        <img src="data:image/png;base64,{{ $qrBase64 }}" class="qr-img" alt="QR Code" />
    @endif
    <div>
        <p class="verify-title">Document Verification</p>
        <p class="hash-text">Verify at: {{ $verifyUrl }}</p>
    </div>
</div>

{{-- Footer --}}
<div class="lh-footer">
    <div class="lh-footer-contacts">
        @if(!empty($letterhead['letterhead_phone'])) Tel: {{ $letterhead['letterhead_phone'] }} &nbsp; @endif
        @if(!empty($letterhead['letterhead_fax'])) Fax: {{ $letterhead['letterhead_fax'] }} &nbsp; @endif
        @if(!empty($letterhead['letterhead_website'])) Web: {{ $letterhead['letterhead_website'] }} @endif
    </div>
    @if(!empty($letterhead['org_address']))
        <p style="margin:0;">{{ $letterhead['org_address'] }}</p>
    @endif
    <p style="margin:4px 0 0; font-size:8px; color:#d1d5db;">
        This document was digitally signed via SADCPFNexus. Signatures are cryptographically recorded and tamper-evident.
    </p>
</div>

</body>
</html>
