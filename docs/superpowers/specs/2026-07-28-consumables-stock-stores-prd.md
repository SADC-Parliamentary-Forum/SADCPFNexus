# SADC PF Nexus

# Consumables / Stock & Stores Management Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Consumables / Stock & Stores Management
**Short name:** Stock / Stores
**Document status:** Updated implementation PRD
**Module type:** Internal stores, consumable inventory, issuance and replenishment-control module

---

# 1. Executive Summary

The Stock & Stores Module will provide SADC PF with a central register for consumable and stock-controlled items.

The module must manage the complete lifecycle:

**Procurement → Goods Receipt → Stock Intake → Storage → Request → Approval where required → Issue → Consumption → Reorder → Stocktake → Adjustment → Disposal/Write-Off**

It must answer:

* What consumables does SADC PF currently hold?
* How much of each item is available?
* Where is it stored?
* Which supplier supplied it?
* At what unit cost?
* Which Procurement Request/PO produced it?
* Which project or funding source paid for it?
* Who requested stock?
* Who approved it?
* Who received it?
* Which department/activity consumed it?
* What is the current balance?
* What stock is below minimum level?
* What should be reordered?
* What is expiring?
* What is damaged?
* What was found during stocktake?
* What stock adjustments were made and why?
* What is the value of stock on hand?

---

# 2. Critical Product Boundary

The demo decision must be enforced:

> **Fixed Assets and Consumables/Stock are separate modules.**

The Stock module is for items that are normally:

* consumed;
* distributed;
* issued in quantities;
* replenished periodically;
* not individually depreciated;
* not expected to be tracked through an individual long-term custody lifecycle.

Examples:

* A4 paper;
* toner;
* ink cartridges;
* pens;
* notebooks;
* cleaning materials;
* tissues;
* bottled water;
* conference stationery;
* name badges;
* lanyards;
* printing supplies;
* envelopes;
* batteries;
* cables where treated as consumables;
* basic IT consumables;
* small replacement supplies.

---

# 3. Controlled Asset Boundary

Not every low-value purchase should become stock.

For example:

* calculator;
* tablet;
* portable hard drive;
* small projector;
* mobile router;
* headset of material value;
* small electronic device;

may warrant individual control even below the capitalisation threshold.

The Accounting Manual specifically allows lower-value items with useful lives exceeding one year to be inventoried separately even though expensed in the year of purchase. 

Therefore the intake process must classify each item as:

* Capital Asset
* Controlled Non-Capital Asset
* Consumable / Stock
* Direct Expense / Non-stock Service

---

# 4. Product Principle

The Stock Module operates according to:

> **Every physical stock movement must have a recorded transaction.**

Nexus must never rely on staff manually editing:

`Current Quantity = 45`

Instead:

**Opening Stock

* Receipts
* Transfers In
* Positive Adjustments
  − Issues
  − Transfers Out
  − Damaged/Expired Write-Offs
  − Negative Adjustments
  = Quantity on Hand**

The stock ledger is authoritative.

---

# 5. Demo Requirements Incorporated

The updated design incorporates the following requirements from the Nexus demo and subsequent module decisions.

## 5.1 Separate fixed assets and consumables

No combined generic “Asset Inventory” screen.

Users should see:

* **Fixed Assets**
* **Stock / Stores**

as separate functions.

## 5.2 Procurement hand-off

Stock received through Procurement must populate automatically.

Users should not re-enter:

* supplier;
* PO;
* item;
* quantity;
* unit price;
* budget line;
* funding source.

## 5.3 Stock issuance

The system must record:

* item;
* quantity;
* employee/department;
* date;
* activity/project;
* issuing officer.

## 5.4 Reorder management

Nexus must automatically flag:

* low stock;
* reorder point reached;
* out of stock.

## 5.5 Department accountability

The system should distinguish stock:

* physically in stores;
* issued for departmental use;
* issued for a specific programme/activity;
* issued to an individual.

## 5.6 Activity/PIF linkage

Consumables issued for an approved activity should optionally link to:

* PIF;
* programme/project;
* event;
* committee;
* budget line.

This allows SADC PF to determine actual material usage per activity.

---

# 6. Module Navigation

Main Menu → **Stock / Stores**

Recommended submenus:

* Stock Dashboard
* Item Catalogue
* Stock on Hand
* Stock Intake
* Pending Receipts
* Stock Requests
* Pending Approval
* Issue Stock
* Stock Returns
* Transfers
* Reorder Queue
* Stocktakes
* Stock Adjustments
* Damaged / Expired Stock
* Write-Offs
* Stock Movement Register
* Supplier History
* Reports
* Stores Settings

---

# 7. Roles

Primary roles:

* Stores Officer
* Administration Officer
* Procurement Officer
* Receiving Officer
* Department Requester
* Programme Officer
* Head of Department
* Finance Officer
* Asset Officer
* Internal Auditor
* System Administrator

---

# 8. Requester Permissions

Ordinary employees may:

* search available catalogue items;
* request stock;
* view their own requests;
* see status;
* confirm receipt where required.

They must not:

* alter stock balances;
* receive procurement deliveries;
* write off stock;
* approve their own restricted requests;
* modify unit costs.

---

# 9. Stores Officer Permissions

Stores may:

* receive approved stock;
* register lots/batches;
* issue stock;
* process returns;
* transfer stock;
* conduct stocktakes;
* initiate adjustments;
* manage storage locations;
* monitor reorder levels.

