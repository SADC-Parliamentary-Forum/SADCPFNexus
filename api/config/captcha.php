<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Bot protection for public browser forms
    |--------------------------------------------------------------------------
    |
    | Enabled by default. PHPUnit sets CAPTCHA_ENABLED=false so existing
    | session tests stay focused on auth behaviour. Dedicated captcha tests
    | turn it back on. Mobile *login* (`client_type=mobile`) skips the
    | challenge so the Flutter app is unchanged. Public registration never
    | honours that bypass.
    |
    | Driver selection (first match):
    |   hcaptcha  — both HCAPTCHA_SITE_KEY and HCAPTCHA_SECRET_KEY
    |   turnstile — both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY
    |   challenge — signed one-time checkbox token (local / no keys)
    |
    */

    'enabled' => filter_var(env('CAPTCHA_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    'hcaptcha_site_key' => env('HCAPTCHA_SITE_KEY'),

    'hcaptcha_secret' => env('HCAPTCHA_SECRET_KEY'),

    'turnstile_site_key' => env('TURNSTILE_SITE_KEY'),

    'turnstile_secret' => env('TURNSTILE_SECRET_KEY'),

    'ttl_seconds' => (int) env('CAPTCHA_TTL_SECONDS', 600),

    // `client_type=mobile` is client-supplied, so this bypass also skips the
    // captcha for any script that sends it; per-account login throttling is
    // the compensating control. Set false once the Flutter app solves a captcha.
    'mobile_login_bypass' => filter_var(env('CAPTCHA_MOBILE_LOGIN_BYPASS', true), FILTER_VALIDATE_BOOLEAN),

];
