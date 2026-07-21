# SADC PF Nexus Production Readiness Test Catalog Source

## AUTH
| ID | Test |
| --- | --- |
| AUTH-001 | Login with valid credentials |
| AUTH-002 | Login with invalid password |
| AUTH-003 | Login with inactive user |
| AUTH-004 | Login with locked account |
| AUTH-005 | First login forces password change |
| AUTH-006 | Password policy is enforced |
| AUTH-007 | Password reset works |
| AUTH-008 | Session timeout works |
| AUTH-009 | Refresh token/session renewal works |
| AUTH-010 | Logout invalidates session |
| AUTH-011 | Concurrent sessions follow policy |
| AUTH-012 | Direct URL access without login is blocked |
| AUTH-013 | API access without token is blocked |
| AUTH-014 | Expired token returns 401 |
| AUTH-015 | Sensitive actions require step-up confirmation where configured |

## PROFILE
| ID | Test |
| --- | --- |
| PROFILE-001 | User logs in first time and sees setup screen |
| PROFILE-002 | User updates profile fields where allowed |
| PROFILE-003 | User uploads profile picture |
| PROFILE-004 | User uploads signature |
| PROFILE-005 | User uploads initials |
| PROFILE-006 | Invalid image type is rejected |
| PROFILE-007 | Oversized image is rejected |
| PROFILE-008 | Cropping/preview works |
| PROFILE-009 | User selects reporting line if not Secretary General |
| PROFILE-010 | User cannot change own role/access level |
| PROFILE-011 | HR/Admin can update role/access level |
| PROFILE-012 | Signature appears correctly on approval documents |
| PROFILE-013 | Replacing signature creates audit record |
| PROFILE-014 | Old signature remains linked to historical approvals |
| PROFILE-015 | Downloaded PDF shows correct signature used at approval time |

## RBAC
| ID | Test |
| --- | --- |
| RBAC-001 | Staff member sees only own requests |
| RBAC-002 | Line manager sees requests assigned to them |
| RBAC-003 | Finance sees finance-stage requests |
| RBAC-004 | HR sees HR/personnel workflows |
| RBAC-005 | Procurement sees procurement workflows |
| RBAC-006 | Supplier sees only supplier portal |
| RBAC-007 | Internal auditor has read-only access |
| RBAC-008 | System admin cannot silently bypass business approvals |
| RBAC-009 | Secretary General sees final approvals |
| RBAC-010 | Department data is isolated |
| RBAC-011 | Cross-department leakage is blocked |
| RBAC-012 | API permissions match UI permissions |
| RBAC-013 | Hidden UI button endpoint is still protected |
| RBAC-014 | Export permissions are enforced |
| RBAC-015 | Bulk actions respect permissions |

## LEAVE
| ID | Test |
| --- | --- |
| LEAVE-001 | Create annual leave request |
| LEAVE-002 | Create sick leave request |
| LEAVE-003 | Create compassionate leave request |
| LEAVE-004 | Create study leave request |
| LEAVE-005 | Create maternity/paternity leave request |
| LEAVE-006 | Create leave in lieu of overtime |
| LEAVE-007 | System calculates working days excluding weekends |
| LEAVE-008 | System excludes public holidays |
| LEAVE-009 | System prevents negative leave balance unless policy allows |
| LEAVE-010 | System checks leave in lieu expiry rules |
| LEAVE-011 | HOD recommends leave |
| LEAVE-012 | HOD does not recommend leave and must provide reason |
| LEAVE-013 | HR certifies accrued days, days taken and balance |
| LEAVE-014 | SG authorises leave |
| LEAVE-015 | SG declines leave with reason |
| LEAVE-016 | Requester cannot approve own leave |
| LEAVE-017 | HR cannot skip HOD recommendation |
| LEAVE-018 | SG does not receive notification before HR certification |
| LEAVE-019 | Approved leave auto-blocks timesheet days |
| LEAVE-020 | Approved leave appears in calendar |
| LEAVE-021 | Approved leave appears in weekly summary |
| LEAVE-022 | Leave balance updates correctly |
| LEAVE-023 | PDF output matches official leave form |
| LEAVE-024 | Leave cancellation follows approval workflow |
| LEAVE-025 | Leave amendment creates new approval trail |
| LEAVE-026 | Overlapping leave request is blocked or warned |
| LEAVE-027 | Leave for a past date follows configured policy |
| LEAVE-028 | Attachment upload works for sick leave |
| LEAVE-029 | Rejection restores leave balance |
| LEAVE-030 | Audit log contains all actions |

