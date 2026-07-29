<?php

/**
 * Fleet vendor telematics (pluggable).
 *
 * Drivers (FLEET_TELEMATICS_DRIVER):
 *   - null / disabled — no-op; manual GPS stub remains fully usable
 *   - generic_http    — poll FLEET_TELEMATICS_BASE_URL for JSON positions
 *   - http_webhook    — webhook intake only (poll no-ops unless also using --fixture)
 *
 * Expected JSON shape from generic_http (or --fixture):
 * {
 *   "positions": [
 *     {
 *       "device_id": "DEV-100",
 *       "lat": -22.5609,
 *       "lng": 17.0658,
 *       "recorded_at": "2026-07-29T14:00:00Z"
 *     }
 *   ]
 * }
 *
 * Also accepted: a bare array of position objects (same fields).
 * Aliases: latitude/longitude, gps_lat/gps_lng, timestamp for recorded_at.
 *
 * Secrets: FLEET_TELEMATICS_API_KEY and FLEET_TELEMATICS_WEBHOOK_TOKEN from env only.
 * Never hardcode vendor credentials. Webhook never auto-creates vehicles.
 */

return [

    'driver' => env('FLEET_TELEMATICS_DRIVER', 'null'),

    'base_url' => env('FLEET_TELEMATICS_BASE_URL'),

    'api_key' => env('FLEET_TELEMATICS_API_KEY'),

    /*
    | Bearer / X-Telematics-Token for POST /api/v1/fleet/telematics/webhook.
    | Empty = webhook rejects all requests (401).
    */
    'webhook_token' => env('FLEET_TELEMATICS_WEBHOOK_TOKEN'),

    /*
    | When true and driver is generic_http (or fixture sync), schedule
    | fleet:sync-telematics every 15 minutes.
    */
    'schedule_enabled' => filter_var(
        env('FLEET_TELEMATICS_SCHEDULE_ENABLED', false),
        FILTER_VALIDATE_BOOLEAN
    ),

    'http_timeout' => (int) env('FLEET_TELEMATICS_HTTP_TIMEOUT', 20),

];
