# Fixed Asset Register & Asset Lifecycle Management — PRD

**System:** SADC PF Nexus  
**Module:** Fixed Assets  
**Document status:** Updated Implementation PRD (authoritative)  
**Saved:** 2026-07-27  

---


The next module should be **Fixed Asset Register / Asset Lifecycle Management**.
This follows directly from the demo decision that **Fixed Assets and Consumables/Stock must be separate modules**. The Fixed Asset module should manage durable institutional assets from acquisition to disposal; the next module after this will manage consumables, stores, stock-in/stock-out and reorder levels.
The SADC PF Accounting Manual already requires a fixed asset register, asset tagging, inventory verification, recording of assets acquired from both SADC PF funds and grants, and a separate inventory for lower-value items that are expensed but have useful lives exceeding one year. It currently defines fixed-asset criteria around useful life, measurable cost and a US$250 threshold, and prescribes straight-line depreciation by asset category.  The register itself is expected to capture description, asset number, serial number, acquisition date, cost, funding source, useful life, depreciation, book value and location. 
The Manual also requires capital purchases to relate to the approved capital budget and obtain Finance clearance before commitments are made; disposal requires a documented recommendation, justification, asset details and updating of the register/accounting records. 
# Fixed Asset Register & Asset Lifecycle Management Module
## Full Updated Product Requirements Document
**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Fixed Assets
**Short name:** Assets
**Document status:** Updated Implementation PRD
**Saved:** 2026-07-27 (from user-provided PRD)

