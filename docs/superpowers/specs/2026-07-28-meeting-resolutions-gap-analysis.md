# Meeting Resolutions / Decision Register — Gap Analysis

**Date:** 2026-07-28

| Capability | Current | Phase 1 |
|---|---|---|
| Meeting Minutes + action items | Present | Keep; fix Assignment path |
| Formal decision register | Missing (legacy GovernanceResolution is docs-only) | **Build** `meeting_decisions` |
| Unique auto refs | Missing | `DEC/YYYY/#####` |
| Status lifecycle + audit | Missing | Immutable history |
| Owner / due date | Only on minute actions | On decisions + actions |
| Assignments `from-source` | Allow-list has minutes/action_item; minutes bypasses service | Add `meeting_decision`; use service |
| Confidentiality | Missing for decisions | Column + filter + redaction |
| Permissions | `governance.*` only | `decisions.*` |
| Dashboard / notifications / UI | Missing | Phase 1 included |
| Weekly / Risk promote | Deferred in weekly PRD | Optional source_* hooks only |
