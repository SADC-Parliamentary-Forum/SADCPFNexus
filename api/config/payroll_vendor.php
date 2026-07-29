<?php

return [
    /*
    | Vendor payroll import adapter (payslip staging only — no OT rate invention).
    | Drivers: null (upload JSON) | generic_http (optional remote pull + upload fallback)
    */
    'driver' => env('PAYROLL_VENDOR_DRIVER', 'null'),
    'http_url' => env('PAYROLL_VENDOR_HTTP_URL'),
    'api_key' => env('PAYROLL_VENDOR_API_KEY'),
    'http_timeout' => (int) env('PAYROLL_VENDOR_HTTP_TIMEOUT', 20),
];
