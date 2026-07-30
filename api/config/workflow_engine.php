<?php

return [
    'ai_provider' => env('WORKFLOW_ENGINE_AI_PROVIDER', 'stub'),
    'ai_enabled' => filter_var(env('WORKFLOW_ENGINE_AI_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
    'ai_http_url' => env('WORKFLOW_ENGINE_AI_HTTP_URL'),
    'ai_http_token' => env('WORKFLOW_ENGINE_AI_HTTP_TOKEN'),

    'allowed_suggestion_kinds' => [
        'config_suggestion',
        'bottleneck_prediction',
        'approver_resolution_hint',
        'anomaly_detection',
        'policy_to_workflow_hint',
        'nl_workflow_search',
    ],

    /** Safe draft-only actions after human confirmation — never publish/approve/etc. */
    'allowed_apply_actions' => [
        'attach_draft_note',
        'suggest_stage_edit',
        'record_search_hint',
    ],

    'forbidden_apply_actions' => [
        'publish_workflow',
        'approve_transaction',
        'grant_authority',
        'skip_stage',
        'resolve_sod',
        'apply_signature',
        'accept_exception',
        'approve',
        'publish',
        'sign',
    ],

    'email_require_auth' => filter_var(env('WORKFLOW_ENGINE_EMAIL_REQUIRE_AUTH', true), FILTER_VALIDATE_BOOLEAN),
    'email_high_risk_mfa_note' => env(
        'WORKFLOW_ENGINE_EMAIL_HIGH_RISK_MFA_NOTE',
        'High-risk stages require authentication in Nexus; MFA is recommended before approving.'
    ),

    'default_working_days' => [1, 2, 3, 4, 5],
    'default_timezone' => env('WORKFLOW_ENGINE_TIMEZONE', 'Africa/Windhoek'),
];