Sensitive adjustments/write-offs may require higher approval.

---

# 10. Item Catalogue

The system needs a central Stock Item Catalogue.

Each item represents a stock type, not a physical unit.

Examples:

**STN-PAPER-A4-80G**

A4 Copy Paper 80gsm

**ICT-TONER-HP-59A**

HP 59A Toner Cartridge

---

# 11. Item Catalogue Fields

Every stock item must support:

### Identification

* Item ID
* Item Code / SKU
* Item Name
* Description
* Category
* Subcategory
* Brand, optional
* Manufacturer part number, optional
* Barcode, optional

### Measurement

* Base unit of measure
* Purchase unit
* Issue unit
* Conversion factor

### Control

* Minimum stock
* Maximum stock
* Reorder point
* Reorder quantity
* Safety stock
* Lead time
* Preferred supplier, informational
* Active/inactive

### Financial

* Current average unit cost
* Last purchase cost
* Currency
* Accounting/budget mapping, where applicable

### Special Control

* Batch tracking required
* Expiry tracking required
* Serial tracking required
* Restricted item
* Approval required before issue

---

# 12. Categories

Configurable stock categories may include:

* Stationery
* Printing Supplies
* Toner & Ink
* IT Consumables
* Conference Supplies
* Cleaning Supplies
* Kitchen Supplies
* Maintenance Consumables
* Electrical Consumables
* Communications Supplies
* Promotional Materials
* Publications
* Safety Supplies
* Other

---

# 13. Units of Measure

Configurable units:

* Each
* Box
* Pack
* Ream
* Carton
* Roll
* Bottle
* Litre
* Kilogram
* Set
* Pair
* Meter
* Other

Unit conversions must be controlled.

---

# 14. Unit Conversion

Example:

Purchased:

1 carton

Contains:

5 reams

Issue unit:

1 ream

Stock receipt:

10 cartons

Equivalent stock:

50 reams.

The system must perform this conversion automatically.

---

# 15. Procurement Integration

Procurement should classify received items at Goods Receipt.

Possible disposition:

* Fixed Asset Intake
* Controlled Asset Intake
* Stock Intake
* Direct Consumption / Expense

The receiving officer should not manually reproduce the PO.

---

# 16. Stock Intake from Procurement

Prefill:

* Procurement Request
* Purchase Order
* Supplier
* Supplier invoice
* Delivery note
* GRN
* Item
* Description
* Quantity ordered
* Quantity delivered
* Unit
* Unit cost
* Currency
* Funding source
* Project
* Budget line
* Delivery date

Stores then confirms:

* actual accepted quantity;
* damaged/rejected quantity;
* store location;
* batch/expiry where applicable.

---

# 17. Partial Delivery

The module must support:

PO:

500 notebooks

Delivery 1:

300

Delivery 2:

200

Each receipt becomes a separate stock transaction linked to the same PO.

Do not mark the PO fully received after only 300.

---

# 18. Over-Delivery

If supplier delivers more than ordered:

Example:

Ordered 100

Delivered 105

The system must not silently accept 105.

Flag:

**Over-delivery**

Options:

* Accept authorised excess
* Reject excess
* Return excess
* Procurement review

---

# 19. Under-Delivery

If ordered 100 and received 90:

Record:

* received 90;
* outstanding 10.

PO remains partially delivered unless Procurement closes the balance.

---

# 20. Damaged Delivery

On receipt capture:

* quantity received;
* quantity accepted;
* quantity rejected;
* reason;
* photos/documentation;
* supplier action.

Rejected units do not enter available stock.

This information may feed Supplier Performance.

---

# 21. Direct Purchase vs Stock Receipt

Not every procurement of a consumable must enter central stock.

Example:

Catering supplies procured directly for an event and consumed immediately.

Classification:

**Direct Consumption**

The procurement record remains, but no artificial stores stock is created.

This avoids inflating inventory.

---

# 22. Stock Locations

Maintain structured stores.

Examples:

* Main Store
* ICT Store
* Administration Store
* Conference Store
* Cleaning Store
* Offsite Store

Fields:

* Store code
* Store name
* Site
* Building
* Room
* Responsible officer
* Restricted access
* Active

---

# 23. Bin Locations

Optional internal hierarchy:

Store:

Main Store

→ Aisle

→ Shelf

→ Bin

Example:

`MAIN/A03/S02/B04`

Useful where stock volume warrants it.

---

# 24. Multiple Stores

One stock item may exist at multiple locations.

Example:

A4 Paper:

* Main Store: 40 reams
* ICT Store: 5
* Conference Store: 12

Balances must be calculated per location and institution-wide.

---

# 25. Stock Batches / Lots

For applicable items track:

* Lot/batch number
* Receipt
* Supplier
* Received date
* Manufacture date
* Expiry date
* Quantity received
* Quantity remaining
* Storage location

Not all stationery requires lot tracking.

---

# 26. Expiry Tracking

Applicable to:

* medical/safety supplies if held;
* cleaning products;
* batteries where useful;
* food/beverage supplies;
* other expiring stock.

Notifications:

* 90 days before expiry
* 60 days
* 30 days
* 7 days

Configurable.

---

# 27. FIFO / FEFO

Issue methods:

### FIFO

First In, First Out

Suitable for ordinary stock.

### FEFO

First Expiry, First Out

Suitable for expiring items.