## ADV
| ID | Test |
| --- | --- |
| ADV-001 | Staff creates salary advance request |
| ADV-002 | Required fields are validated |
| ADV-003 | Amount cannot be zero or negative |
| ADV-004 | Amount format supports N$ |
| ADV-005 | Finance sees request only at finance stage |
| ADV-006 | Finance captures monthly salary |
| ADV-007 | Finance captures existing advance status |
| ADV-008 | System calculates whether request exceeds 50% of monthly salary |
| ADV-009 | Existing outstanding advance triggers warning or block based on policy |
| ADV-010 | Finance certifies request |
| ADV-011 | Finance rejects or returns request |
| ADV-012 | Final approver approves |
| ADV-013 | Final approver rejects with reason |
| ADV-014 | Requester cannot finance-certify own request |
| ADV-015 | Requester cannot finally approve own request |
| ADV-016 | Payroll deduction schedule is created |
| ADV-017 | Deduction date is captured |
| ADV-018 | Approved advance appears in finance dashboard |
| ADV-019 | Approved advance appears in employee record |
| ADV-020 | Repayment status can be updated by authorised officer |
| ADV-021 | Requester confirms repayment/advance record where required |
| ADV-022 | Full audit trail is created |
| ADV-023 | PDF output matches official salary advance form |
| ADV-024 | Rejected request does not create payroll deduction |
| ADV-025 | Duplicate salary advance request detection works |

## TRAVEL
| ID | Test |
| --- | --- |
| TRAVEL-001 | Create travel requisition |
| TRAVEL-002 | Capture traveller and mission details |
| TRAVEL-003 | Capture destination and travel dates |
| TRAVEL-004 | System calculates number of days |
| TRAVEL-005 | Funding agency, project and budget line required |
| TRAVEL-006 | Support documentation upload required where configured |
| TRAVEL-007 | Vehicle section appears only when vehicle is requested |
| TRAVEL-008 | Private vehicle reason required |
| TRAVEL-009 | Admin captures itinerary |
| TRAVEL-010 | Finance captures DSA rate |
| TRAVEL-011 | Finance calculates DSA total |
| TRAVEL-012 | System calculates terminal allowance/communication where configured |
| TRAVEL-013 | Director Finance confirms funds/logistics |
| TRAVEL-014 | SG approves travel |
| TRAVEL-015 | SG rejects travel |
| TRAVEL-016 | Traveller cannot approve own travel |
| TRAVEL-017 | Finance cannot approve before itinerary/logistics step |
| TRAVEL-018 | SG not notified before finance confirmation |
| TRAVEL-019 | Approved travel appears in calendar |
| TRAVEL-020 | Approved travel auto-fills timesheet/travel mission days |
| TRAVEL-021 | Travel mission appears in weekly summary |
| TRAVEL-022 | Post-travel retirement task is created |
| TRAVEL-023 | Retirement due date reminder is sent |
| TRAVEL-024 | Supporting invoices can be uploaded |
| TRAVEL-025 | Outstanding retirement appears on dashboard |
| TRAVEL-026 | PDF output matches official travel form |
| TRAVEL-027 | All calculations are reproducible |
| TRAVEL-028 | Audit trail records every transition |

## PIF
| ID | Test |
| --- | --- |
| PIF-001 | Create programme implementation request |
| PIF-002 | Required general information fields validate |
| PIF-003 | Proposed venue fields validate |
| PIF-004 | Accommodation/conferencing fields calculate numbers |
| PIF-005 | DSA rate variance reason required where applicable |
| PIF-006 | Participant number variance reason required |
| PIF-007 | Consultant/resource person rates validate |
| PIF-008 | Interpreter language pairs validate |
| PIF-009 | Documentation translation requirements captured |
| PIF-010 | Support services captured |
| PIF-011 | Arrival/departure details captured |
| PIF-012 | Conflict of interest declaration required |
| PIF-013 | Programme Manager signs |
| PIF-014 | Activity authorised by correct role |
| PIF-015 | Finance confirms budget line and availability of funds |
| PIF-016 | Director Finance authorises funds, procurement and rates |
| PIF-017 | SG approves |
| PIF-018 | Logistics cannot proceed before approval |
| PIF-019 | PIF cannot skip budget confirmation |
| PIF-020 | SG receives notification only after Director Finance step |
| PIF-021 | Requester cannot approve own PIF |
| PIF-022 | Approved PIF generates PDF |
| PIF-023 | Final approved PIF and support docs stored in correct folder |
| PIF-024 | Relevant officers receive automatic email |
| PIF-025 | Activity appears on programme dashboard |
| PIF-026 | Activity appears in weekly summary |
| PIF-027 | Audit log records all stages |
| PIF-028 | Returned PIF preserves comments and version history |

