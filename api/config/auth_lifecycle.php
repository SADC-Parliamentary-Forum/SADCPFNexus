<?php

return [
    'password_min' => (int) env('NEXUS_PASSWORD_MIN', 12),
    'password_max' => (int) env('NEXUS_PASSWORD_MAX', 128),

    /*
    | Number of previous password hashes to retain and reject on change.
    | Set to 0 to disable history checks.
    */
    'password_history_count' => (int) env('NEXUS_PASSWORD_HISTORY_COUNT', 5),

    /*
    | Maximum password age in days. Expired passwords force must_reset_password
    | on the next successful login. Set to 0 to disable expiry.
    */
    'password_max_age_days' => (int) env('NEXUS_PASSWORD_MAX_AGE_DAYS', 90),

    'password_reset_expire_minutes' => (int) env('AUTH_PASSWORD_RESET_EXPIRE', 30),

    'invitation_expire_hours' => (int) env('NEXUS_INVITATION_EXPIRE_HOURS', 48),

    'allowed_email_domains' => array_values(array_filter(array_map(
        static fn (string $domain): string => strtolower(trim($domain)),
        explode(',', (string) env('NEXUS_ALLOWED_EMAIL_DOMAINS', 'sadcpf.org'))
    ))),

    'common_passwords' => [
        'password',
        'password1',
        'password12',
        'password123',
        'password1234',
        'adminpassword',
        'administrator',
        'sadcpf123456',
        'sadcpfnexus',
        'qwerty123456',
        'letmein123456',
        'welcome123456',
        'changeme123456',
    ],
];