The allocation method should be configurable per item category.

---

# 28. Stock Balance

The displayed quantity must always be derived from stock transactions.

For each item/location show:

* Physical on Hand
* Reserved
* Available to Issue
* On Order
* Below Reorder Point
* Damaged/Quarantined

---

# 29. Stock Reservation

When an approved internal request is pending collection:

Requested stock may become:

**Reserved**

Example:

Physical:

20 toner cartridges

Approved request:

5

Available:

15

This prevents multiple departments from being promised the same stock.

---

# 30. Stock Request

Employees/Departments should request items electronically.

Request header:

* Request reference
* Requester
* Department
* Date
* Purpose
* Programme/project
* Linked PIF/activity
* Required date
* Delivery/collection method
* Comments

---

# 31. Stock Request Lines

Per line:

* Item
* Requested quantity
* Unit
* Available quantity
* Approved quantity
* Issued quantity
* Returned quantity
* Purpose
* Comments

Each line requires a stable ID.

---

# 32. Request Purpose

Suggested categories:

* General Office Use
* Programme Activity
* Committee Meeting
* Plenary Assembly
* Training
* Conference
* ICT Operations
* Maintenance
* Administration
* Cleaning
* Other

---

# 33. PIF Integration

An approved PIF may generate known material requirements.

Example:

PIF requests:

* 40 conference bags
* 40 notebooks
* 80 pens

Before Procurement creates new purchases, Stores should be able to indicate whether stock already exists.

Recommended process:

PIF requirement
→ Stores availability check
→ Use stock where appropriate
→ Procure shortage only.

---

# 34. Why PIF–Stock Integration Matters

Without integration:

PIF needs 50 notebooks.

Stores already has 80.

Procurement buys another 50.

This wastes funds.

Nexus should therefore support:

**Check Internal Stock First**

for configured commodity categories.

---

# 35. Stock Availability Response

For each requested PIF item:

* Requested
* On Hand
* Reserved
* Available
* Can Fulfil
* Shortage

Example:

Requested: 50

Available: 35

Shortage: 15

Procurement request can then be created for 15 if appropriate.

---

# 36. Procurement Reorder Integration

The Stock Module can create:

**Replenishment Request**

for Procurement.

Prefill:

* stock item;
* current balance;
* minimum level;
* maximum level;
* reorder point;
* recommended reorder quantity;
* last purchase;
* preferred supplier, informational;
* estimated cost;
* required-by date.

Procurement controls supplier selection.

---

# 37. Stock Request Approval

Not every pen request needs a long approval workflow.

Approval requirements should be configurable.

Example:

### Routine low-value request

Requester → Stores

### Restricted/high-volume request

Requester → HOD → Stores

### Project-specific issue

Programme Officer → Project Manager/HOD → Stores

Keep ordinary operations simple.

---

# 38. Approval Rules

Rules may depend on:

* item;
* category;
* quantity;
* value;
* department;
* purpose;
* funding/project;
* exceptional quantity.

---

# 39. Unusual Quantity Detection

If normal issue is:

1 toner cartridge

and user requests:

20,

Nexus should warn:

**Unusually high quantity**

This does not necessarily block, but may trigger approval.

---

# 40. Issue Stock

Stores issue screen must show:

* Request
* Requester
* Approved quantities
* Available balances
* Location
* Batch, where applicable

Stores records:

* quantity issued;
* issue date/time;
* issuing officer;
* recipient;
* collection confirmation.

---

# 41. Stock Issue Voucher

Generate a digital Stock Issue Voucher containing:

* reference;
* date;
* department;
* requester;
* item;
* quantity;
* unit;
* purpose;
* programme/activity;
* issued by;
* received by.

Digital acknowledgement may replace physical signature.

---

# 42. Recipient Confirmation

Where required, recipient confirms:

> I acknowledge receipt of the listed items in the quantities shown.

Record:

* user;
* timestamp;
* issue;
* comments.

---

# 43. Direct Department Issue

Stores may issue to:

**Department**

rather than employee where items are common-use.

Example:

Cleaning supplies → Administration.

Record department custodian where applicable.

---

# 44. Individual Issue

For certain consumables:

* toner;
* specialised IT consumable;
* equipment accessory;

issue may be recorded to a named employee.

This is consumption accountability, not asset custody.

---

# 45. Stock Returns

Unused stock may be returned where suitable.

Example:

Conference planned for 100 participants; 20 unused conference bags returned.

Return captures:

* original issue;
* item;
* quantity;
* condition;
* store;
* returned by;
* accepted by;
* date.

Good stock re-enters available balance.

---

# 46. Non-Returnable Consumables

Certain items once issued should normally not be returned into saleable/available stock.

Examples:

* opened consumables;
* hygiene products;
* used printer cartridges.

Return policy configurable per item.

---

# 47. Transfers Between Stores

Stock may move:

Main Store → Conference Store

Transaction must capture:

* transfer reference;
* item;
* quantity;
* source;
* destination;
* dispatched by;
* received by;
* date;
* status.

---

# 48. Transfer Statuses

* Draft
* Approved
* Dispatched
* In Transit
* Received
* Partially Received
* Cancelled

Stock should not become available at destination until receipt confirmation.

---

# 49. Two-Sided Transfer Ledger

Transfer out:

reduces source.

Transfer in:

increases destination only when confirmed.

Use one linked transfer transaction chain, not unrelated manual adjustments.

