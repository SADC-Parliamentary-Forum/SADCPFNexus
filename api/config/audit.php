<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Audit AI assist (Phase 3) — env-gated, stub by default
    |--------------------------------------------------------------------------
    |
    | AUDIT_AI_PROVIDER=stub|http
    | AUDIT_AI_HTTP_URL=   optional generic HTTP endpoint (no embedded keys)
    | AUDIT_AI_HTTP_TOKEN= optional bearer from secrets / env only
    |
    | Hard guards (never overridable by provider response):
    | - never auto-issue findings
    | - never assign blame
    | - never approve management responses
    | - never close findings
    | - never verify implementation
    | - never determine misconduct
    | - never modify final audit conclusions
    | Human confirmation is required before any suggestion is applied.
    */
    'ai_provider' => env('AUDIT_AI_PROVIDER', 'stub'),
    'ai_http_url' => env('AUDIT_AI_HTTP_URL'),
    'ai_http_token' => env('AUDIT_AI_HTTP_TOKEN'),
    'ai_enabled' => filter_var(env('AUDIT_AI_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    'allowed_suggestion_kinds' => [
        'workpaper_summary',
        'duplicate_findings',
        'root_cause',
        'draft_report',
        'evidence_index',
        'nl_search',
    ],

    'allowed_apply_actions' => [
        'attach_note',
        'attach_draft_text',
        'record_search_hint',
    ],

    'forbidden_apply_actions' => [
        'issue_finding',
        'close_finding',
        'verify_implementation',
        'approve_management_response',
        'assign_blame',
        'determine_misconduct',
        'modify_final_conclusion',
    ],
];
