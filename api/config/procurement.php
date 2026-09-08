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
    'quotation_limit' => env('PROCUREMENT_QUOTATION_LIMIT', 100_000),
    'tender_threshold' => env('PROCUREMENT_TENDER_THRESHOLD', 100_000),

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
    'ai_comparison_enabled' => env('PROCUREMENT_AI_COMPARISON_ENABLED', false),
    'ai_comparison_provider' => env('PROCUREMENT_AI_COMPARISON_PROVIDER', 'stub'),
    'ai_comparison_llm_endpoint' => env('PROCUREMENT_AI_COMPARISON_LLM_ENDPOINT'),
    'ai_comparison_llm_api_key' => env('PROCUREMENT_AI_COMPARISON_LLM_API_KEY'),

    /*
    | Newspaper-notice HTTP LLM draft (CR-8). Suggestion only; human checklist still required.
    | Never auto-awards.
    */
    /*
    | Procurement invoice OCR (Tesseract). Falls back to OcrUnconfiguredAdapter
    | when the binary is missing. Never invents text. CI should set
    | PROCUREMENT_OCR_DRIVER=unconfigured and bind a fake engine in tests.
    */
    'ocr_adapter' => env('PROCUREMENT_OCR_DRIVER', 'tesseract'),
    'ocr_tesseract_bin' => env('PROCUREMENT_OCR_TESSERACT_BIN', 'tesseract'),
    'ocr_pdftoppm_bin' => env('PROCUREMENT_OCR_PDFTOPPM_BIN', 'pdftoppm'),
    'ocr_languages' => env('PROCUREMENT_OCR_LANGUAGES', 'eng+fra+por'),
    'ocr_max_pages' => (int) env('PROCUREMENT_OCR_MAX_PAGES', 4),
    'ocr_timeout_seconds' => (int) env('PROCUREMENT_OCR_TIMEOUT_SECONDS', 60),

    /*
    | Designated procurement invoice mailbox only — not the organisation inbox
    | and not the correspondence registry mailbox. Host alone is not enough;
    | USER and PASSWORD are required before the php_imap adapter is live.
    | Poller never auto-confirms intakes or issues LPOs.
    */
    'inbox_imap_adapter' => env('PROCUREMENT_INBOX_IMAP_ADAPTER', 'php_imap'),
    'inbox_imap_host' => env('PROCUREMENT_INBOX_IMAP_HOST'),
    'inbox_imap_user' => env('PROCUREMENT_INBOX_IMAP_USER'),
    'inbox_imap_password' => env('PROCUREMENT_INBOX_IMAP_PASSWORD'),
    'inbox_imap_port' => (int) env('PROCUREMENT_INBOX_IMAP_PORT', 993),
    'inbox_imap_encryption' => env('PROCUREMENT_INBOX_IMAP_ENCRYPTION', 'ssl'),
    'inbox_imap_mailbox' => env('PROCUREMENT_INBOX_IMAP_MAILBOX', 'INBOX'),
    'inbox_imap_allowlist' => env('PROCUREMENT_INBOX_IMAP_ALLOWLIST'),
    'notice_llm_token' => env('PROCUREMENT_NOTICE_LLM_TOKEN'),
];
