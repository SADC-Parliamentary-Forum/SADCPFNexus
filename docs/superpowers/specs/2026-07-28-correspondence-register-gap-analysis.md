# Correspondence Register — Gap Analysis

**Date:** 2026-07-28  
**Baseline:** Existing ICRMS slice on `feat/table-multiselect-delete` (`35ec34c`)  
**PRD:** `2026-07-28-correspondence-register-prd.md` §144  
**Branch:** `feat/correspondence-register-phase1`

## Scorecard

| Capability (Phase 1) | Before | After |
|---|---|---|
| Incoming register + scan upload | PARTIAL (form → draft letter) | EXTENDED (registry lifecycle + immutable original) |
| Outgoing draft / review / approve / send | HAD | EXTENDED (SG gate, ref ledger, dispatch evidence) |
| Contacts / groups | HAD | HAD |
| Letterhead settings | HAD (system settings) | HAD + applied flag on record |
| Registry references | PARTIAL (outgoing only on approve) | ADDED configurable IN/OUT ledger, void retained |
| SG routing | MISSING | ADDED |
| Primary / supporting owners | MISSING | ADDED |
| Deadlines + notifications | MISSING | ADDED |
| Assignment linkage | MISSING | ADDED (link / create via Assignments module) |
| Digital signature (SAAM) | MISSING on corr | ADDED SignatureEvent morph + immutability |
| Dispatch + delivery evidence | PARTIAL (email send only) | ADDED dispatch records |
| Threading / relationships | MISSING | ADDED |
| Subject files + Master register | MISSING | ADDED (links, no triplicate copies) |
| Confidentiality + search ACL | MISSING | ADDED |
| Reports | PARTIAL (CSV export UI) | ADDED summary API |
| Audit | PARTIAL | EXTENDED |
| Mailbox ingestion / AI / mail merge | N/A Phase 2/3 | Deferred (nav stubs only) |

## Keep / extend (do not discard)

- `Correspondence` model + draft→review→approve→send flow
- Contacts / contact groups
- Existing web pages: overview, create, registry, incoming, contacts, letterhead, detail
- Permissions: `correspondence.view|create|review|approve|send|admin`
- Email dispatch job for digital channel

## Critical gaps closed this pass

1. Register tracks **responsibility/action**, not uploads alone  
2. Incoming → Registry → **SG routing** with primary owner  
3. Outgoing **cannot dispatch** without approval  
4. **Immutable** registered original + signed final  
5. **Unique refs**, voided numbers retained, never reused  
6. One document linked to Master Register + subject file(s)  
7. Internal notes excluded from external payload  
8. Confidentiality gates list/show/search/download  
