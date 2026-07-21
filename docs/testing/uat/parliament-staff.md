# UAT Script - Parliament Staff

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
- [ ] MEET-001 (MEET): Create meeting
- [ ] MEET-002 (MEET): Select virtual, physical or hybrid
- [ ] MEET-003 (MEET): Form changes based on meeting type
- [ ] MEET-004 (MEET): Add agenda
- [ ] MEET-005 (MEET): Upload meeting documents
- [ ] MEET-006 (MEET): Assign documents to committees
- [ ] MEET-007 (MEET): Assign access to MPs, staff and stakeholders
- [ ] MEET-008 (MEET): Member can view authorised documents
- [ ] MEET-009 (MEET): Unauthorised member cannot view restricted documents
- [ ] MEET-010 (MEET): Document download is logged
- [ ] MEET-011 (MEET): Version replacement works
- [ ] MEET-012 (MEET): Old versions remain available to authorised roles
- [ ] MEET-013 (MEET): Meeting calendar displays correctly
- [ ] MEET-014 (MEET): Search works
- [ ] MEET-015 (MEET): Broken document links return controlled error, not 500
- [ ] MEET-016 (MEET): Mobile layout works
- [ ] MEET-017 (MEET): Offline/slow connection state works where applicable

## Sign-off
- Module owner sign-off: ____________________
- QA lead sign-off: ____________________