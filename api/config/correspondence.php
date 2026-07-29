<?php

return [
    /*
    | Designated registry mailbox IMAP connector.
    | Never point this at an all-employee mailbox.
    | Password prefers env; DB encrypted column is optional fallback.
    | Live poll requires PHP ext-imap in the API image (see docker/php/Dockerfile).
    | Host / port / encryption / username are stored in correspondence_mailbox_settings
    | (admin UI). Env supplies password + timeout only.
    */
    'imap' => [
        'password' => env('CORRESPONDENCE_IMAP_PASSWORD'),
        'timeout' => (int) env('CORRESPONDENCE_IMAP_TIMEOUT', 30),
    ],

    /*
    | Optional courier tracking HTTP base URL.
    | When unset, refresh-tracking uses a local stub status progression.
    | Example: https://tracking.example.com/api/v1/track
    */
    'courier_tracking_url' => env('CORRESPONDENCE_COURIER_TRACKING_URL'),
];
