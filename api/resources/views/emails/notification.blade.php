<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject }}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f0f2f5; }
        .wrapper { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.1); }

        .header { background: #fff; padding: 24px 32px 18px; border-bottom: 3px solid #1d85ed; display: flex; align-items: center; gap: 16px; }
        .logo-box { width: 48px; height: 48px; background: #1d85ed; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-box span { color: #fff; font-weight: 900; font-size: 16px; font-style: italic; }
        .org-name { font-size: 15px; font-weight: 700; color: #0f1f3d; margin: 0 0 2px; }
        .org-sub  { font-size: 11px; font-weight: 600; color: #1d85ed; text-transform: uppercase; letter-spacing: .06em; }

        .banner { background: #1d85ed; padding: 8px 32px; }
        .banner-text { font-size: 11px; color: rgba(255,255,255,.85); }

        .body { padding: 28px 32px 32px; }
        .subject-label { font-size: 11px; font-weight: 700; color: #1d85ed; text-transform: uppercase; letter-spacing: .08em; margin: 0 0 6px; }
        .subject-text  { font-size: 17px; font-weight: 700; color: #0f1f3d; margin: 0 0 20px; line-height: 1.35; }
        .message { font-size: 14px; line-height: 1.7; color: #374151; white-space: pre-wrap; }

        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }

        .footer { border-top: 1px solid #e5e7eb; padding: 14px 32px; background: #f9fafb; }
        .footer p { font-size: 11px; color: #9ca3af; margin: 0; line-height: 1.5; }
        .footer a { color: #1d85ed; text-decoration: none; }
    </style>
</head>
<body>
<div class="wrapper">

    <!-- Header -->
    <div class="header">
        <div class="logo-box"><span>SP</span></div>
        <div>
            <p class="org-name">SADC Parliamentary Forum</p>
            <p class="org-sub">SADC-PF Nexus</p>
        </div>
    </div>

    <!-- Blue accent bar -->
    <div class="banner">
        <span class="banner-text">Official notification from the SADC-PF Paperless Management System &nbsp;·&nbsp; {{ now()->format('d M Y') }}</span>
    </div>

    <!-- Body -->
    <div class="body">
        <p class="subject-label">Notification</p>
        <p class="subject-text">{{ $subject }}</p>
        <div class="message">{{ $body }}</div>

        @if(!empty($approveUrl) || !empty($rejectUrl))
        <!-- Action buttons — link to the portal approval page (handles both logged-in and guest flows) -->
        <div style="margin: 28px 0 8px;">
            @if(!empty($approveUrl))
            <a href="{{ $approveUrl }}"
               style="display:inline-block; padding: 14px 36px; background: #16a34a; color: #ffffff;
                      font-family: Arial, sans-serif; font-weight: 700; font-size: 15px;
                      text-decoration: none; border-radius: 8px; border: 2px solid #15803d;
                      margin-right: 12px; margin-bottom: 10px; letter-spacing: .01em;">
                &#10003;&nbsp; Review &amp; Approve
            </a>
            @endif
            @if(!empty($rejectUrl))
            <a href="{{ $rejectUrl }}"
               style="display:inline-block; padding: 14px 36px; background: #ffffff; color: #dc2626;
                      font-family: Arial, sans-serif; font-weight: 700; font-size: 15px;
                      text-decoration: none; border-radius: 8px; border: 2px solid #dc2626;
                      margin-bottom: 10px; letter-spacing: .01em;">
                &#10007;&nbsp; Return / Reject
            </a>
            @endif
        </div>
        <p style="font-size: 11px; color: #9ca3af; margin: 4px 0 20px; line-height: 1.5;">
            If you are logged in to SADC-PF Nexus, you can sign this approval with your saved signature.
            These links are single-use and expire 72 hours after this email was sent.
        </p>
        @endif

        <hr class="divider">
        <p style="font-size:12px;color:#6b7280;margin:0;">
            This message was sent to <strong>{{ $recipientName }}</strong>. If you have questions, please contact your HR or Finance department.
        </p>
    </div>

    <!-- Footer -->
    <div class="footer">
        <p>
            SADC Parliamentary Forum · SADC-PF Nexus Paperless System<br>
            This is an automated notification. Please do not reply to this email.
        </p>
    </div>

</div>
</body>
</html>
