# UAT Script - Supplier

Date: __________
Tester: __________
Environment: Staging / Pre-Prod

## Evidence
- Screenshot or recording attached: [ ]
- Defects logged with IDs: [ ]
- Retest evidence attached: [ ]

## Test Cases
- [ ] AUTH-001 (AUTH): Login with valid credentials
- [ ] AUTH-002 (AUTH): Login with invalid password
- [ ] AUTH-003 (AUTH): Login with inactive user
- [ ] AUTH-004 (AUTH): Login with locked account
- [ ] AUTH-005 (AUTH): First login forces password change
- [ ] AUTH-006 (AUTH): Password policy is enforced
- [ ] AUTH-007 (AUTH): Password reset works
- [ ] AUTH-008 (AUTH): Session timeout works
- [ ] AUTH-009 (AUTH): Refresh token/session renewal works
- [ ] AUTH-010 (AUTH): Logout invalidates session
- [ ] AUTH-011 (AUTH): Concurrent sessions follow policy
- [ ] AUTH-012 (AUTH): Direct URL access without login is blocked
- [ ] AUTH-013 (AUTH): API access without token is blocked
- [ ] AUTH-014 (AUTH): Expired token returns 401
- [ ] AUTH-015 (AUTH): Sensitive actions require step-up confirmation where configured
- [ ] PROC-001 (PROC): Create procurement request
- [ ] PROC-002 (PROC): Budget line required
- [ ] PROC-003 (PROC): Finance verifies budget availability
- [ ] PROC-004 (PROC): HOD approves request
- [ ] PROC-005 (PROC): Procurement officer receives request only after HOD approval
- [ ] PROC-006 (PROC): Threshold below N$10,000 follows approved supplier process
- [ ] PROC-007 (PROC): Threshold N$10,001-N$100,000 requires at least three quotations for goods
- [ ] PROC-008 (PROC): Services follow selective tender/sole-source rules where applicable
- [ ] PROC-009 (PROC): Above threshold triggers tender committee process
- [ ] PROC-010 (PROC): Purchase splitting detection works
- [ ] PROC-011 (PROC): Supplier list is searchable
- [ ] PROC-012 (PROC): Supplier performance rating visible to authorised users
- [ ] PROC-013 (PROC): Supplier self-registration works
- [ ] PROC-014 (PROC): Supplier access remains disabled until approved
- [ ] PROC-015 (PROC): Supplier sees only own RFQs, quotes, LPOs and invoices
- [ ] PROC-016 (PROC): External RFQ token opens public quotation page
- [ ] PROC-017 (PROC): Expired RFQ token blocked
- [ ] PROC-018 (PROC): Supplier submits quotation with attachments
- [ ] PROC-019 (PROC): Late quotation blocked or flagged
- [ ] PROC-020 (PROC): Evaluation committee scoring works
- [ ] PROC-021 (PROC): Conflict of interest declaration required
- [ ] PROC-022 (PROC): Award decision recorded
- [ ] PROC-023 (PROC): LPO generated only after approval
- [ ] PROC-024 (PROC): LPO cannot be edited after issue except by amendment workflow
- [ ] PROC-025 (PROC): Supplier receives LPO notification
- [ ] PROC-026 (PROC): GRN/service confirmation required before final payment
- [ ] PROC-027 (PROC): Proforma invoice uploaded
- [ ] PROC-028 (PROC): Finance approves proforma
- [ ] PROC-029 (PROC): Payment proof uploaded
- [ ] PROC-030 (PROC): Final invoice uploaded
- [ ] PROC-031 (PROC): Invoice lifecycle statuses work
- [ ] PROC-032 (PROC): Duplicate invoice number detection works
- [ ] PROC-033 (PROC): Invoice amount cannot exceed LPO without variation approval
- [ ] PROC-034 (PROC): Payment closure locks record
- [ ] PROC-035 (PROC): Complete procurement file export works
- [ ] PROC-036 (PROC): Audit trail includes all procurement decisions
- [ ] FILE-001 (FILE): Upload PDF
- [ ] FILE-002 (FILE): Upload DOCX
- [ ] FILE-003 (FILE): Upload image
- [ ] FILE-004 (FILE): Reject unsupported file
- [ ] FILE-005 (FILE): Reject oversized file
- [ ] FILE-006 (FILE): Virus/malware scan runs
- [ ] FILE-007 (FILE): File preview works
- [ ] FILE-008 (FILE): File download works
- [ ] FILE-009 (FILE): File access respects permissions
- [ ] FILE-010 (FILE): File cannot be replaced after approval without amendment
- [ ] FILE-011 (FILE): Generated PDF includes correct data
- [ ] FILE-012 (FILE): Generated PDF includes signature
- [ ] FILE-013 (FILE): Generated PDF includes approval history
- [ ] FILE-014 (FILE): Generated PDF includes reference number where required
- [ ] FILE-015 (FILE): Archived document remains retrievable
- [ ] FILE-016 (FILE): Broken file link returns controlled error

## Sign-off
- Module owner sign-off: ____________________
- QA lead sign-off: ____________________