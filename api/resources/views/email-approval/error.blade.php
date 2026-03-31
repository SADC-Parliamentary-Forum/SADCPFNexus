<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Error — SADC-PF Nexus</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
        .wrapper { max-width: 560px; margin: 48px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
        .header { background: #fff; padding: 24px 32px 18px; border-bottom: 3px solid #1d85ed; display: flex; align-items: center; gap: 16px; }
        .logo-box { width: 48px; height: 48px; background: #1d85ed; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-box span { color: #fff; font-weight: 900; font-size: 16px; font-style: italic; }
        .org-name { font-size: 15px; font-weight: 700; color: #0f1f3d; margin: 0 0 2px; }
        .org-sub  { font-size: 11px; font-weight: 600; color: #1d85ed; text-transform: uppercase; letter-spacing: .06em; }
        .banner { background: #f59e0b; padding: 8px 32px; }
        .banner-text { font-size: 11px; color: rgba(255,255,255,.9); }
        .body { padding: 36px 32px 40px; text-align: center; }
        .icon { width: 72px; height: 72px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; color: #d97706; }
        .error-title { font-size: 20px; font-weight: 700; color: #0f1f3d; margin: 0 0 12px; }
        .error-msg { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0 0 28px; max-width: 420px; margin-left: auto; margin-right: auto; }
        .portal-hint { font-size: 13px; color: #374151; background: #f3f4f6; border-radius: 6px; padding: 14px 18px; margin: 0 auto; max-width: 420px; }
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
        <span class="banner-text">Action required &nbsp;·&nbsp; {{ now()->format('d M Y, H:i') }}</span>
    </div>
    <div class="body">
        <div class="icon">&#9888;</div>
        <h1 class="error-title">
            @if(($reason ?? '') === 'expired') Link Expired
            @elseif(($reason ?? '') === 'used') Already Actioned
            @elseif(($reason ?? '') === 'workflow') Action Not Permitted
            @else Invalid Link
            @endif
        </h1>
        <p class="error-msg">{{ $message ?? 'This approval link cannot be used.' }}</p>
        <div class="portal-hint">
            <strong>Need to action this request?</strong><br>
            Please log in to the SADC-PF Nexus portal where you can review and approve or reject
            requests from your pending approvals queue.
        </div>
    </div>
    <div class="footer">
        <p>SADC Parliamentary Forum · SADC-PF Nexus Paperless System</p>
    </div>
</div>
</body>
</html>
