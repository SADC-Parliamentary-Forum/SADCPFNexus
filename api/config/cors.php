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

    'allowed_origins' => array_values(array_unique(array_filter(
        array_map('trim', explode(',', (string) env('FRONTEND_URL', 'http://localhost:3000')))
    ))) ?: ['http://localhost:3000'],

    // Allow Flutter web (Chrome) any localhost port — dev environments only.
    // In production (APP_ENV=production) this pattern is disabled; use FRONTEND_URL instead.
    'allowed_origins_patterns' => in_array(env('APP_ENV', 'production'), ['local', 'development', 'testing'])
        ? ['#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#']
        : [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => true,

];