---
# 1. Executive Summary
The Fixed Asset Module will provide SADC PF with a central, auditable register of institutional assets.
It must manage the full lifecycle:
**Capital Budget → Procurement → Receipt → Asset Classification → Registration → Tagging → Assignment → Use → Transfer → Verification → Maintenance → Depreciation → Impairment/Loss → Disposal → Accounting Closure**
The system must answer:
* What assets does SADC PF own?
* Where is each asset?
* Who currently has custody?
* Who purchased it?
* Which supplier supplied it?
* Which procurement and PO produced it?
* Which donor or funding source paid for it?
* What did it cost?
* What is its serial number?
* What is its asset tag?
* What condition is it in?
* Is it insured?
* Is it under warranty?
* When was it last physically verified?
* Has it moved?
* Has it been repaired?
* Is it still economically usable?
* Has it been disposed?
* Who authorised the disposal?
* What was received from disposal?
* What is its current accounting/book value?
---
# 2. Critical Demo Decision
The system must maintain **two separate operational concepts**:
### Fixed Asset / Controlled Asset Register
Durable items with an identifiable lifecycle.
Examples:
* laptops;
* desktops;
* servers;
* printers;
* cameras;
* projectors;
* furniture;
* vehicles;
* networking equipment;
* appliances;
* office equipment.
### Consumables / Stock Register
Items consumed through ordinary operations.
Examples:
* paper;
* toner;
* stationery;
* cleaning materials;
* conference consumables;
* printer cartridges;
* small regularly issued supplies.
Consumables must **not** be represented as fixed assets.
The next PRD will cover Stock and Consumables separately.
---
# 3. Asset Classification Principle
The system must support at least three classes:
### 3.1 Capital Asset
An item meeting the formally configured capitalisation requirements.
### 3.2 Controlled Non-Capital Asset
An item below the capitalisation threshold but:
* having a useful life exceeding one year;
* requiring custody control;
* having a serial number;
* presenting theft/loss risk;
* being operationally significant.
Examples:
* lower-value tablets;
* calculators;
* small electronic equipment;
* tools.
The Accounting Manual explicitly anticipates a separate inventory for items written off in the year of purchase but having useful lives longer than one year. 
### 3.3 Consumable
Sent to the separate Stock/Consumables module.
---
# 4. Capitalisation Policy
The Accounting Manual currently refers to items:
* worth more than US$250;
* with useful life exceeding one year;
* whose cost can be measured reliably;
as fixed-asset criteria. 
However, Nexus must **not hard-code US$250 permanently**.
Create a versioned:
**Asset Capitalisation Policy**
Fields:
* policy version;
* effective date;
* threshold amount;
* threshold currency;
* useful-life requirement;
* categories affected;
* donor-specific treatment;
* approved by;
* source policy/document;
* active/inactive.
Historical assets must remain governed by the policy applicable at acquisition.
---
# 5. Module Navigation
Main Menu → **Fixed Assets**
Recommended submenus:
* Asset Dashboard
* Asset Register
* Asset Intake
* Pending Registration
* Asset Tags
* My Assigned Assets
* Department Assets
* Asset Transfers
* Temporary Asset Loans
* Maintenance
* Warranty
* Physical Verification
* Asset Exceptions
* Lost / Stolen / Damaged
* Insurance
* Depreciation
* Assets Due for Replacement
* Disposal Requests
* Disposal Register
* Donated / Grant Assets
* Reports
* Asset Settings
---
# 6. Primary Roles
Roles include:
* Asset Officer
* Administration Officer
* HR / Asset Management Officer
* Finance Officer
* Accountant
* Director Finance and Corporate Services
* Department Head
* Asset Custodian
* Employee
* ICT Officer
* Fleet/Transport Officer
* Procurement Officer
* Internal Auditor
* External Audit Read-Only User
* Secretary General
* System Administrator
---
# 7. Ownership vs Custody
These concepts must not be confused.
### Owner
Normally:
**SADC Parliamentary Forum**
or other legally relevant owner where donor arrangements require different treatment.
### Funding Source
Examples:
* SADC PF Core Budget
* Sida
* GIZ
* Other Donor
### Custodian
Person or organisational unit responsible for the asset.
Examples:
* employee;
* department;
* office;
* shared resource pool;
* meeting room;
* warehouse/store;
* official residence.
An employee being assigned a laptop does **not** mean the employee owns it.
---
# 8. Asset Lifecycle Statuses
Recommended statuses:
* Procurement Pending
* Received
* Pending Classification
* Pending Registration
* Registered
* Tagged
* Available
* Assigned
* Shared Use
* In Transit
* Temporarily Loaned
* Under Maintenance
* Under Warranty Repair
* Damaged
* Missing
* Lost
* Stolen
* Under Investigation
* Retired from Service
* Pending Disposal
* Disposal Approved
* Sold
* Donated
* Scrapped
* Written Off
* Disposed
* Archived
Statuses must have controlled transitions.
---
# 9. Procurement Integration
Fixed assets should normally enter Nexus through completed Procurement.
After goods receipt, Procurement identifies an item as:
* Capital Asset Candidate
* Controlled Asset Candidate
* Stock/Consumable
For an asset candidate, Procurement creates:
**Asset Intake Record**
Data should be reused automatically.
---
# 10. Procurement Data Reused
Prefill:
* Procurement reference
* PO number
* Supplier
* Supplier invoice
* GRN
* Item description
* Manufacturer
* Model
* Quantity
* Unit cost
* Total cost
* Currency
* Purchase date
* Delivery date
* Funding source
* Donor
* Budget line
* Project
* Warranty details
* Serial numbers where captured
* Receiving officer
* Delivery location
No retyping where existing data is available.
---
# 11. Multiple Assets from One Procurement Item
Example:
PO:
> 20 Dell laptops
Procurement item quantity:
20
Asset Intake must create:
**20 individual asset records**
because each laptop requires:
* unique asset ID;
* serial number;
* asset tag;
* custodian;
* location;
* condition;
* lifecycle.
A single record with quantity `20` is insufficient for individually controlled assets.
---
# 12. Bulk Asset Registration
For large purchases, support:
* bulk create;
* CSV import;
* serial-number scanning;
* barcode entry;
* automatic asset-tag generation;
* mass category assignment;
* mass funding/source assignment.
Each resulting asset must still have its own stable ID.
---
# 13. Asset Master Record
Every asset should contain:
### Identity
* Asset ID
* Asset tag
* Asset description
* Asset class
* Asset category
* Asset subcategory
* Manufacturer
* Make
* Model
* Serial number
* Other manufacturer identifier
### Acquisition
* Acquisition date
* Delivery date
* Purchase cost
* Currency
* Reporting currency cost
* Supplier
* Procurement reference
* PO
* Invoice
* GRN
### Funding
* Funding source
* Donor/project
* Budget line
* Capital budget reference
### Accounting
* Capitalisation status
* Capitalisation date
* Useful life
* Depreciation method
* Depreciation rate
* Accumulated depreciation
* Current book value
* Residual value
* Impairment status
### Custody
* Assigned user
* Department
* Physical location
* Building
* Room
* Custodian
* Assignment date
### Lifecycle
* Condition
* Warranty
* Insurance
* Last verification
* Next verification
* Maintenance status
* Replacement due date
* Disposal status
---
# 14. Asset Register Required Fields
The SADC PF Accounting Manual specifically identifies:
* asset description;
* asset number;
* serial number;
* acquisition date;
* asset cost;
* source of funding;
* useful economic life;
* depreciation;
* current book value;
* location. 
Nexus must include all of these as minimum mandatory register capabilities.
---
# 15. Asset Categories
Default configurable categories should include:
* Buildings
* Motor Vehicles
* Computer Equipment
* Servers
* Network Equipment
* Office Equipment
* Office Furniture
* Office Fittings
* Staff House Furniture
* Audio-Visual Equipment
* Communications Equipment
* Security Equipment
* Power Equipment
* Conference Equipment
* Other Equipment
* Controlled Non-Capital Equipment
* Other
Categories must be administratively configurable.
---
# 16. Depreciation
The existing Accounting Manual requires straight-line depreciation and currently specifies rates including:
* Buildings — 2%
* Motor Vehicles — 20%
* Computers — 25%
* Office Equipment — 25%
* Office Furniture and Fittings — 25%
* Staff House Furniture and Fittings — 25%
* Other Equipment — 25%. 
These must be configured in a versioned asset-accounting policy rather than hard-coded forever.
---
# 17. Depreciation Authority
Nexus may calculate depreciation for:
* asset monitoring;
* reports;
* replacement planning;
* reconciliation.
But the official accounting system remains authoritative for financial-statement postings.
Nexus should support:
**Fixed Asset Register depreciation**
and
**Accounting-system depreciation reference**
with reconciliation between them.
---
# 18. Depreciation Fields
Per asset:
* depreciation method;
* rate;
* useful life;
* commencement date;
* opening accumulated depreciation;
* current-period depreciation;
* accumulated depreciation;
* book value;
* accounting reference;
* last depreciation run.
---
# 19. Depreciation Run
Finance should be able to run:
* monthly;
* quarterly;
* annual;
depreciation calculations.
Process:
1. Select period.
2. Preview assets.
3. Identify exceptions.
4. Calculate.
5. Finance reviews.
6. Lock approved calculation.
7. Export/post reference to Accounting.
Calculations must be reproducible.
---
# 20. Asset Tagging
The Accounting Manual requires asset tag numbers based on asset class and chronological asset number, giving an example such as `PF/MV/015`. 
Nexus must support configurable tag patterns.
Example:
`PF/IT/00482`
or
`SADCPF/ICT/LAP/00482`
---
# 21. Tag Generation
Asset tags should be generated automatically.
Pattern components may include:
* organisation code;
* category;
* subcategory;
* year;
* sequence;
* location.
Example:
`PF/ICT/LAP/2026/0048`
Once assigned, the asset tag must not be reused for another asset.
---
# 22. QR Code / Barcode
Each physical asset should optionally receive:
* QR code;
* barcode;
* human-readable asset tag.
Scanning should open the authorised asset record.
QR/barcode may contain:
* opaque asset UUID;
  or
