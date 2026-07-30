<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Certificate-based signatures (Phase 2) — stub by default
    |--------------------------------------------------------------------------
    |
    | PEOPLE_AUTHORITY_CERTIFICATE_DRIVER=stub|pkcs11_http
    | PEOPLE_AUTHORITY_CERTIFICATE_HTTP_URL=
    | PEOPLE_AUTHORITY_CERTIFICATE_HTTP_TOKEN=
    */
    'certificate_driver' => env('PEOPLE_AUTHORITY_CERTIFICATE_DRIVER', 'stub'),
    'certificate_http_url' => env('PEOPLE_AUTHORITY_CERTIFICATE_HTTP_URL'),
    'certificate_http_token' => env('PEOPLE_AUTHORITY_CERTIFICATE_HTTP_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | External e-sign provider — human-triggered only
    |--------------------------------------------------------------------------
    |
    | PEOPLE_AUTHORITY_ESIGN_DRIVER=null|generic_http
    | PEOPLE_AUTHORITY_ESIGN_HTTP_URL=
    | PEOPLE_AUTHORITY_ESIGN_HTTP_TOKEN=
    */
    'esign_driver' => env('PEOPLE_AUTHORITY_ESIGN_DRIVER', 'null'),
    'esign_http_url' => env('PEOPLE_AUTHORITY_ESIGN_HTTP_URL'),
    'esign_http_token' => env('PEOPLE_AUTHORITY_ESIGN_HTTP_TOKEN'),
    'esign_http_timeout' => (int) env('PEOPLE_AUTHORITY_ESIGN_HTTP_TIMEOUT', 20),

    /*
    |--------------------------------------------------------------------------
    | Microsoft 365 / directory synchronisation — read-only
    |--------------------------------------------------------------------------
    |
    | PEOPLE_AUTHORITY_M365_DRIVER=null|fixture|microsoft_graph
    | PEOPLE_AUTHORITY_M365_TENANT_ID=
    | PEOPLE_AUTHORITY_M365_CLIENT_ID=
    | PEOPLE_AUTHORITY_M365_CLIENT_SECRET=
    | PEOPLE_AUTHORITY_M365_FIXTURE_PATH=  optional JSON for dry-run tests
    */
    'm365_driver' => env('PEOPLE_AUTHORITY_M365_DRIVER', 'null'),
    'm365_tenant_id' => env('PEOPLE_AUTHORITY_M365_TENANT_ID'),
    'm365_client_id' => env('PEOPLE_AUTHORITY_M365_CLIENT_ID'),
    'm365_client_secret' => env('PEOPLE_AUTHORITY_M365_CLIENT_SECRET'),
    'm365_fixture_path' => env('PEOPLE_AUTHORITY_M365_FIXTURE_PATH'),
    'm365_dry_run_default' => filter_var(env('PEOPLE_AUTHORITY_M365_DRY_RUN', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Automated role recertification
    |--------------------------------------------------------------------------
    */
    'recertification_schedule_enabled' => filter_var(
        env('PEOPLE_AUTHORITY_RECERT_SCHEDULE_ENABLED', false),
        FILTER_VALIDATE_BOOLEAN
    ),

    /*
    |--------------------------------------------------------------------------
    | AI / recommendations (Phase 3) — suggestions only, stub default
    |--------------------------------------------------------------------------
    |
    | Hard guards (never overridable):
    | - never auto-grant access, authority, delegation, signing rights, privileged roles
    | Human confirmation is required before any suggestion is applied (safe notes only).
    */
    'ai_provider' => env('PEOPLE_AUTHORITY_AI_PROVIDER', 'stub'),
    'ai_http_url' => env('PEOPLE_AUTHORITY_AI_HTTP_URL'),
    'ai_http_token' => env('PEOPLE_AUTHORITY_AI_HTTP_TOKEN'),
    'ai_enabled' => filter_var(env('PEOPLE_AUTHORITY_AI_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    'allowed_suggestion_kinds' => [
        'access_recommendation',
        'anomalous_privilege',
        'nl_org_search',
        'succession_hint',
        'skills_gap',
    ],

    'allowed_apply_actions' => [
        'attach_note',
        'record_search_hint',
        'open_review_item',
    ],

    'forbidden_apply_actions' => [
        'grant_access',
        'grant_authority',
        'create_delegation',
        'grant_signing_rights',
        'assign_privileged_role',
        'approve_role',
        'activate_signature',
    ],

    /*
    |--------------------------------------------------------------------------
    | Public signature verification — approved metadata only
    |--------------------------------------------------------------------------
    */
    'public_verify_throttle' => env('PEOPLE_AUTHORITY_PUBLIC_VERIFY_THROTTLE', '30,1'),
];
