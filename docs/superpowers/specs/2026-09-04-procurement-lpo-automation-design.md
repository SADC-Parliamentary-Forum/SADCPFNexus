# Procurement Officer Automation — Design

**Date:** 2026-09-04  
**Module:** Procurement (extend existing; do not replace)

## Assumptions

- Reuse `Vendor` as Supplier Master, `PurchaseOrder` as LPO, `ProcurementRequest` as the requisition, `Invoice` as supplier invoice, `GoodsReceiptNote` as GRN, `ProcurementPolicyProfile` as threshold configuration, `numbering_schemes` for consecutive LPO numbers, `WorkflowService` for sequential LPO approval, `Attachment` + `ModuleDocumentBridge` for files, `AuditLog` + `NotificationService` for trail and email.
- Official LPO numbers use format `S 04015` (prefix `S`, space separator, 5-digit pad). Production sequence is **not** inferred from the sample document; Administration must confirm the last legacy number.
- Extraction is deterministic text parsing of PDF/DOCX. Image OCR is an explicit `OcrUnconfiguredAdapter` (never fake success). Upload remains the live path.
- Procurement IMAP is an explicit `ImapUnconfiguredAdapter`. Env host/user/password must not be treated as a live poller.
- Award-path purchase orders keep existing `PO-` references via Issue PO. Intake LPOs use `PROC-DRAFT-*` then allocate `S #####` on submit.
- Sequence concurrency coverage is 25 sequential `lockForUpdate` allocations in one process, not 25 OS processes.
- Production issuance requires Administration to activate the live LPO sequence with the **real last legacy number**. The sample `S 04015` is never inferred.
- Invoice-first documents never silently backdate `lpo_date` to the supplier invoice date.

## Architecture

Intake → classify/extract → human confirm → supplier match → invoice-first decision → link/create `ProcurementRequest` → policy route → LPO draft (temporary ref) → allocate official number on submit → workflow → PDF issue → receipt → three-way match → Finance handover.

## Entities added

- `procurement_document_intakes` + lines (not a second requisition)
- `procurement_projects` (structured Forum / donor / programme projects)
- `procurement_exceptions`
- `service_confirmations`
- `purchase_order_revisions`
- LPO columns on existing `purchase_orders`

## State

Intake and LPO transitions are enforced server-side. Issued LPOs are immutable except via amend/void.