* secure asset lookup reference.
Do **not** encode confidential financial information directly into the QR code.
---
# 23. Tag Printing
Nexus should support label-sheet or individual-label printing.
Information:
* SADC PF
* Asset tag
* Barcode/QR
* Optional category
* Optional ownership text such as:
  * Property of SADC Parliamentary Forum
Labels should be durable where appropriate.
---
# 24. Tag Replacement
If a label is damaged:
* old tag number remains the asset identity;
* replacement label generated;
* replacement action audited.
Never create a new asset simply because the physical label was replaced.
---
# 25. Serial Number Uniqueness
Where serial numbers are available:
* detect duplicates;
* warn on duplicate serial;
* prevent accidental duplicate asset creation.
Some asset types legitimately lack serial numbers.
Such assets require:
* asset tag;
* description;
* location;
* other identifying details.
---
# 26. Asset Receipt
Asset receiving process:
1. Procurement/PO exists.
2. Goods delivered.
3. GRN recorded.
4. Asset candidate identified.
5. Serial numbers captured.
6. Condition inspected.
7. Asset Intake created.
8. Asset Officer verifies classification.
9. Asset records created.
10. Tags printed/applied.
11. Custody assigned.
12. Register activated.
---
# 27. Condition at Receipt
Possible values:
* New
* Excellent
* Good
* Fair
* Damaged on Delivery
* Refurbished
* Used
* Other
Damage on receipt must link back to Procurement/Supplier performance where appropriate.
---
# 28. Supplier Link
Asset record should display:
* supplier;
* supplier performance profile;
* procurement;
* purchase order;
* warranty contact.
Asset maintenance problems may feed Supplier Performance where relevant.
---
# 29. Donated / Grant Assets
The Accounting Manual requires material assets received through grants to be recorded in the asset records. 
Nexus must support acquisition methods:
* Purchase
* Donation
* Grant
* Transfer
* Opening/Migrated Asset
* Other
---
# 30. Donated Asset Fields
For donated/grant assets:
* Donor
* Grant/project
* Donation date
* Estimated/fair value
* Valuation basis
* Original currency
* Conditions/restrictions
* Ownership-transfer terms
* Supporting agreement
* Donor asset identifier
* Disposal restrictions
* Reporting requirement
---
# 31. Donor Asset Restrictions
Some donor-funded assets may have restrictions on:
* transfer;
* use;
* location;
* disposal;
* ownership after project completion.
The asset must show these restrictions.
Disposal workflow must check them automatically.
---
# 32. Asset Assignment
Assets may be assigned to:
* Employee
* Department
* Office
* Meeting room
* Vehicle
* Official residence
* Shared pool
* Storage
Assignment requires:
* custodian;
* location;
* assignment date;
* condition;
* accessories;
* acknowledgement.
---
# 33. Employee Asset Acknowledgement
When an individually assigned asset is issued:
Employee should confirm:
> I acknowledge receipt and custody of the listed SADC PF asset(s).
Record:
* asset;
* employee;
* date;
* condition;
* accessories;
* issued by;
* employee acknowledgement;
* comments.
Digital acknowledgement is preferred.
---
# 34. My Assets
Employee profile should show:
**My Assigned Assets**
Examples:
* Laptop PF/ICT/142
* Monitor PF/ICT/231
* Mobile Phone PF/COM/016
* Office Chair PF/FUR/097
Employee may:
* view;
* report damage;
* request transfer;
* report loss;
* return asset.
Employee may not change official asset data.
---
# 35. Employee Profile Integration
User Profiles should display authorised asset assignments.
This supports:
* onboarding;
* transfers;
* offboarding;
* audit;
* accountability.
---
# 36. Staff Residence Assets
The Administrative Rules reference an inventory of SADC PF furniture in a residence where applicable as part of employee records. 
The asset module should therefore support:
* official residence;
* room;
* resident employee;
* furniture/equipment inventory;
* condition;
* check-in;
* check-out;
* inspection.
---
# 37. Asset Transfer
Transfers may occur between:
* employees;
* departments;
* rooms;
* buildings;
* projects;
* storage locations.
Transfer request:
* Asset
* Current custodian
* New custodian
* Current location
* New location
* Reason
* Requested by
* Approved by
* Handover date
* Condition
* Acknowledgement
---
# 38. Transfer Workflow
Recommended:
1. Transfer requested.
2. Current custodian confirms release.
3. Asset Officer approves/records.
4. New custodian confirms receipt.
5. Register updates.
6. History preserved.
For simple room moves, fewer stages may be configurable.
---
# 39. Asset Location History
Never overwrite location without keeping history.
Maintain:
* location;
* from date;
* to date;
* moved by;
* reason.
Auditor should be able to reconstruct where an asset was at any point in time.
---
# 40. Asset Custody History
Similarly retain:
* custodian;
* assignment date;
* return date;
* condition at issue;
* condition at return.
---
# 41. Temporary Asset Loan
Support short-term loan of shared equipment.
Examples:
* projector;
* camera;
* portable PA;
* laptop;
* mobile router;
* conference equipment.
Fields:
* borrower;
* purpose;
* issue date/time;
* expected return;
* actual return;
* condition;
* accessories;
* issuing officer.
---
# 42. Temporary Loan Alerts
Notify:
* borrower before due;
* borrower when overdue;
* Asset Officer when overdue.
An overdue loan must not change asset ownership.
---
# 43. Asset Accessories
Assets may contain related components.
Example laptop:
* charger;
* docking station;
* bag;
* mouse.
Options:
* accessory field on assignment;
  or
