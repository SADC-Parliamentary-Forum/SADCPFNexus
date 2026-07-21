# UAT Script - Line Manager / Head of Department

Date: __________
Tester: __________
Environment: Staging / Pre-Prod

## Evidence
- Screenshot or recording attached: [ ]
- Defects logged with IDs: [ ]
- Retest evidence attached: [ ]

## Test Cases
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
- [ ] TRAVEL-001 (TRAVEL): Create travel requisition
- [ ] TRAVEL-002 (TRAVEL): Capture traveller and mission details
- [ ] TRAVEL-003 (TRAVEL): Capture destination and travel dates
- [ ] TRAVEL-004 (TRAVEL): System calculates number of days
- [ ] TRAVEL-005 (TRAVEL): Funding agency, project and budget line required
- [ ] TRAVEL-006 (TRAVEL): Support documentation upload required where configured
- [ ] TRAVEL-007 (TRAVEL): Vehicle section appears only when vehicle is requested
- [ ] TRAVEL-008 (TRAVEL): Private vehicle reason required
- [ ] TRAVEL-009 (TRAVEL): Admin captures itinerary
- [ ] TRAVEL-010 (TRAVEL): Finance captures DSA rate
- [ ] TRAVEL-011 (TRAVEL): Finance calculates DSA total
- [ ] TRAVEL-012 (TRAVEL): System calculates terminal allowance/communication where configured
- [ ] TRAVEL-013 (TRAVEL): Director Finance confirms funds/logistics
- [ ] TRAVEL-014 (TRAVEL): SG approves travel
- [ ] TRAVEL-015 (TRAVEL): SG rejects travel
- [ ] TRAVEL-016 (TRAVEL): Traveller cannot approve own travel
- [ ] TRAVEL-017 (TRAVEL): Finance cannot approve before itinerary/logistics step
- [ ] TRAVEL-018 (TRAVEL): SG not notified before finance confirmation
- [ ] TRAVEL-019 (TRAVEL): Approved travel appears in calendar
- [ ] TRAVEL-020 (TRAVEL): Approved travel auto-fills timesheet/travel mission days
- [ ] TRAVEL-021 (TRAVEL): Travel mission appears in weekly summary
- [ ] TRAVEL-022 (TRAVEL): Post-travel retirement task is created
- [ ] TRAVEL-023 (TRAVEL): Retirement due date reminder is sent
- [ ] TRAVEL-024 (TRAVEL): Supporting invoices can be uploaded
- [ ] TRAVEL-025 (TRAVEL): Outstanding retirement appears on dashboard
- [ ] TRAVEL-026 (TRAVEL): PDF output matches official travel form
- [ ] TRAVEL-027 (TRAVEL): All calculations are reproducible
- [ ] TRAVEL-028 (TRAVEL): Audit trail records every transition
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