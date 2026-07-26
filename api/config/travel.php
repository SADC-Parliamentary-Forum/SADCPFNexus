<?php

return [
    'default_cabin_class' => env('TRAVEL_DEFAULT_CABIN', 'economy'),
    'retirement_working_days' => 5,
    'toil_hours_per_day' => (float) env('TRAVEL_TOIL_HOURS_PER_DAY', 8.0),
    'toil_expiry_days' => (int) env('TRAVEL_TOIL_EXPIRY_DAYS', 30),
    /**
     * HARD LOCK: never auto-create Leave credit / LeaveRequest from travel.
     * Leave Module credit happens only after supervisor confirm + HR validate.
     */
    'auto_create_leave_from_travel' => false,
    /**
     * Auto means: detect weekend/holiday duty days, create/update TOIL *candidates*,
     * and notify supervisor + HR. Does NOT credit leave.
     */
    'auto_generate_candidates' => filter_var(
        env('TRAVEL_AUTO_GENERATE_TOIL_CANDIDATES', true),
        FILTER_VALIDATE_BOOLEAN
    ),
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
