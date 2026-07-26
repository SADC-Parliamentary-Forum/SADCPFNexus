<?php

return [
    'default_cabin_class' => env('TRAVEL_DEFAULT_CABIN', 'economy'),
    'retirement_working_days' => 5,
    'toil_hours_per_day' => 8.0,
    'toil_expiry_days' => 30,
    'auto_create_leave_from_travel' => false,
    /** Soft hint: link travel booking to procurement when combined estimate >= threshold. */
    'procurement_link_threshold' => (float) env('TRAVEL_PROCUREMENT_LINK_THRESHOLD', 10000),
    /** Optional HTTP FX feed — leave empty for manual/admin table only. Never hardcode paid API keys. */
    'fx_http_url' => env('TRAVEL_FX_HTTP_URL'),
    'fx_http_token' => env('TRAVEL_FX_HTTP_TOKEN'),
    'attachment_requirements' => [
        'submit' => ['invitation', 'agenda'],
        'admin_complete' => ['travel_itinerary'],
        'mark_booked' => ['flight_ticket'],
        'retire' => ['mission_report'],
    ],
];
