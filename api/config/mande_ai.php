<?php

return [
    // stub (default) | llm — drafts only; human confirm required; never auto-submit
    'provider' => env('MANDE_AI_PROVIDER', 'stub'),
    'llm_endpoint' => env('MANDE_AI_LLM_ENDPOINT'),
    'llm_api_key' => env('MANDE_AI_LLM_API_KEY'),
];