* separate controlled asset records when valuable.
Do not create unnecessary asset records for trivial consumables.
---
# 44. Physical Verification
The Accounting Manual requires the Administration Officer to conduct a complete inventory and reconcile it with the Fixed Asset Register. Significant discrepancies must be reported. 
Nexus must provide a formal:
**Asset Verification Campaign**
---
# 45. Verification Campaign
Fields:
* campaign name;
* financial year;
* scope;
* departments;
* locations;
* start date;
* completion deadline;
* verification team;
* status.
Example:
**2026/27 Annual Fixed Asset Verification**
---
# 46. Verification Method
Verifier may:
* scan QR/barcode;
* enter asset tag;
* search manually.
Capture:
* asset found;
* current location;
* custodian;
* physical condition;
* serial confirmed;
* tag present;
* discrepancies;
* photo where useful;
* verifier;
* timestamp.
---
# 47. Verification Statuses
Per asset:
* Not Yet Checked
* Verified
* Verified with Difference
* Wrong Location
* Wrong Custodian
* Tag Missing
* Serial Mismatch
* Damaged
* Not Found
* Duplicate Record Suspected
* Unregistered Asset Found
* Under Investigation
---
# 48. Unregistered Assets
During stocktake, if a physical asset exists but Nexus has no record:
create:
**Unregistered Asset Exception**
Fields:
* temporary reference;
* description;
* serial;
* location;
* custodian;
* photo;
* suspected source;
* verifier.
It must be investigated before registration.
---
# 49. Missing Assets
If registered asset cannot be found:
Status:
**Missing — Investigation Required**
Do not immediately write it off.
Workflow:
1. Missing detected.
2. Custodian notified.
3. Search/investigation.
4. Supervisor/Admin review.
5. Resolve as:
   * Found
   * Transferred without record
   * Lost
   * Stolen
   * Disposal not recorded
   * Other.