---

# 50. Stocktake

The module must support formal stock-count campaigns.

Examples:

* Monthly spot check
* Quarterly stocktake
* Annual stocktake
* Ad hoc investigation

---

# 51. Stocktake Campaign

Fields:

* Name
* Store
* Scope
* Categories
* Start date
* Freeze date/time
* Count team
* Supervisor
* Status

Statuses:

* Planned
* Counting
* Reconciliation
* Approved
* Closed

---

# 52. Stocktake Freeze

For full stocktake, Stores should optionally freeze transactions temporarily.

Alternative:

Use cut-off timestamps and movement reconciliation.

Do not allow movements to silently invalidate the count.

---

# 53. Blind Count

Recommended control:

Counters should optionally perform a **blind count** without seeing expected system quantities.

This reduces confirmation bias.

After submission, system compares:

* Book Quantity
* Counted Quantity
* Variance

---

# 54. Double Count

For high-risk items:

* first counter;
* second counter;
* discrepancy resolution.

Configurable.

---

# 55. Stocktake Result

Per item:

* Expected
* Counted
* Variance
* Unit cost
* Variance value
* Explanation
* Recount
* Approved adjustment

---

# 56. Stock Variance

Types:

* Shortage
* Surplus
* Data Entry Error
* Unrecorded Issue
* Unrecorded Receipt
* Wrong Location
* Damage
* Expiry
* Theft/Loss Suspected
* Unit Conversion Error
* Other

---

# 57. Variance Approval

A stocktake does not automatically change the ledger.

Process:

1. Count.
2. Detect difference.
3. Investigate.
4. Record explanation.
5. Authorised person approves adjustment.
6. System creates stock adjustment transaction.

---

# 58. Stock Adjustment

Adjustment types:

* Positive Adjustment
* Negative Adjustment
* Opening Balance
* Stocktake Adjustment
* Damage
* Expiry
* Loss
* Correction
* Unit Conversion Correction
* Other

Required:

* item;
* quantity;
* reason;
* evidence;
* requested by;
* approved by;
* transaction date.

---

# 59. No Direct Quantity Editing

Non-negotiable:

> A user must never have an ordinary form where they simply edit `quantity_on_hand`.

Every difference requires a transaction.

---

# 60. Damaged Stock

Process:

1. Mark quantity as quarantined.
2. Record damage.
3. Determine whether supplier claim/warranty applies.
4. Approve disposal/write-off.
5. Remove through transaction.

Fields:

* item;
* batch;
* quantity;
* damage reason;
* date;
* photo;
* responsible officer;
* supplier link;
* disposal decision.

---

# 61. Expired Stock

Expired stock must automatically move to:

**Unavailable / Quarantine**

It must not remain issueable.

Process:

* expiration detected;
* stock isolated;
* responsible officer notified;
* write-off/disposal initiated.

---

# 62. Lost / Missing Stock

Where unexplained shortage is detected:

Status:

**Under Investigation**

Do not simply post a negative adjustment without explanation.

Large/material discrepancies should be escalated according to configured controls.

---

# 63. Stock Write-Off

Write-off must be controlled.

Reasons:

* Expired
* Damaged
* Obsolete
* Contaminated
* Lost
* Theft
* Unusable
* Other

Fields:

* items;
* quantity;
* cost/value;
* reason;
* investigation;
* approval;
* disposal method;
* date.

---

# 64. Disposal

Consumables may be disposed through:

* destruction;
* recycling;
* supplier return;
* safe disposal;
* other authorised process.

Disposal evidence may include:

* destruction certificate;
* handover;
* recycling receipt;
* photos.

---

# 65. Empty Cartridges / Returnable Items

Some items may have:

* recyclable container;
* returnable cartridge;
* supplier take-back;
* environmentally controlled disposal.

The catalogue should support:

`returnable_container = true`

so Stores can track return/recycling.

---

# 66. Reorder Point

For each stock item:

**Reorder Point**

must be configurable.

Example:

A4 Paper:

Minimum: 20 reams

Reorder Point: 30

Maximum: 100

When available stock reaches 30:

**Reorder alert**

---

# 67. Recommended Reorder Quantity

Simple default:

**Maximum Stock − Available Stock − Quantity Already On Order**

Example:

Maximum: 100

Available: 25

Already ordered: 20

Recommended order:

55

Manual adjustment permitted by authorised Stores/Procurement users.

---

# 68. Lead Time

Catalogue may record typical supplier lead time.

Example:

Toner:

21 days

Paper:

7 days

Nexus can alert earlier for long-lead items.

---

# 69. Consumption Rate

The system should calculate:

* average monthly usage;
* average quarterly usage;
* recent usage;
* last issue date.

This can improve reorder recommendations.

---

# 70. Stock Forecast

Later/optional advanced forecast:

Expected consumption based on:

* historic consumption;
* upcoming PIF activities;
* upcoming Plenary;
* committee sessions;
* planned events.

This should assist planning, not automatically place orders.

---

# 71. Plenary / Event Packs

Useful Nexus enhancement:

Allow Stores to create an **Issue Pack Template**.

Example:

Plenary Delegate Pack:

* 1 conference bag
* 1 notebook
* 2 pens
* 1 programme
* 1 badge holder

For 200 participants:

system calculates required quantities.

---

# 72. Event Reservation

Before a major event:

Stock may be reserved.

Example:

