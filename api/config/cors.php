<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | When the frontend uses credentials (cookies, Authorization headers),
    | the server must respond with a specific origin, not '*'.
    | FRONTEND_URL: comma-separated origins (e.g. http://localhost:3000).
    | Flutter web (Chrome) uses a random port; patterns below allow localhost.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        array_map('trim', explode(',', (string) env('FRONTEND_URL', ''))),
        [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:49956',
            'http://127.0.0.1:49956',
        ]
    )))) ?: ['http://localhost:3000'],

    // Allow Flutter web (Chrome): any port on localhost / 127.0.0.1
    'allowed_origins_patterns' => [
        '#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#',
    ],

    'allowed_headers' => ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
