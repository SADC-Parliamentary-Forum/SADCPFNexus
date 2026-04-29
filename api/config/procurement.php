<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SADC-PF Procurement Thresholds (NAD)
    |--------------------------------------------------------------------------
    | direct_purchase_limit   — below this value, direct purchase is permitted
    |                           (1 quote sufficient)
    | quotation_limit         — above direct and below this, RFQ required with
    |                           at least 3 written quotations
    | tender_threshold        — at or above this value, open/restricted tender
    |                           process is mandatory
    |
    | Source: SADC-PF Finance Manual / Procurement Policy
    |--------------------------------------------------------------------------
    */

    'direct_purchase_limit' => env('PROCUREMENT_DIRECT_LIMIT', 5_000),
    'quotation_limit'       => env('PROCUREMENT_QUOTATION_LIMIT', 50_000),
    'tender_threshold'      => env('PROCUREMENT_TENDER_THRESHOLD', 500_000),

    /*
    | Minimum quotations required for RFQ-method purchases.
    */
    'minimum_quotes_required' => 3,
];
