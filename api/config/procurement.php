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
];