---
# 50. Asset Discrepancy Register
Central queue for:
* missing assets;
* tag mismatch;
* location mismatch;
* serial mismatch;
* duplicate;
* unregistered assets;
* damaged assets.
Each requires:
* owner;
* due date;
* investigation;
* resolution.
---
# 51. Lost Asset
Record:
* asset;
* custodian;
* date discovered;
* last known location;
* circumstances;
* supervisor report;
* investigation;
* value;
* insurance status;
* liability determination where applicable;
* decision.
A lost asset remains on the register until formally resolved.
---
# 52. Stolen Asset
Additional fields:
* theft date;
* police report number;
* police station;
* insurance claim;
* investigation;
* supporting documents.
Security-sensitive details must be access-controlled.
---
# 53. Damaged Asset
Employee/user may report damage.
Fields:
* Asset
* Date
* Description
* Cause
* Current functionality
* Urgency
* Photo
* Reported by
Route to:
* ICT;
* Administration;
* Fleet;
* external maintenance;
depending on asset category.
---
# 54. Maintenance Module
Assets requiring maintenance must support:
* preventive maintenance;
* corrective repair;
* warranty repair;
* inspection;
* servicing.
Maintenance record:
* asset;
* fault/service;
* reported date;
* service provider;
* work order;
* estimated cost;
* actual cost;
* date sent;
* returned date;
* downtime;
* outcome;
* attachment.
---
# 55. Preventive Maintenance
For applicable assets:
* service interval;
* next service date;
* operating-hours/km basis where relevant;
* reminder period.
Examples:
* vehicles;
* generators;
* air conditioners;
* UPS equipment;
* servers;
* specialist equipment.
---
# 56. ICT Asset Integration
For ICT assets, optional fields:
* hostname;
* IP/MAC;
* operating system;
* warranty;
* endpoint-management ID;
* encryption status;
* device-management status.
But Nexus should not become a full endpoint-management platform.
Technical details should be limited to useful asset-control metadata.
---
# 57. Vehicle Integration
Motor vehicles are fixed assets financially.
However, operational information such as:
* fuel;
* mileage;
* trips;
* drivers;
* vehicle booking;
* servicing;
may belong to a Fleet module.
Architecture:
**Fixed Asset Register owns vehicle asset identity/value.**
**Fleet owns daily operation.**
---
# 58. Warranty Management
Asset fields:
* warranty provider;
* start;
* expiry;
* warranty type;
* terms;
* document;
* contact;
* warranty status.
Alerts:
* 90 days before expiry;
* 30 days;
* expired.
Intervals configurable.
---
# 59. Maintenance vs Warranty
When a repair is raised:
Nexus should indicate:
> Warranty active until 31 October 2027.
This helps prevent unnecessary expenditure.
---
# 60. Insurance
The asset record should support:
* insured: Yes/No;
* policy;
* insurer;
* insured value;
* coverage;
* expiry;
* premium reference;
* claim history.
The Fixed Asset Register supports insurance claims in cases such as fire, theft, vandalism or disaster, which is one purpose identified in the Accounting Manual. 
---
# 61. Insurance Claim
Fields:
* asset;
* incident;
* date;
* claim number;
* amount claimed;
* insurer;
* status;
* amount recovered;
* payment reference;
* documents.
---
# 62. Condition Ratings
Configurable:
* New
* Excellent
* Good
* Fair
* Poor
* Unserviceable
* Beyond Economical Repair
Condition should be recorded during:
* receipt;
* assignment;
* transfer;
* return;
* verification;
* maintenance;
* disposal assessment.
---
# 63. Useful Life & Replacement Planning
For each capital/controlled asset:
* acquisition date;
* expected useful life;
* expected replacement date;
* condition;
* maintenance history;
* current book value.
System should produce:
**Assets Due for Replacement**
This can feed the next capital budget cycle.
---
# 64. Replacement Request
Asset Officer/HOD may propose replacement.
Fields:
* asset;
* reason;
* age;
* condition;
* maintenance cost;
* expected replacement cost;
* required year;
* Capital Budget linkage.
Replacement approval does not automatically dispose of the old asset.
---
# 65. Asset Retirement
`Retired from Service` means:
Asset is no longer in active operational use but has **not yet been legally/accountingly disposed**.
It may be:
* awaiting assessment;
* awaiting sale;
* stored;
* awaiting write-off.
---
# 66. Disposal Policy
The Accounting Manual requires the HOD to recommend disposal of assets that are unusable or cannot economically be maintained, including information such as purchase date, serial number, model, make and reason. 
Nexus must therefore use a controlled disposal process.
---
# 67. Disposal Request
Fields:
* Asset
* Description
* Asset tag
* Serial
* Make/model
* Purchase date
* Original cost
* Current book value
* Current condition
* Reason
* Replacement required
* Estimated realisable value
* Estimated replacement cost
* Donor restriction check
* Proposed disposal method
* Recommendation by HOD
* Attachments
---
# 68. Disposal Reasons
Configurable:
* Obsolete
* Unserviceable
* Beyond Economical Repair
* Surplus
* Technology Obsolete
* Damaged Beyond Repair
* Lost
* Stolen
* Donor Transfer
* Replacement
* Other
---
# 69. Disposal Methods
Possible methods:
* Sale
* Auction
* Staff Bid
* Donation
* Transfer
* Scrap
* Destruction
* Write-Off
* Return to Donor
* Other approved method
Method must follow applicable policy.
---
# 70. Disposal Approval Workflow
Recommended:
1. Asset Officer assessment.
2. HOD recommendation.
3. Finance verifies asset value/accounting status.
4. Director Finance review.
5. Secretary General approval.
6. Additional institutional approval where required.
7. Disposal executed.
8. Proceeds recorded.
9. Accounting notified.
10. Register closed.
Exact workflow must be policy-configurable.
---
# 71. Staff Bids
The existing Manual states that fixed-asset sale bids should initially be open to staff and establishes further requirements for significant-value items. 
Where current policy continues to apply, Nexus should support:
* disposal notice;
* bidding period;
* eligible bidders;
* sealed bids;
* bid opening;
* highest valid offer;
* approval.
This must be configurable in case the disposal policy is revised.
---
# 72. High-Value Disposal
The Manual currently contains additional requirements around significant assets, including reserve prices and independent valuation around the US$15,000 level. 
Like the capitalisation threshold, this must be:
* policy-configured;
* versioned;
* not permanently hard-coded.
---
# 73. Disposal Valuation
Fields:
* valuer;
* valuation date;
* valuation method;
* fair-market value;
* reserve price;
* attachment.
Independent valuation requirement should be triggered by policy/value.
---
# 74. Write-Off
Write-off must never be a basic `Delete Asset` button.
Workflow:
* write-off request;
* reason;
* investigation if applicable;
* financial value;
* authorisation;
* accounting reference;
* effective date.
Physical and financial history remains permanently accessible.
---
# 75. Accounting Disposal
After approval/execution:
Finance records/reconciles:
* disposal proceeds;
* book value;
* gain/loss reference;
* accounting journal;
* accounting-system reference.
Nexus preserves the operational history.
---
# 76. Asset Deletion
Production rule:
> Registered asset records are never hard-deleted through ordinary business workflows.
Incorrect duplicates may be:
* merged;
* voided;
* archived;
through controlled Admin/Finance processes.
Audit history remains.
---
# 77. Staff Offboarding Integration
Before employee clearance:
Nexus checks:
**Assigned Assets**
Example:
* Laptop — not returned
* Monitor — returned
* Office keys — separate clearance system
* Mobile phone — not returned
Employee cannot be marked asset-cleared until required assets are:
* returned;
* reassigned;
* formally resolved.
The Accounting Manual's clearance rules require institution property to be returned before final payment processes are completed. 
---
# 78. Return of Asset
Capture:
* return date;
* received by;
* condition;
* accessories;
* damage;
* missing items;
* next status:
  * Available
  * Maintenance
  * Disposal Assessment.
