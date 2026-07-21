# UAT Script - Procurement Officer

Date: __________
Tester: __________
Environment: Staging / Pre-Prod

## Evidence
- Screenshot or recording attached: [ ]
- Defects logged with IDs: [ ]
- Retest evidence attached: [ ]

## Test Cases
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
- [ ] AUDIT-001 (AUDIT): Create action logged
- [ ] AUDIT-002 (AUDIT): Update action logged
- [ ] AUDIT-003 (AUDIT): Delete/archive action logged
- [ ] AUDIT-004 (AUDIT): Approval action logged
- [ ] AUDIT-005 (AUDIT): Rejection action logged
- [ ] AUDIT-006 (AUDIT): Return-for-correction logged
- [ ] AUDIT-007 (AUDIT): File upload logged
- [ ] AUDIT-008 (AUDIT): File download logged
- [ ] AUDIT-009 (AUDIT): Login/logout logged
- [ ] AUDIT-010 (AUDIT): Failed login logged
- [ ] AUDIT-011 (AUDIT): Permission failure logged
- [ ] AUDIT-012 (AUDIT): Audit log cannot be edited
- [ ] AUDIT-013 (AUDIT): Audit log cannot be deleted by normal admin
- [ ] AUDIT-014 (AUDIT): Hash-chain/integrity check passes if implemented
- [ ] AUDIT-015 (AUDIT): Audit export works
- [ ] AUDIT-016 (AUDIT): Internal auditor can view logs
- [ ] AUDIT-017 (AUDIT): Ordinary user cannot view system audit logs
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