Available conference bags:

500

59th Plenary reservation:

300

General available:

200.

---

# 73. Event Reconciliation

After the event:

* reserved;
* issued;
* used;
* returned;
* damaged;
* remaining.

This provides better control of event materials.

---

# 74. Publications / Printed Materials

Publications may optionally be stock-controlled.

Examples:

* Model Laws
* Annual Reports
* Brochures
* Parliamentary publications

Catalogue fields may include:

* title;
* edition;
* language;
* publication year.

---

# 75. Language Variants

For publications/materials:

English, French and Portuguese editions must be separate stock SKUs where quantities differ.

Example:

* ML-PRISON-EN
* ML-PRISON-FR
* ML-PRISON-PT

Do not store 300 copies as one generic stock count when editions differ.

---

# 76. Promotional Materials

Track items such as:

* branded bags;
* shirts;
* caps;
* banners where consumable/issue-based;
* notebooks;
* pens.

Size/variant should be separate where stock differs.

---

# 77. Restricted Stock

Certain stock may require additional control.

Examples:

* expensive toner;
* specialised ICT supplies;
* sensitive stationery;
* official seals/forms if applicable;
* keys/cards where stores-managed.

Fields:

* restricted;
* approval level;
* maximum issue quantity.

---

# 78. Stock Valuation

Nexus should maintain stock value for control and reporting.

Potential methods:

* Weighted Average Cost
* FIFO Cost

The official method must be configured with Finance.

Do not implement an arbitrary valuation method without Finance confirmation.

---

# 79. Recommended Operational Valuation

For a general internal stores module, **weighted average cost** is usually easier for operational inventory where identical consumables are repeatedly purchased at different prices.

However:

> The method must be confirmed by Finance and configured rather than silently treated as SADC PF accounting policy.

---

# 80. Weighted Average Example

Existing:

10 units @ N$100

Receive:

10 units @ N$120

New weighted average:

N$110/unit.

This affects inventory valuation, not the historical price paid on either procurement.

---

# 81. Cost History

For each item show:

* last purchase price;
* average cost;
* historical purchase prices;
* suppliers;
* purchase dates.

Procurement can use this for market/reference information.

---

# 82. Procurement Price Feedback

When a new Procurement Request is created for an existing item, display authorised historical information:

* last unit cost;
* last supplier;
* last purchase date;
* average unit cost.

This aids price reasonableness without dictating supplier selection.

---

# 83. Supplier Performance Connection

Stock receipt can contribute factual supplier-performance metrics:

* ordered quantity;
* delivered quantity;
* rejected quantity;
* delivery date;
* late delivery;
* damaged delivery.

These can feed the Procurement Supplier Performance scorecard.

Stores does not set the entire supplier rating.

---

# 84. Budget Integration

Stock receipt originating from Procurement already carries:

* funding source;
* budget line;
* project.

Do not create a new Budget commitment at stock intake.

The financial commitment/expenditure originated earlier in Procurement/Finance.

This avoids duplication.

---

# 85. PIF Costing vs Stock Consumption

When stock is issued to a PIF activity:

The stock issue should become an actual resource-usage reference.

It must not retrospectively alter the approved PIF budget.

Reports may compare:

* planned requirement;
* actual stock issued.

---

# 86. Department Consumption

Reports should show:

* quantity consumed;
* estimated value consumed;
* category;
* period;
* department.

Useful for annual budgeting.

---

# 87. Individual Consumption

Where appropriate:

* employee;
* stock issued;
* quantity;
* date.

Avoid using this for trivial surveillance.

Track only where operationally useful.

---

# 88. Stock Dashboard

Metrics:

* Total Active SKUs
* Stock Value
* Low Stock Items
* Out of Stock
* Reorder Required
* Expiring Soon
* Quarantined
* Open Requests
* Pending Issues
* Items on Order
* Stocktake Variances
* Damaged Stock

---

# 89. Stores Dashboard

Queues:

* Procurement Receipts Pending
* Requests Awaiting Issue
* Transfers In Transit
* Reorder Alerts
* Expiring Stock
* Stocktake Actions
* Adjustments Pending Approval
* Write-Offs Pending
* Supplier Returns

---

# 90. Employee Dashboard

Simple view:

* Request Stock
* My Requests
* Ready for Collection
* Recent Issues

Employees do not need full inventory administration screens.

---

# 91. HOD Dashboard

Show:

* Department requests
* Department consumption
* Pending approvals
* High-volume requests
* Event reservations

---

# 92. Procurement Dashboard Integration

Procurement should see:

* reorder requests;
* shortages;
* current stock;
* last purchase;
* on-order quantity.

This helps avoid duplicate buying.

---

# 93. Stock Search

Search by:

* item code;
* item name;
* category;
* barcode;
* supplier/manufacturer reference;
* store location.

The search result should show:

* Available
* Reserved
* On Order
* Reorder status.

---

# 94. Barcode Support

Catalogue items may have:

* manufacturer barcode;
* internal barcode.

Scanning can support:

* receipt;
* issue;
* transfer;
* stocktake.

Unlike Fixed Assets, one barcode may identify a product/SKU rather than one physical unit.

---

# 95. QR vs Barcode Distinction

### Fixed Asset QR

Usually identifies one physical object.

### Stock Barcode

Usually identifies the item/SKU or batch.

The architecture must not mix these concepts.

---

# 96. Documents

Supported documents:

* PO
* GRN
* Delivery Note
* Supplier Invoice
* Stock Issue Voucher
* Stock Return Voucher
* Transfer Note
* Stocktake Sheet
* Adjustment Approval
* Damage Report
* Write-Off Approval
* Disposal Certificate

Use shared Nexus document storage.

---

# 97. Notifications

Notify when:

* stock request submitted;
* approval required;
* request approved/rejected;
* stock ready for collection;
* request partially fulfilled;
* item out of stock;
* reorder point reached;
* delivery received;
* expiry approaching;
* stocktake assigned;
* variance detected;
* adjustment awaiting approval;
* write-off awaiting approval.

---

# 98. Workflow Visibility

Every request should show:

* current stage;
* current holder;
* next stage;
* status;
* timestamps.

Example:

Request Submitted
→ HOD Approval
→ Stores Processing
→ Ready for Collection
→ Issued
→ Closed

For routine items:

Request Submitted
→ Stores Processing
→ Issued.

---

# 99. Stock Request Statuses

* Draft
* Submitted
* Pending Approval
* Approved
* Partially Approved
* Rejected
* Processing
* Reserved
* Ready for Collection
* Partially Issued
* Issued
* Cancelled
* Closed

---

# 100. Stock Receipt Statuses

* Expected
* Partially Received
* Received
* Inspection Required
* Accepted
* Partially Rejected
* Rejected
* Closed

---

# 101. Stock Item Statuses

* Active
* Temporarily Unavailable
* Discontinued
* Replacement Item Available
* Archived

Do not delete catalogue items simply because they are no longer purchased.

Historical issues must remain valid.

---

# 102. Item Substitution

Example:

Requested HP toner model A.

Stores has approved replacement model B.

The system should permit substitution only where:

* item compatibility is confirmed;
* requester is informed;
* issue record identifies actual item.

Do not rewrite the requested item as though it was always B.

---

# 103. Stock Item Duplicate Prevention

Prevent catalogue duplicates based on:

* item code;
* manufacturer part number;
* barcode;
* normalised name + specification warnings.

Duplicate detection may warn rather than always block.

---

# 104. Opening Stock Migration

Before go-live, conduct:

1. Physical store count.
2. Build item catalogue.
3. Count quantities.
4. Identify units of measure.
5. Determine usable/damaged/expired stock.
6. Capture opening unit cost where known.
7. Finance/Admin verify.
8. Post Opening Balance transactions.

---

# 105. Opening Balance

Opening stock must be entered through a transaction:

`Opening Balance +50`

not by setting `quantity_on_hand = 50`.

Each imported line records:

* source;
* count date;
* quantity;
* unit cost;
* approved by;
* migration batch.

---

# 106. Unknown Historical Cost

Where unit cost cannot reasonably be established:

Do not invent it.

Mark:

**Cost Data Incomplete**

Finance may provide an authorised valuation later.

---

# 107. Data Model

Recommended entities:

### stock_items

* id
* uuid
* item_code
* name
* description
* category_id
* base_uom_id
* purchase_uom_id
* conversion_factor
* barcode
* minimum_stock
* maximum_stock
* reorder_point
* reorder_quantity
* lead_time_days
* batch_tracking
* expiry_tracking
* restricted
* active

### stock_locations

### stock_batches

### stock_transactions

### stock_receipts

### stock_receipt_lines

### stock_requests

### stock_request_lines

### stock_issues

### stock_issue_lines

### stock_returns

### stock_transfers

### stock_transfer_lines

### stock_reservations

### stocktake_campaigns

### stocktake_lines

### stock_adjustment_requests

### stock_writeoffs

### stock_disposals

### stock_reorder_requests

### stock_documents

---

# 108. Stock Transaction Ledger

This is the most important table.

Recommended fields:

* id
* stock_item_id
* batch_id
* location_id
* transaction_type
* quantity
* unit
* base_quantity
* unit_cost
* value
* source_type
* source_id
* transaction_date
* recorded_by
* approved_by
* reversal_of_transaction_id
* notes

---

# 109. Transaction Types

* Opening Balance
* Procurement Receipt
* Return to Store
* Transfer In
* Transfer Out
* Issue
* Reservation
* Reservation Release
* Positive Adjustment
* Negative Adjustment
* Damage
* Expiry
* Write-Off
* Supplier Return
* Reversal

Reservations may be stored in a separate reservation ledger rather than physical-stock transactions if technically cleaner.

---

# 110. Reversals

Incorrect stock transactions must not simply be deleted.

Use:

**Reversal Transaction**

Example:

Issue incorrectly posted:

−10

Reversal:

+10

with reference to original transaction.

This preserves auditability.

---

# 111. Stock Balance Cache

For performance, Nexus may maintain a cached balance table:

* item;
* location;
* batch;
* on-hand;
* reserved;
* available.

But it must be rebuildable from the transaction ledger.

The ledger remains authoritative.

---

# 112. Negative Stock

Default production rule:

> Do not allow stock balance below zero.

If quantity on hand = 3, a request to issue 5 cannot be posted as −2.

Options:

* partial issue 3;
* wait for replenishment;
* authorised exceptional investigation.

Negative stock should not be ordinary behaviour.

---

# 113. Transaction Concurrency

Critical.

Two Stores Officers simultaneously try to issue:

Available:

5

Request A:

4

Request B:

4

Only one request may successfully reserve/issue 4.