---
# 79. Employee Transfer / Department Change
When User Profile changes department:
Do **not** automatically move all assigned assets.
Generate:
**Asset Assignment Review**
because some assets may:
* remain with employee;
* remain with department;
* need return/reassignment.
---
# 80. Asset Dashboard
Top metrics:
* Total Registered Assets
* Capital Assets
* Controlled Assets
* Total Acquisition Cost
* Current Book Value
* Assigned Assets
* Unassigned Assets
* Due for Verification
* Missing Assets
* Damaged Assets
* Under Maintenance
* Warranty Expiring
* Due for Replacement
* Pending Disposal
---
# 81. Asset Officer Dashboard
Queues:
* Intake Pending
* Assets Awaiting Tags
* Assignment Pending
* Transfers Pending
* Verification Exceptions
* Repairs
* Warranty Expiry
* Missing Assets
* Disposal Requests
* Assets Awaiting Employee Return
---
# 82. Finance Dashboard
Show:
* capital assets acquired;
* acquisitions by funding source;
* depreciation;
* book value;
* unreconciled procurement assets;
* disposals pending accounting;
* grant assets;
* capital budget vs acquisitions;
* impairment/write-off queue.
---
# 83. Department Dashboard
HOD sees:
* assets assigned to department;
* staff custody;
* unassigned department assets;
* condition;
* verification status;
* assets due for replacement;
* disposal requests.
Financial data visibility should depend on permission.
---
# 84. My Assets Dashboard
Employee sees:
* asset;
* asset tag;
* description;
* issue date;
* condition at issue;
* return requirement;
* report issue/damage action.
Keep it simple.
---
# 85. Search
Search by:
* Asset tag
* Serial number
* Description
* Manufacturer
* Model
* Employee
* Department
* Location
* Supplier
* PO
* Procurement reference
* Donor
* Project
Fast asset-tag lookup is essential.
---
# 86. Locations
Maintain structured locations:
* Country
* Site
* Building
* Floor
* Room
* Store
* Residence
* Other
Avoid relying entirely on free-text `location`.
---
# 87. Asset Movement Log
Every movement:
* from;
* to;
* person;
* date;
* reason;
* authorised by.
Temporary mission movement may optionally be logged for high-value equipment.
---
# 88. Asset Documents
Possible attachments:
* Invoice
* PO
* GRN
* Warranty
* Photograph
* Manual
* Insurance
* Assignment Form
* Transfer Form
* Maintenance Report
* Police Report
* Valuation
* Disposal Recommendation
* Disposal Approval
* Sale Receipt
* Donation Certificate
* Write-Off Approval
All use shared Nexus document storage.
---
# 89. Asset Images
Allow one or more photos.
Useful for:
* identification;
* damage reports;
* verification;
* disposal.
Do not require images for every routine record.
---
# 90. Notifications
Notify for:
* asset assigned;
* acknowledgement required;
* asset transfer;
* temporary loan overdue;
* maintenance update;
* warranty expiring;
* verification due;
* asset not found;
* asset return required;
* offboarding clearance;
* disposal action required.
---
# 91. Reports
Required reports:
* Fixed Asset Register
* Asset Register by Category
* Asset Register by Department
* Asset Register by Location
* Assets by Custodian
* Assets by Funding Source
* Donor-Funded Assets
* Asset Acquisition Report
* Capital vs Controlled Asset Report
* Depreciation Report
* Book Value Report
* Asset Verification Report
* Missing Assets Report
* Damaged Assets Report
* Maintenance Report
* Warranty Expiry Report
* Insurance Report
* Asset Movement Report
* Employee Asset Register
* Assets Due for Replacement
* Disposal Register
* Written-Off Assets
* Asset Audit Trail
---
# 92. Fixed Asset Register Export
Support:
* PDF
* Excel
* CSV
At minimum include:
* asset tag;
* description;
* category;
* serial;
* acquisition date;
* cost;
* funding;
* depreciation;
* book value;
* location;
* custodian;
* condition;
* status.
---
# 93. Asset Tag Export
Support printable:
* QR labels;
* barcode labels;
* asset-tag sheet.
---
# 94. Physical Verification Reports
Include:
* expected;
* verified;
* not found;
* wrong location;
* wrong custodian;
* unregistered;
* damaged;
* discrepancy resolution.
Completion percentage should be visible.
---
# 95. Data Model
Recommended entities:
### assets
* id
* uuid
* asset_tag
* description
* asset_class_id
* asset_category_id
* manufacturer
* model
* serial_number
* acquisition_date
* acquisition_method
* acquisition_cost
* currency
* reporting_cost
* procurement_request_id
* purchase_order_id
* supplier_id
* funding_source_id
* donor_project_id
* budget_line_id
* useful_life
* depreciation_method
* depreciation_rate
* residual_value
* status
* condition
* current_location_id
* current_custodian_id
### asset_categories
### asset_policy_versions
### asset_assignments
### asset_locations
### asset_location_history
### asset_transfer_requests
### asset_temporary_loans
### asset_maintenance_records
### asset_warranties
### asset_insurance_records
### asset_insurance_claims
### asset_verification_campaigns
### asset_verification_results
### asset_discrepancies
### asset_depreciation_runs
### asset_depreciation_lines
### asset_disposal_requests
### asset_disposal_transactions
### asset_documents
### asset_audit_events
---
# 96. Assignment History Model
`asset_assignments`:
* asset_id
* custodian_type
* custodian_id
* department_id
* location_id
* assigned_at
* returned_at
* condition_out
* condition_in
* assigned_by
* received_by
* status
Never simply overwrite `assigned_user_id` without history.
A cached current assignment may exist for performance.
---
# 97. Asset Accounting Policy
Configuration:
* capitalisation threshold;
* threshold currency;
* depreciation method;
* category depreciation rates;
* useful lives;
* disposal thresholds;
* valuation requirements;
* verification frequency;
* controlled asset rules.
Versioned and effective-dated.
---
# 98. API Requirements
Suggested endpoints:
### Asset Register
`GET /assets`
`POST /assets`
`GET /assets/{id}`
`PUT /assets/{id}`
### Intake
`GET /assets/intake`
`POST /assets/intake/{procurementItem}/register`
`POST /assets/intake/bulk-register`
### Assignment
`POST /assets/{id}/assign`
`POST /assets/{id}/return`
`POST /assets/{id}/transfer`
### Loans
`POST /assets/{id}/loan`
`POST /assets/{id}/loan-return`
### Verification
`POST /asset-verifications`
`POST /asset-verifications/{campaign}/scan`
`POST /asset-verifications/{campaign}/complete`
### Maintenance
`POST /assets/{id}/maintenance`
### Incidents
`POST /assets/{id}/report-damage`
`POST /assets/{id}/report-missing`
`POST /assets/{id}/report-stolen`
### Disposal
`POST /assets/{id}/request-disposal`
`POST /asset-disposals/{id}/recommend`
`POST /asset-disposals/{id}/approve`
`POST /asset-disposals/{id}/complete`
---
# 99. Permissions
Recommended:
* `assets.view`
* `assets.view-own`
* `assets.register`
* `assets.classify`
* `assets.tag`
* `assets.assign`
* `assets.transfer`
* `assets.verify`
* `assets.manage-maintenance`
* `assets.report-incident`
* `assets.manage-financials`
* `assets.run-depreciation`
* `assets.request-disposal`
* `assets.review-disposal`
* `assets.approve-disposal`
* `assets.complete-disposal`
* `assets.export`
* `assets.audit`
* `assets.admin`
---
# 100. Separation of Duties
At minimum:
* Procurement receipt does not automatically constitute final asset registration without Asset/Administration review.
* Employee cannot assign an asset to themselves.
* Custodian cannot mark a missing asset as disposed.
* Asset Officer cannot unilaterally write off an asset where higher approval is required.
* Finance controls accounting values/depreciation.
* Disposal approval and execution must remain separately attributable.
* System Administrator does not automatically receive business approval authority.
---
# 101. Record Security
Financial fields may be restricted.
Employee generally needs:
* asset identity;
* assignment;
* condition;
* return information.
Employee does not necessarily require:
* purchase price;
* depreciation;
* disposal valuation.
Permissions determine visibility.
---
# 102. Concurrency
Prevent:
* same asset assigned to two users simultaneously;
* same serial registered twice;
* asset disposed while active assignment remains;
* asset transferred while maintenance is active without explicit resolution.
Use transactional state transitions.
---
# 103. Audit Trail
Audit:
* intake created;
* asset registered;
* asset classified;
* tag generated;
* tag replaced;
* assignment;
* acknowledgement;
* transfer;
* location change;
* return;
* maintenance;
* warranty action;
* verification;
* discrepancy;
* missing report;
* stolen report;
* depreciation;
* valuation;
* disposal request;
* disposal approval;
* disposal execution;
* accounting closure.
Capture:
* user;
* role;
* timestamp;
* previous value;
* new value;
* reason;
* source record.
---
# 104. Historical Migration
Before production, existing assets must be imported.
Import sources may include:
* existing Fixed Asset Register;
* Finance spreadsheets;
* ICT inventories;
* Administration inventories;
* office/residence inventories;
* donor asset schedules.
---
# 105. Migration Process
1. Import candidate records.
2. Normalise categories.
3. Match duplicate serial numbers.
4. Assign provisional tags where needed.
5. Reconcile with Accounting.
6. Conduct physical verification.
7. Resolve missing/unregistered assets.
8. Certify opening register.
9. Activate.
---
# 106. Migrated Asset Status
Assets imported before physical verification:
**Migrated — Verification Pending**
Do not automatically treat all legacy records as physically confirmed.
---
# 107. Legacy Asset Tags
Where assets already have valid tags:
* preserve existing tag;
* map to Nexus asset ID.
Do not retag everything simply for technical convenience.
---
# 108. Opening Book Values
Finance must validate:
* acquisition cost;
* accumulated depreciation;
* book value;
* useful life;
* depreciation policy.
Where data is unknown:
mark:
**Historical Value Incomplete**
rather than inventing values.
---
# 109. Backend Testing
Must cover:
* asset classification;
* capitalisation threshold;
* procurement intake;
* bulk registration;
* serial uniqueness;
* tag generation;
* assignment;
* transfer;
* return;
* simultaneous assignment prevention;
* verification;
* discrepancies;
* maintenance;
* warranty;
* depreciation;
* donor assets;
* disposal;
* write-off controls;
* audit trail;
* permissions.
---
# 110. Frontend / E2E Testing
Must test:
* procurement-to-asset intake;
* register one asset;
* bulk-register multiple assets;
* print tag;
* assign;
* employee acknowledgement;
* transfer;
* return;
* QR lookup;
* verification campaign;
* missing asset;
* maintenance;
* disposal request;
* approval;
* completed disposal;
* reports.
---
# 111. Security Testing
Must prove:
* employee cannot assign themselves assets;
* employee cannot edit cost/book value;
* ordinary user cannot dispose an asset;
* direct API cannot bypass disposal approval;
* disposed asset cannot be reassigned;
* assignment history cannot be rewritten;
* unauthorised user cannot view confidential incident documents;
* System Admin cannot business-approve disposal without permission.
---
# 112. Production Acceptance Criteria
The module is production-ready only when:
1. Assets can be created from completed Procurement.
2. Multiple physical assets can be generated from quantity purchases.
3. Capital and controlled assets are differentiated.
4. Consumables are routed to the separate Stock module.
5. Capitalisation rules are versioned/configurable.
6. Every asset receives a unique stable ID.
7. Asset tags can be generated.
8. QR/barcode labels can be printed.
9. Serial duplicates are detected.
10. Assets can be assigned to employees/departments/locations.
11. Employees can acknowledge custody.
12. Assignment history is retained.
13. Assets can be transferred.
14. Temporary loans are supported.
15. Locations are structured.
16. Physical verification campaigns work.
17. QR scanning can verify assets.
18. Missing assets generate exceptions.
19. Unregistered assets can be investigated.
20. Damage/loss/theft workflows work.
21. Maintenance history works.
22. Warranty monitoring works.
23. Insurance records work.
24. Depreciation can be calculated according to policy.
25. Finance can reconcile accounting values.
26. Donated/grant assets are supported.
27. Donor restrictions are preserved.
28. Replacement planning works.
29. Disposal requests are controlled.
30. HOD recommendation is recorded.
31. Finance review occurs.
32. SG/higher approval can be enforced.
33. Write-off does not delete history.
34. Disposal proceeds/accounting references can be recorded.
35. Offboarding identifies outstanding employee assets.
36. Full Fixed Asset Register can be exported.
37. Audit trail is complete.
38. Existing Procurement, Budget, User Profile and Audit integrations pass regression tests.
---
# 113. Production-Critical Phase
## Phase 1
Implement:
* Asset Register
* Procurement intake
* Asset classification
* Controlled non-capital asset support
* Categories
* Tags / QR
* Assignment
* Employee acknowledgement
* Transfer
* Return
* Locations
* Physical verification
* Missing/damaged asset controls
* Warranty
* Maintenance
* Depreciation
* Disposal
* Reports
* Audit
* User Profile/offboarding integration
## Phase 2
Add:
* deeper insurance workflow;
* advanced replacement forecasting;
* Fleet integration;
* endpoint-management integrations;
* mobile bulk-scanning enhancements;
* advanced depreciation/accounting API integration.
---
# 114. Critical Architecture Rules
The developer must treat these as non-negotiable:
> **Fixed Assets and Consumables are separate registers.**
A carton of printer paper does not belong in the Fixed Asset Register.
> **Below-capitalisation does not automatically mean uncontrolled.**
A durable, theft-prone low-value device can be a Controlled Non-Capital Asset.
> **Every individually controlled asset receives an individual record.**
Twenty laptops means twenty asset records.
> **Assignment history is immutable.**
Do not simply replace the employee field.
> **Asset location history is retained.**
> **A registered asset is never deleted merely because it is sold, lost or written off.**
Its lifecycle ends through a controlled status.
> **Disposal is a workflow, not an edit.**
> **Asset accounting and physical custody remain related but separate responsibilities.**
> **Procurement feeds the asset register; the asset register must not recreate procurement.**
---
# 115. Final Product Rule
The Fixed Asset Module should make it possible to scan any SADC PF asset and immediately answer:
**What is it?**
→ asset master
**Where did it come from?**
→ Procurement / grant
**Who paid for it?**
→ funding source / donor
**What did it cost?**
→ acquisition/accounting data
**Who has it?**
→ current custody
**Where is it?**
→ structured location
**What condition is it in?**
→ latest verification/inspection
**Is it under warranty?**
→ warranty record
**Has it been repaired?**
→ maintenance history
**Was it physically verified?**
→ verification history
**When should it be replaced?**
→ lifecycle planning
**If it was disposed, who authorised it and how?**
→ disposal record
That provides the asset-control and accountability layer required by the SADC PF Accounting Manual while preserving the demo decision that **Consumables / Stock remain a separate module**. 
**Next module: Consumables / Stock & Stores Management**, including stock-in, stock-out, issuance to staff/departments, reorder levels, procurement receipts, stocktakes, shortages, damaged/expired stock, and complete issue history.
