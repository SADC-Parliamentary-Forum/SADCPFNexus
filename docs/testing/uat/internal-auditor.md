# UAT Script - Internal Auditor

Date: __________
Tester: __________
Environment: Staging / Pre-Prod

## Evidence
- Screenshot or recording attached: [ ]
- Defects logged with IDs: [ ]
- Retest evidence attached: [ ]

## Test Cases
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
- [ ] RISK-001 (RISK): Create risk
- [ ] RISK-002 (RISK): Assign risk owner
- [ ] RISK-003 (RISK): Capture inherent risk
- [ ] RISK-004 (RISK): Capture controls
- [ ] RISK-005 (RISK): Capture residual risk
- [ ] RISK-006 (RISK): Risk rating calculation works
- [ ] RISK-007 (RISK): Mitigation action created
- [ ] RISK-008 (RISK): Due date reminder works
- [ ] RISK-009 (RISK): Risk dashboard matches source data
- [ ] RISK-010 (RISK): Heat map values correct
- [ ] RISK-011 (RISK): Risk review workflow works
- [ ] RISK-012 (RISK): Internal auditor read-only access works
- [ ] RISK-013 (RISK): Export risk register works
- [ ] RISK-014 (RISK): Closed risks remain auditable
- [ ] WEEKLY-001 (WEEKLY): Weekly summary generated
- [ ] WEEKLY-002 (WEEKLY): User receives summary based on role
- [ ] WEEKLY-003 (WEEKLY): Staff sees own requests and actions
- [ ] WEEKLY-004 (WEEKLY): Manager sees team pending approvals
- [ ] WEEKLY-005 (WEEKLY): Finance sees finance pending items
- [ ] WEEKLY-006 (WEEKLY): SG sees institutional overview
- [ ] WEEKLY-007 (WEEKLY): Travel/leave absences included
- [ ] WEEKLY-008 (WEEKLY): Completed workflows included
- [ ] WEEKLY-009 (WEEKLY): Overdue tasks included
- [ ] WEEKLY-010 (WEEKLY): Confidential data excluded where role lacks access
- [ ] WEEKLY-011 (WEEKLY): Email links open correct records
- [ ] WEEKLY-012 (WEEKLY): No broken links in email
- [ ] WEEKLY-013 (WEEKLY): Email generation failure is retried and logged
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

## Sign-off
- Module owner sign-off: ____________________
- QA lead sign-off: ____________________