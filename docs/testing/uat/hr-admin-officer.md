# UAT Script - HR/Admin Officer

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
- [ ] PROFILE-001 (PROFILE): User logs in first time and sees setup screen
- [ ] PROFILE-002 (PROFILE): User updates profile fields where allowed
- [ ] PROFILE-003 (PROFILE): User uploads profile picture
- [ ] PROFILE-004 (PROFILE): User uploads signature
- [ ] PROFILE-005 (PROFILE): User uploads initials
- [ ] PROFILE-006 (PROFILE): Invalid image type is rejected
- [ ] PROFILE-007 (PROFILE): Oversized image is rejected
- [ ] PROFILE-008 (PROFILE): Cropping/preview works
- [ ] PROFILE-009 (PROFILE): User selects reporting line if not Secretary General
- [ ] PROFILE-010 (PROFILE): User cannot change own role/access level
- [ ] PROFILE-011 (PROFILE): HR/Admin can update role/access level
- [ ] PROFILE-012 (PROFILE): Signature appears correctly on approval documents
- [ ] PROFILE-013 (PROFILE): Replacing signature creates audit record
- [ ] PROFILE-014 (PROFILE): Old signature remains linked to historical approvals
- [ ] PROFILE-015 (PROFILE): Downloaded PDF shows correct signature used at approval time
- [ ] LEAVE-001 (LEAVE): Create annual leave request
- [ ] LEAVE-002 (LEAVE): Create sick leave request
- [ ] LEAVE-003 (LEAVE): Create compassionate leave request
- [ ] LEAVE-004 (LEAVE): Create study leave request
- [ ] LEAVE-005 (LEAVE): Create maternity/paternity leave request
- [ ] LEAVE-006 (LEAVE): Create leave in lieu of overtime
- [ ] LEAVE-007 (LEAVE): System calculates working days excluding weekends
- [ ] LEAVE-008 (LEAVE): System excludes public holidays
- [ ] LEAVE-009 (LEAVE): System prevents negative leave balance unless policy allows
- [ ] LEAVE-010 (LEAVE): System checks leave in lieu expiry rules
- [ ] LEAVE-011 (LEAVE): HOD recommends leave
- [ ] LEAVE-012 (LEAVE): HOD does not recommend leave and must provide reason
- [ ] LEAVE-013 (LEAVE): HR certifies accrued days, days taken and balance
- [ ] LEAVE-014 (LEAVE): SG authorises leave
- [ ] LEAVE-015 (LEAVE): SG declines leave with reason
- [ ] LEAVE-016 (LEAVE): Requester cannot approve own leave
- [ ] LEAVE-017 (LEAVE): HR cannot skip HOD recommendation
- [ ] LEAVE-018 (LEAVE): SG does not receive notification before HR certification
- [ ] LEAVE-019 (LEAVE): Approved leave auto-blocks timesheet days
- [ ] LEAVE-020 (LEAVE): Approved leave appears in calendar
- [ ] LEAVE-021 (LEAVE): Approved leave appears in weekly summary
- [ ] LEAVE-022 (LEAVE): Leave balance updates correctly
- [ ] LEAVE-023 (LEAVE): PDF output matches official leave form
- [ ] LEAVE-024 (LEAVE): Leave cancellation follows approval workflow
- [ ] LEAVE-025 (LEAVE): Leave amendment creates new approval trail
- [ ] LEAVE-026 (LEAVE): Overlapping leave request is blocked or warned
- [ ] LEAVE-027 (LEAVE): Leave for a past date follows configured policy
- [ ] LEAVE-028 (LEAVE): Attachment upload works for sick leave
- [ ] LEAVE-029 (LEAVE): Rejection restores leave balance
- [ ] LEAVE-030 (LEAVE): Audit log contains all actions
- [ ] TIME-001 (TIME): User creates daily timesheet
- [ ] TIME-002 (TIME): User breaks day into hours
- [ ] TIME-003 (TIME): Week view summarises days
- [ ] TIME-004 (TIME): Month view summarises weeks
- [ ] TIME-005 (TIME): Year view summarises months
- [ ] TIME-006 (TIME): Leave days auto-fill
- [ ] TIME-007 (TIME): Travel missions auto-fill
- [ ] TIME-008 (TIME): Public holidays auto-fill
- [ ] TIME-009 (TIME): Assigned tasks can be linked
- [ ] TIME-010 (TIME): Project/activity autocomplete works
- [ ] TIME-011 (TIME): General work can be captured
- [ ] TIME-012 (TIME): Total daily hours validation works
- [ ] TIME-013 (TIME): Future timesheets follow policy
- [ ] TIME-014 (TIME): Supervisor approval works
- [ ] TIME-015 (TIME): User cannot approve own timesheet
- [ ] TIME-016 (TIME): Returned timesheet can be corrected
- [ ] TIME-017 (TIME): Export to PDF/Excel works
- [ ] TIME-018 (TIME): Dashboard statistics match source entries
- [ ] TIME-019 (TIME): Audit trail complete
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

## Sign-off
- Module owner sign-off: ____________________
- QA lead sign-off: ____________________