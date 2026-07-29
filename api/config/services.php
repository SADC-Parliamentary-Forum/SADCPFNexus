<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Firebase Cloud Messaging (push notifications)
    // Run `flutterfire configure` in /mobile then set these from the generated service account JSON.
    'fcm' => [
        'project_id'           => env('FCM_PROJECT_ID'),
        'service_account_json' => env('FCM_SERVICE_ACCOUNT_JSON'),   // path to JSON file (optional)
        'client_email'         => env('FCM_CLIENT_EMAIL'),
        'private_key'          => env('FCM_PRIVATE_KEY'),
    ],

    // Machine-to-machine token for GET /api/v1/external/workplan
    'external_workplan' => [
        'token' => env('EXTERNAL_WORKPLAN_TOKEN'),
    ],

    // Optional Sentry (install sentry/sentry-laravel when DSN is available)
    'sentry' => [
        'dsn' => env('SENTRY_LARAVEL_DSN', env('SENTRY_DSN')),
    ],

    // Optional Google Calendar OAuth / service account (absent → ICS subscribe/download feed)
    'google' => [
        'calendar_client_id' => env('GOOGLE_CALENDAR_CLIENT_ID'),
        'calendar_client_secret' => env('GOOGLE_CALENDAR_CLIENT_SECRET'),
        'calendar_redirect_uri' => env('GOOGLE_CALENDAR_REDIRECT_URI'),
        'calendar_refresh_token' => env('GOOGLE_CALENDAR_REFRESH_TOKEN'),
        'calendar_service_account_json' => env('GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON'),
        'calendar_webhook_secret' => env('GOOGLE_CALENDAR_WEBHOOK_SECRET'),
        'calendar_id' => env('GOOGLE_CALENDAR_ID', 'primary'),
    ],

];
