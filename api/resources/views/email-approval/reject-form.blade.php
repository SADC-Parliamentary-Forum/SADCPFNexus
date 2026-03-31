<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Return Request — SADC-PF Nexus</title>
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
        .body { padding: 32px 32px 40px; }
        .page-title { font-size: 20px; font-weight: 700; color: #0f1f3d; margin: 0 0 8px; }
        .page-sub { font-size: 14px; color: #6b7280; margin: 0 0 28px; line-height: 1.5; }
        .error-box { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #dc2626; }
        label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
        textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px 14px; font-size: 14px; font-family: Arial, sans-serif; color: #0f1f3d; resize: vertical; min-height: 110px; outline: none; transition: border-color .15s; }
        textarea:focus { border-color: #1d85ed; box-shadow: 0 0 0 3px rgba(29,133,237,.1); }
        .hint { font-size: 12px; color: #9ca3af; margin: 6px 0 24px; }
        .btn-reject { display: block; width: 100%; padding: 14px; background: #dc2626; color: #fff; font-size: 15px; font-weight: 700; text-align: center; border: none; border-radius: 6px; cursor: pointer; font-family: Arial, sans-serif; }
        .btn-reject:hover { background: #b91c1c; }
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
        <h1 class="page-title">Return Request</h1>
        <p class="page-sub">
            Please provide a reason for returning this request. The requester will be notified
            with your comments and can revise and resubmit.
        </p>

        @if(!empty($error))
        <div class="error-box">{{ $error }}</div>
        @endif

        <form method="POST" action="{{ route('email-approval.reject.submit', ['token' => $token]) }}">
            @csrf
            <label for="reason">Reason for returning <span style="color:#dc2626;">*</span></label>
            <textarea
                id="reason"
                name="reason"
                placeholder="Describe why this request is being returned and what corrections are needed..."
                required
                minlength="5"
            >{{ old('reason') }}</textarea>
            <p class="hint">Minimum 5 characters. Be specific so the requester knows exactly what to revise.</p>

            <button type="submit" class="btn-reject">&#10007;&nbsp; Confirm Return / Reject</button>
        </form>
    </div>
    <div class="footer">
        <p>SADC Parliamentary Forum · SADC-PF Nexus Paperless System</p>
    </div>
</div>
</body>
</html>
