<?php

return [
    'default_cabin_class' => env('TRAVEL_DEFAULT_CABIN', 'economy'),
    'retirement_working_days' => 5,
    'toil_hours_per_day' => 8.0,
    'toil_expiry_days' => 30,
    'auto_create_leave_from_travel' => false,
    'attachment_requirements' => [
        'submit' => ['invitation', 'agenda'],
        'admin_complete' => ['travel_itinerary'],
        'mark_booked' => ['flight_ticket'],
        'retire' => ['mission_report'],
    ],
];
