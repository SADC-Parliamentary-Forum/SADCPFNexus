<?php

return [
    /*
    | STOCK_FORECAST_PROVIDER=exponential_smoothing|usage_math|http
    | HTTP overlay requires STOCK_FORECAST_HTTP_URL. Never claims live ML without it.
    */
    'forecast_provider' => env('STOCK_FORECAST_PROVIDER', 'exponential_smoothing'),
    'forecast_http_url' => env('STOCK_FORECAST_HTTP_URL'),
    'forecast_http_token' => env('STOCK_FORECAST_HTTP_TOKEN'),
];
