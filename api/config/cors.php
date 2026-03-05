<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | When the frontend uses credentials (cookies, Authorization headers),
    | the server must respond with a specific origin, not '*'. Set FRONTEND_URL
    | to your web app origin (e.g. http://localhost:3000).
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        array_map('trim', explode(',', (string) env('FRONTEND_URL', ''))),
        ['http://localhost:3000', 'http://127.0.0.1:3000']
    )))) ?: ['http://localhost:3000'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
