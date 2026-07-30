<?php

/**
 * Shared Document Service configuration.
 *
 * Malware drivers (DOCUMENT_AV_DRIVER):
 *   - null / disabled — pass-through (default; no live AV until governance approves)
 *   - clamav          — ClamAV daemon via TCP (CLAMAV_HOST / CLAMAV_PORT)
 *   - http            — HTTP AV gateway (DOCUMENT_AV_HTTP_URL + optional bearer)
 *
 * Secrets stay in env; never hardcode AV credentials.
 */

return [

    'av_driver' => env('DOCUMENT_AV_DRIVER', 'null'),

    'clamav' => [
        'host' => env('CLAMAV_HOST', '127.0.0.1'),
        'port' => (int) env('CLAMAV_PORT', 3310),
        'timeout' => (int) env('CLAMAV_TIMEOUT', 30),
    ],

    'http_av' => [
        'url' => env('DOCUMENT_AV_HTTP_URL'),
        'token' => env('DOCUMENT_AV_HTTP_TOKEN'),
        'timeout' => (int) env('DOCUMENT_AV_HTTP_TIMEOUT', 30),
    ],

    'ocr_driver' => env('DOCUMENT_OCR_DRIVER', 'null'),

    /*
    | Backup / recovery hooks — ops configures schedules; app exposes status only.
    */
    'backup' => [
        'hook_enabled' => filter_var(env('DOCUMENT_BACKUP_HOOK_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        'last_verified_at' => env('DOCUMENT_BACKUP_LAST_VERIFIED_AT'),
        'rpo_hours' => (int) env('DOCUMENT_BACKUP_RPO_HOURS', 24),
    ],

    /*
    | Fields returned by public / internal verify-by-hash endpoints.
    | Storage paths, download tokens, owner IDs and notes are never included.
    */
    'verify_public_fields' => [
        'verified',
        'content_hash',
        'version_number',
        'status',
        'is_immutable',
        'quarantine_status',
        'scan_provider',
        'mime_type',
        'size_bytes',
        'classification',
        'module',
        'finalized_at',
    ],

    'verify_internal_fields' => [
        'verified',
        'content_hash',
        'version_number',
        'status',
        'is_immutable',
        'quarantine_status',
        'scan_provider',
        'mime_type',
        'size_bytes',
        'classification',
        'module',
        'title',
        'document_id',
        'version_id',
        'finalized_at',
        'legal_hold',
    ],

];