## PROC
| ID | Test |
| --- | --- |
| PROC-001 | Create procurement request |
| PROC-002 | Budget line required |
| PROC-003 | Finance verifies budget availability |
| PROC-004 | HOD approves request |
| PROC-005 | Procurement officer receives request only after HOD approval |
| PROC-006 | Threshold below N$10,000 follows approved supplier process |
| PROC-007 | Threshold N$10,001-N$100,000 requires at least three quotations for goods |
| PROC-008 | Services follow selective tender/sole-source rules where applicable |
| PROC-009 | Above threshold triggers tender committee process |
| PROC-010 | Purchase splitting detection works |
| PROC-011 | Supplier list is searchable |
| PROC-012 | Supplier performance rating visible to authorised users |
| PROC-013 | Supplier self-registration works |
| PROC-014 | Supplier access remains disabled until approved |
| PROC-015 | Supplier sees only own RFQs, quotes, LPOs and invoices |
| PROC-016 | External RFQ token opens public quotation page |
| PROC-017 | Expired RFQ token blocked |
| PROC-018 | Supplier submits quotation with attachments |
| PROC-019 | Late quotation blocked or flagged |
| PROC-020 | Evaluation committee scoring works |
| PROC-021 | Conflict of interest declaration required |
| PROC-022 | Award decision recorded |
| PROC-023 | LPO generated only after approval |
| PROC-024 | LPO cannot be edited after issue except by amendment workflow |
| PROC-025 | Supplier receives LPO notification |
| PROC-026 | GRN/service confirmation required before final payment |
| PROC-027 | Proforma invoice uploaded |
| PROC-028 | Finance approves proforma |
| PROC-029 | Payment proof uploaded |
| PROC-030 | Final invoice uploaded |
| PROC-031 | Invoice lifecycle statuses work |
| PROC-032 | Duplicate invoice number detection works |
| PROC-033 | Invoice amount cannot exceed LPO without variation approval |
| PROC-034 | Payment closure locks record |
| PROC-035 | Complete procurement file export works |
| PROC-036 | Audit trail includes all procurement decisions |

## REIMB
| ID | Test |
| --- | --- |
| REIMB-001 | Create reimbursement claim |
| REIMB-002 | Attach receipts |
| REIMB-003 | Expense category validation works |
| REIMB-004 | Claim cannot exceed approved amount without reason |
| REIMB-005 | Finance checks supporting documents |
| REIMB-006 | Missing receipt triggers return-for-correction |
| REIMB-007 | Approved reimbursement appears in finance dashboard |
| REIMB-008 | Retirement of travel advance reconciles against amount advanced |
| REIMB-009 | Balance payable/refundable is calculated |
| REIMB-010 | Outstanding retirement flagged |
| REIMB-011 | Audit history complete |

## TIME
| ID | Test |
| --- | --- |
| TIME-001 | User creates daily timesheet |
| TIME-002 | User breaks day into hours |
| TIME-003 | Week view summarises days |
| TIME-004 | Month view summarises weeks |
| TIME-005 | Year view summarises months |
| TIME-006 | Leave days auto-fill |
| TIME-007 | Travel missions auto-fill |
| TIME-008 | Public holidays auto-fill |
| TIME-009 | Assigned tasks can be linked |
| TIME-010 | Project/activity autocomplete works |
| TIME-011 | General work can be captured |
| TIME-012 | Total daily hours validation works |
| TIME-013 | Future timesheets follow policy |
| TIME-014 | Supervisor approval works |
| TIME-015 | User cannot approve own timesheet |
| TIME-016 | Returned timesheet can be corrected |
| TIME-017 | Export to PDF/Excel works |
| TIME-018 | Dashboard statistics match source entries |
| TIME-019 | Audit trail complete |

## CORR
| ID | Test |
| --- | --- |
| CORR-001 | Create outgoing correspondence record |
| CORR-002 | Upload signed letter |
| CORR-003 | Generate reference number |
| CORR-004 | Reference number is unique |
| CORR-005 | Reference number follows configured format |
| CORR-006 | Select contact category |
| CORR-007 | Select recipients |
| CORR-008 | Approval required before sending |
| CORR-009 | Letter cannot be sent without approval |
| CORR-010 | Email sending works |
| CORR-011 | Delivery status recorded |
| CORR-012 | Attachments preserved |
| CORR-013 | Master file copy created |
| CORR-014 | Subject file copy created |
| CORR-015 | Search by reference works |
| CORR-016 | Audit trail complete |

