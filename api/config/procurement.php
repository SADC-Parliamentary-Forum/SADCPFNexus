<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SADC-PF Procurement Thresholds (NAD) — SADC PF Core
    |--------------------------------------------------------------------------
    | Rule (Locked 2026-07-25):
    |   ≤ direct_purchase_limit → approved-supplier / direct purchase
    |   ≤ quotation_limit       → RFQ (min 3 quotes)
    |   > quotation_limit       → tender
    |
    | tender_threshold mirrors quotation_limit for RFQ gate checks
    | (purchases at/above this value require procurement_method = tender).
    |
    | Source: SADC-PF Finance Manual / Procurement Policy (Phase 1 defaults)
    |--------------------------------------------------------------------------
    */

    'direct_purchase_limit' => env('PROCUREMENT_DIRECT_LIMIT', 10_000),
    'quotation_limit'       => env('PROCUREMENT_QUOTATION_LIMIT', 100_000),
    'tender_threshold'      => env('PROCUREMENT_TENDER_THRESHOLD', 100_000),

    /*
    | Minimum quotations required for RFQ-method purchases.
    */
    'minimum_quotes_required' => 3,

    /*
    | Lookback window (days) for anti-split purchase detection on submit.
    */
    'split_lookback_days' => env('PROCUREMENT_SPLIT_LOOKBACK_DAYS', 30),

    /*
    | Phase 2: soft = justification text only (Phase 1);
    | hard = justification + Finance/SG authorisation before approve/RFQ/tender publish.
    */
    'split_enforcement' => env('PROCUREMENT_SPLIT_ENFORCEMENT', 'hard'),

    /*
    | Days ahead to warn Procurement Officers of vendor document expiry.
    */
    'document_expiry_days' => env('PROCUREMENT_DOCUMENT_EXPIRY_DAYS', 30),

    /*
    | Phase 3: AI-assisted comparison summaries (assistive text only).
    | Never auto-award. Stub provider is deterministic from scores.
    | llm requires PROCUREMENT_AI_COMPARISON_LLM_ENDPOINT + API key; otherwise falls back to stub.
    | Human confirm is audit-only and never awards.
    */
    'ai_comparison_enabled'       => env('PROCUREMENT_AI_COMPARISON_ENABLED', false),
    'ai_comparison_provider'      => env('PROCUREMENT_AI_COMPARISON_PROVIDER', 'stub'),
    'ai_comparison_llm_endpoint'  => env('PROCUREMENT_AI_COMPARISON_LLM_ENDPOINT'),
    'ai_comparison_llm_api_key'   => env('PROCUREMENT_AI_COMPARISON_LLM_API_KEY'),
];

