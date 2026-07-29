<?php

return [
    /*
    | Designated registry mailbox IMAP connector.
    | Never point this at an all-employee mailbox.
    | Password prefers env; DB encrypted column is optional fallback.
    */
    'imap' => [
        'password' => env('CORRESPONDENCE_IMAP_PASSWORD'),
        'timeout' => (int) env('CORRESPONDENCE_IMAP_TIMEOUT', 30),
    ],
];