Use transactional database locks.

Frontend checks are insufficient.

---

# 114. Idempotency

Scanning or network retries must not duplicate transactions.

Use idempotency protection for:

* receipts;
* issues;
* transfers;
* returns;
* adjustments.

---

# 115. API Requirements

Suggested endpoints:

### Catalogue

`GET /stock/items`

`POST /stock/items`

`GET /stock/items/{id}`

`PUT /stock/items/{id}`

### Balance

`GET /stock/items/{id}/availability`

`GET /stock/availability`

### Receipt

`GET /stock/intake`

`POST /stock/receipts`

`POST /stock/receipts/{id}/accept`

### Request

`POST /stock/requests`

`POST /stock/requests/{id}/submit`

`POST /stock/requests/{id}/approve`

`POST /stock/requests/{id}/reject`

### Issue

`POST /stock/requests/{id}/issue`

### Return

`POST /stock/issues/{id}/return`

### Transfers

`POST /stock/transfers`

`POST /stock/transfers/{id}/dispatch`

`POST /stock/transfers/{id}/receive`

### Stocktake

`POST /stocktakes`

`POST /stocktakes/{id}/counts`

`POST /stocktakes/{id}/reconcile`

### Adjustment

`POST /stock/adjustments`

`POST /stock/adjustments/{id}/approve`

### Replenishment

`POST /stock/items/{id}/request-replenishment`

---

# 116. Internal Availability API

Other Nexus modules should be able to ask:

`Does SADC PF already have this item?`

Request:

* item/category;
* quantity;
* required date;
* store/project.

Response:

* on hand;
* reserved;
* available;
* can fulfil;
* shortage;
* replenishment status.

This is particularly valuable for PIF and Procurement.

---

# 117. Procurement Hand-Off API

Stock may request Procurement to replenish.

It must pass:

* stock item;
* shortage;
* recommended quantity;
* specification;
* historical price;
* funding suggestion;
* required date.

Procurement remains responsible for procurement method and supplier.

---

# 118. Permissions

Recommended permissions:

* `stock.view`
* `stock.request`
* `stock.approve-request`
* `stock.manage-catalogue`
* `stock.receive`
* `stock.issue`
* `stock.return`
* `stock.transfer`
* `stock.stocktake`
* `stock.request-adjustment`
* `stock.approve-adjustment`
* `stock.writeoff`
* `stock.approve-writeoff`
* `stock.view-costs`
* `stock.export`
* `stock.audit`
* `stock.admin`

---

# 119. Cost Visibility

Ordinary employee:

* item;
* availability;
* request.

They do not necessarily need purchase costs.

Stores/Finance/Procurement may view costs according to permission.

---

# 120. Separation of Duties

At minimum:

* requester should not approve own restricted request;
* receiving officer cannot arbitrarily change PO values;
* Stores Officer should not approve material stock-loss adjustment they initiated if policy requires separate approval;
* stocktake counter should not automatically approve their own variance;
* Procurement controls supplier purchases;
* Finance controls financial values/reconciliation;
* System Administrator does not automatically have Stores approval authority.

---

# 121. Audit Trail

Audit events:

* Item created
* Catalogue item changed
* Procurement receipt
* Receipt rejection
* Stock request
* Request approval
* Reservation
* Issue
* Recipient confirmation
* Return
* Transfer dispatch
* Transfer receipt
* Reorder triggered
* Stocktake started
* Count entered
* Variance identified
* Adjustment requested
* Adjustment approved
* Damage recorded
* Expiry recorded
* Write-off approved
* Disposal completed
* Transaction reversed
* Export generated

Each audit entry:

* user;
* role;
* action;
* timestamp;
* previous value;
* new value;
* source;
* reason.

---

# 122. Reports

Required reports:

* Stock on Hand
* Stock Valuation
* Stock by Store
* Stock by Category
* Stock Movement
* Stock Receipt Register
* Stock Issue Register
* Issues by Department
* Issues by Employee
* Issues by Programme/Project
* Issues by PIF/Activity
* Low Stock Report
* Out-of-Stock Report
* Reorder Report
* Items on Order
* Stock Ageing
* Expiry Report
* Damaged Stock Report
* Write-Off Report
* Stocktake Variance Report
* Supplier Delivery History
* High Consumption Items
* Slow-Moving Stock
* Non-Moving Stock
* Stock Adjustment Report
* Audit Report

---

# 123. Slow-Moving Stock

Define configurable periods.

Example:

No issue for:

* 6 months;
* 12 months;
* 24 months.

Use reports to identify over-ordering.

---

# 124. Non-Moving / Obsolete Stock

Items with no reasonable future use may enter:

**Obsolete Stock Review**

Possible action:

* redistribute;
* retain;
* return supplier;
* donate where authorised;
* dispose/write off.

---

# 125. Consumption Analytics

The system should show:

Top consumed items.

Example:

* A4 paper
* toner
* notebooks

By:

* department;
* project;
* activity;
* period.

This helps annual budgeting.

---

# 126. Fraud / Control Indicators

Nexus should flag unusual patterns such as:

* very frequent requests by same user;
* unusually high quantity;
* repeated emergency replenishment;
* repeated stock shortages;
* excessive adjustments;
* large stocktake discrepancies;
* repeated damaged-stock write-offs.

These are warnings for review, not automatic accusations.

---

# 127. No Casual Staff Rating

