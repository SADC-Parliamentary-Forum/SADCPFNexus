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
    | Driver `challenge` is a signed, one-time token issued after the user
    | confirms they are not a robot. When TURNSTILE_SECRET_KEY is set, the
    | driver is `turnstile` and tokens are verified with Cloudflare.
    |
    */

    'enabled' => filter_var(env('CAPTCHA_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    'turnstile_site_key' => env('TURNSTILE_SITE_KEY'),

    'turnstile_secret' => env('TURNSTILE_SECRET_KEY'),

    'ttl_seconds' => (int) env('CAPTCHA_TTL_SECONDS', 600),

];
