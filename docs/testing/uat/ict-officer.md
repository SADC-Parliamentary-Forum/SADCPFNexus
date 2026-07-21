# UAT Script - ICT Officer

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
- [ ] RBAC-001 (RBAC): Staff member sees only own requests
- [ ] RBAC-002 (RBAC): Line manager sees requests assigned to them
- [ ] RBAC-003 (RBAC): Finance sees finance-stage requests
- [ ] RBAC-004 (RBAC): HR sees HR/personnel workflows
- [ ] RBAC-005 (RBAC): Procurement sees procurement workflows
- [ ] RBAC-006 (RBAC): Supplier sees only supplier portal
- [ ] RBAC-007 (RBAC): Internal auditor has read-only access
- [ ] RBAC-008 (RBAC): System admin cannot silently bypass business approvals
- [ ] RBAC-009 (RBAC): Secretary General sees final approvals
- [ ] RBAC-010 (RBAC): Department data is isolated
- [ ] RBAC-011 (RBAC): Cross-department leakage is blocked
- [ ] RBAC-012 (RBAC): API permissions match UI permissions
- [ ] RBAC-013 (RBAC): Hidden UI button endpoint is still protected
- [ ] RBAC-014 (RBAC): Export permissions are enforced
- [ ] RBAC-015 (RBAC): Bulk actions respect permissions
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
- [ ] DB-001 (DB): Fresh migration succeeds
- [ ] DB-002 (DB): Seed data loads
- [ ] DB-003 (DB): Rollback works
- [ ] DB-004 (DB): Migration on existing data works
- [ ] DB-005 (DB): Foreign keys enforced
- [ ] DB-006 (DB): Unique constraints enforced
- [ ] DB-007 (DB): Soft delete works where applicable
- [ ] DB-008 (DB): Audit records persist
- [ ] DB-009 (DB): Workflow states valid
- [ ] DB-010 (DB): Transaction rollback works on failure
- [ ] DB-011 (DB): No orphan attachments
- [ ] DB-012 (DB): No orphan approvals
- [ ] DB-013 (DB): No orphan notifications
- [ ] DB-014 (DB): Backup completes
- [ ] DB-015 (DB): Restore completes
- [ ] DB-016 (DB): Restored system passes smoke tests

## Sign-off
- Module owner sign-off: ____________________
- QA lead sign-off: ____________________