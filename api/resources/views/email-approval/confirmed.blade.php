<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ ucfirst($action) }} Confirmed — SADC-PF Nexus</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
        .wrapper { max-width: 560px; margin: 48px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
        .header { background: #fff; padding: 24px 32px 18px; border-bottom: 3px solid #1d85ed; display: flex; align-items: center; gap: 16px; }
        .logo-box { width: 48px; height: 48px; background: #1d85ed; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-box span { color: #fff; font-weight: 900; font-size: 16px; font-style: italic; }
        .org-name { font-size: 15px; font-weight: 700; color: #0f1f3d; margin: 0 0 2px; }
        .org-sub  { font-size: 11px; font-weight: 600; color: #1d85ed; text-transform: uppercase; letter-spacing: .06em; }
        .banner { background: #1d85ed; padding: 8px 32px; }
        .banner-text { font-size: 11px; color: rgba(255,255,255,.85); }
        .body { padding: 36px 32px 40px; text-align: center; }
        .icon { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
        .icon-approved { background: #dcfce7; color: #16a34a; }
        .icon-rejected { background: #fee2e2; color: #dc2626; }
        .status-title { font-size: 22px; font-weight: 700; color: #0f1f3d; margin: 0 0 8px; }
        .status-sub { font-size: 14px; color: #6b7280; margin: 0 0 24px; line-height: 1.5; }
        .detail-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; text-align: left; margin: 0 auto 28px; }
        .detail-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
        .detail-label { color: #6b7280; }
        .detail-value { font-weight: 600; color: #0f1f3d; }
        .footer { border-top: 1px solid #e5e7eb; padding: 14px 32px; background: #f9fafb; text-align: center; }
        .footer p { font-size: 11px; color: #9ca3af; margin: 0; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <div class="logo-box"><span>SP</span></div>
        <div>
            <p class="org-name">SADC Parliamentary Forum</p>
            <p class="org-sub">SADC-PF Nexus</p>
        </div>
    </div>
    <div class="banner">
        <span class="banner-text">Official notification &nbsp;·&nbsp; {{ now()->format('d M Y, H:i') }}</span>
    </div>
    <div class="body">
        @if($action === 'approved')
            <div class="icon icon-approved">&#10003;</div>
            <h1 class="status-title">Request Approved</h1>
            <p class="status-sub">
                You have successfully approved this {{ $module }} request.<br>
                {{ $requester }} has been notified of your decision.
            </p>
        @else
            <div class="icon icon-rejected">&#10007;</div>
            <h1 class="status-title">Request Returned</h1>
            <p class="status-sub">
                You have returned this {{ $module }} request with your comments.<br>
                {{ $requester }} has been notified and can revise and resubmit.
            </p>
        @endif

        <div class="detail-box">
            <div class="detail-row">
                <span class="detail-label">Module</span>
                <span class="detail-value">{{ $module }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Reference</span>
                <span class="detail-value">{{ $reference }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Requester</span>
                <span class="detail-value">{{ $requester }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Actioned</span>
                <span class="detail-value">{{ now()->format('d M Y, H:i') }}</span>
            </div>
        </div>

        <p style="font-size:12px;color:#9ca3af;">
            This action has been recorded in the SADC-PF Nexus audit trail.<br>
            You may close this window.
        </p>
    </div>
    <div class="footer">
        <p>SADC Parliamentary Forum · SADC-PF Nexus Paperless System</p>
    </div>
</div>
</body>
</html>