## MEET
| ID | Test |
| --- | --- |
| MEET-001 | Create meeting |
| MEET-002 | Select virtual, physical or hybrid |
| MEET-003 | Form changes based on meeting type |
| MEET-004 | Add agenda |
| MEET-005 | Upload meeting documents |
| MEET-006 | Assign documents to committees |
| MEET-007 | Assign access to MPs, staff and stakeholders |
| MEET-008 | Member can view authorised documents |
| MEET-009 | Unauthorised member cannot view restricted documents |
| MEET-010 | Document download is logged |
| MEET-011 | Version replacement works |
| MEET-012 | Old versions remain available to authorised roles |
| MEET-013 | Meeting calendar displays correctly |
| MEET-014 | Search works |
| MEET-015 | Broken document links return controlled error, not 500 |
| MEET-016 | Mobile layout works |
| MEET-017 | Offline/slow connection state works where applicable |

## RISK
| ID | Test |
| --- | --- |
| RISK-001 | Create risk |
| RISK-002 | Assign risk owner |
| RISK-003 | Capture inherent risk |
| RISK-004 | Capture controls |
| RISK-005 | Capture residual risk |
| RISK-006 | Risk rating calculation works |
| RISK-007 | Mitigation action created |
| RISK-008 | Due date reminder works |
| RISK-009 | Risk dashboard matches source data |
| RISK-010 | Heat map values correct |
| RISK-011 | Risk review workflow works |
| RISK-012 | Internal auditor read-only access works |
| RISK-013 | Export risk register works |
| RISK-014 | Closed risks remain auditable |

## WEEKLY
| ID | Test |
| --- | --- |
| WEEKLY-001 | Weekly summary generated |
| WEEKLY-002 | User receives summary based on role |
| WEEKLY-003 | Staff sees own requests and actions |
| WEEKLY-004 | Manager sees team pending approvals |
| WEEKLY-005 | Finance sees finance pending items |
| WEEKLY-006 | SG sees institutional overview |
| WEEKLY-007 | Travel/leave absences included |
| WEEKLY-008 | Completed workflows included |
| WEEKLY-009 | Overdue tasks included |
| WEEKLY-010 | Confidential data excluded where role lacks access |
| WEEKLY-011 | Email links open correct records |
| WEEKLY-012 | No broken links in email |
| WEEKLY-013 | Email generation failure is retried and logged |

## AUDIT
| ID | Test |
| --- | --- |
| AUDIT-001 | Create action logged |
| AUDIT-002 | Update action logged |
| AUDIT-003 | Delete/archive action logged |
| AUDIT-004 | Approval action logged |
| AUDIT-005 | Rejection action logged |
| AUDIT-006 | Return-for-correction logged |
| AUDIT-007 | File upload logged |
| AUDIT-008 | File download logged |
| AUDIT-009 | Login/logout logged |
| AUDIT-010 | Failed login logged |
| AUDIT-011 | Permission failure logged |
| AUDIT-012 | Audit log cannot be edited |
| AUDIT-013 | Audit log cannot be deleted by normal admin |
| AUDIT-014 | Hash-chain/integrity check passes if implemented |
| AUDIT-015 | Audit export works |
| AUDIT-016 | Internal auditor can view logs |
| AUDIT-017 | Ordinary user cannot view system audit logs |

## FILE
| ID | Test |
| --- | --- |
| FILE-001 | Upload PDF |
| FILE-002 | Upload DOCX |
| FILE-003 | Upload image |
| FILE-004 | Reject unsupported file |
| FILE-005 | Reject oversized file |
| FILE-006 | Virus/malware scan runs |
| FILE-007 | File preview works |
| FILE-008 | File download works |
| FILE-009 | File access respects permissions |
| FILE-010 | File cannot be replaced after approval without amendment |
| FILE-011 | Generated PDF includes correct data |
| FILE-012 | Generated PDF includes signature |
| FILE-013 | Generated PDF includes approval history |
| FILE-014 | Generated PDF includes reference number where required |
| FILE-015 | Archived document remains retrievable |
| FILE-016 | Broken file link returns controlled error |

## DB
| ID | Test |
| --- | --- |
| DB-001 | Fresh migration succeeds |
| DB-002 | Seed data loads |
| DB-003 | Rollback works |
| DB-004 | Migration on existing data works |
| DB-005 | Foreign keys enforced |
| DB-006 | Unique constraints enforced |
| DB-007 | Soft delete works where applicable |
| DB-008 | Audit records persist |
| DB-009 | Workflow states valid |
| DB-010 | Transaction rollback works on failure |
| DB-011 | No orphan attachments |
| DB-012 | No orphan approvals |
| DB-013 | No orphan notifications |
| DB-014 | Backup completes |
| DB-015 | Restore completes |
| DB-016 | Restored system passes smoke tests |
