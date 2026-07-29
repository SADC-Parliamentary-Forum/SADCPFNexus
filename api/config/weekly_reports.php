<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Weekly report AI draft provider
    |--------------------------------------------------------------------------
    |
    | stub (default) — deterministic narrative from suggestions.
    | llm — reserved for a real provider; falls back to stub when unset/unavailable.
    | Never auto-submits. Human confirm is always required.
    |
    */
    'ai_provider' => env('WEEKLY_AI_PROVIDER', 'stub'),
    'ai_llm_endpoint' => env('WEEKLY_AI_LLM_ENDPOINT'),
    'ai_llm_api_key' => env('WEEKLY_AI_LLM_API_KEY'),
];