Stock should not create employee “ratings” based on consumption.

Consumption analytics are operational controls, not employee performance scoring.

---

# 128. Mobile / Scanner Use

Stores workflow should work well on:

* desktop;
* tablet;
* phone camera/scanner where app capability exists.

Useful activities:

* scan receipt;
* scan issue;
* stocktake.

The mobile application must not be mandatory for ordinary employees.

---

# 129. Offline Stocktake Enhancement

Optional Phase 2:

Allow controlled offline counting on a mobile device with later secure synchronisation.

Need:

* campaign snapshot;
* conflict handling;
* timestamp;
* device/user attribution.

---

# 130. Export Formats

Reports:

* PDF
* Excel
* CSV where appropriate

Stock Issue Voucher:

* PDF

Stocktake:

* PDF/Excel

Movement ledger:

* Excel/CSV.

---

# 131. Production Acceptance Criteria

The module is production-ready only when:

1. Fixed Assets and Stock are separate modules.
2. Consumable catalogue works.
3. Item codes are unique.
4. Units of measure work.
5. Purchase-to-issue conversions work.
6. Multiple stores/locations work.
7. Procurement receipts can create stock intake.
8. Partial receipt works.
9. Over/under-delivery is controlled.
10. Damaged delivery does not enter usable stock.
11. Direct-consumption purchases can bypass stores correctly.
12. Stock balance derives from transactions.
13. Employees can request stock.
14. Approval rules are configurable.
15. Stock can be reserved.
16. Stock can be issued.
17. Recipient acknowledgement works.
18. Stock can be returned.
19. Stock can transfer between stores.
20. Transfers use dispatch/receipt control.
21. PIF can check internal stock.
22. Procurement can receive replenishment requests.
23. Reorder alerts work.
24. Minimum/maximum levels work.
25. On-order stock is considered in reorder calculations.
26. Batch tracking works where enabled.
27. Expiry tracking works where enabled.
28. Expired stock cannot be issued.
29. Stocktake campaigns work.
30. Blind counts are supported.
31. Variances require reconciliation.
32. Adjustments are transaction-based.
33. Users cannot directly edit quantity on hand.
34. Negative stock is blocked.
35. Concurrent issues cannot consume the same balance.
36. Write-offs require controlled approval.
37. Stock transactions cannot be silently deleted.
38. Reversals preserve history.
39. Stock valuation is available.
40. Reports can be exported.
41. Audit trail is complete.
42. Procurement, Budget, PIF and Supplier integration passes regression tests.

---

# 132. Phase 1 — Production Critical

Implement:

* Item Catalogue
* Categories
* Units of Measure
* Stores/Locations
* Procurement Intake
* Receipts
* Stock Ledger
* Stock Requests
* Approval
* Reservations
* Issues
* Returns
* Transfers
* Reorder Levels
* Replenishment Requests
* PIF Stock Availability Check
* Batch/Expiry support
* Stocktakes
* Adjustments
* Damage/Expiry
* Write-Off
* Reports
* Audit
* Permissions

---

# 133. Phase 2 — Enhancements

Add:

* advanced demand forecasting;
* event-pack templates;
* offline stocktake;
* advanced barcode scanning;
* predictive reorder suggestions;
* environmental/recycling tracking;
* richer supplier delivery analytics.

---

# 134. Critical Architecture Rules

The implementer must treat the following as non-negotiable.

> **Do not combine Stock with Fixed Assets.**

> **Do not track individual pens or sheets of paper as fixed assets.**

> **Do not treat every low-value durable item as a consumable. Controlled Non-Capital Assets belong in the Asset Register.**

> **Never allow `quantity_on_hand` to be casually edited.**

> **All stock movements require ledger transactions.**

> **Procurement receipts must feed Stores automatically where appropriate.**

> **Do not duplicate Procurement financial commitments during stock receipt.**

> **PIF and Procurement should check existing stock before buying common consumables.**

> **Reserved stock must reduce the quantity available for other requests.**

> **Expired/quarantined stock is not available stock.**

> **A stocktake discrepancy is not automatically an adjustment. It requires reconciliation and authorisation.**

> **Historical stock transactions are never silently deleted. Use reversals.**

---

# 135. Final Product Rule

A Stores Officer should be able to open an item and immediately answer:

**What is it?**
→ Stock Catalogue

**How much do we physically have?**
→ On Hand

**How much is already promised?**
→ Reserved

**How much can I issue?**
→ Available

**Where is it?**
→ Store / Bin

**Where did it come from?**
→ Procurement / Supplier / PO

**What did it cost?**
→ Cost History

**Who has been receiving it?**
→ Issue History

**Which activity consumed it?**
→ PIF / Programme / Project

**Are we running low?**
→ Reorder

**Have we already ordered more?**
→ On Order

**Is any stock expired or damaged?**
→ Quarantine

**Does the physical count agree with Nexus?**
→ Stocktake

**Why was any quantity written off?**
→ Adjustment / Disposal Audit Trail

This gives Nexus a proper stores-control system rather than a simple editable inventory spreadsheet.

**The next logical module is the Correspondence Register / Records Management module**—incoming and outgoing official correspondence, SG routing, assignments, response deadlines, document references, confidentiality, dispatch, delivery confirmation and institutional records—because the Administrative Rules specifically require incoming and outgoing official correspondence to follow the institutional hierarchy and pass through the appropriate official channels.
</user_query>