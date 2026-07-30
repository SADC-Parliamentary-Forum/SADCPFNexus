<?php

/**
 * Notifications & Communications Delivery — Phase 2 / Phase 3 config.
 * Live SMS/WhatsApp require governance approval + credentials (never invent keys).
 */
return [
    'push_provider' => env('NOTIFICATIONS_PUSH_PROVIDER', 'null'), // null|fcm
    'push_privacy_body' => env('NOTIFICATIONS_PUSH_PRIVACY_BODY', 'Sign in to Nexus to view details.'),
    'fcm_http_url' => env('NOTIFICATIONS_FCM_HTTP_URL'), // optional generic HTTP endpoint
    'fcm_http_token' => env('NOTIFICATIONS_FCM_HTTP_TOKEN'),

    'email_primary_mailer' => env('NOTIFICATIONS_EMAIL_PRIMARY_MAILER', env('MAIL_MAILER', 'log')),
    'email_secondary_mailer' => env('NOTIFICATIONS_EMAIL_SECONDARY_MAILER'),
    'email_failover_enabled' => filter_var(env('NOTIFICATIONS_EMAIL_FAILOVER_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    'coalesce_window_seconds' => (int) env('NOTIFICATIONS_COALESCE_WINDOW_SECONDS', 120),
    'coalesce_max_items' => (int) env('NOTIFICATIONS_COALESCE_MAX_ITEMS', 20),

    'external_token_ttl_hours' => (int) env('NOTIFICATIONS_EXTERNAL_TOKEN_TTL_HOURS', 72),
    'deep_link_scheme' => env('NOTIFICATIONS_DEEP_LINK_SCHEME', 'sadcpfnexus'),

    'sms_provider' => env('NOTIFICATIONS_SMS_PROVIDER', 'null'), // null only until governance approval
    'whatsapp_provider' => env('NOTIFICATIONS_WHATSAPP_PROVIDER', 'null'),
    'sms_enabled' => false, // Governance Configuration Pending
    'whatsapp_enabled' => false, // Governance Configuration Pending

    'ai_provider' => env('NOTIFICATIONS_AI_PROVIDER', 'stub'), // stub|http
    'ai_enabled' => filter_var(env('NOTIFICATIONS_AI_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
    'ai_http_url' => env('NOTIFICATIONS_AI_HTTP_URL'),
    'ai_http_token' => env('NOTIFICATIONS_AI_HTTP_TOKEN'),

    'forbidden_ai_actions' => [
        'fabricate_event',
        'change_authority',
        'approve',
        'expose_confidential',
        'suppress_mandatory',
        'rewrite_legal',
        'rewrite_security',
    ],

    'default_timezone' => env('NOTIFICATIONS_TIMEZONE', env('WORKFLOW_ENGINE_TIMEZONE', 'Africa/Windhoek')),
];
