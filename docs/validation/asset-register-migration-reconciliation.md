# SADC PF ASSET REGISTER MIGRATION RECONCILIATION REPORT

## A. Source files
- category: category.xls (`908043d3ed1c17c9983c1739365225b4b4cdeb5de868844ce0e2579ab937c5d9`)
- location: location.xls (`85e6506658b0a2b0b66246135b621bda162a2c31bd265e2cdc2e796abca34401`)
- staging: staging.xlsx (`3b00f11a2568bfa020c74cebb548b17b0af0a870cb119bb7034e1274398bee87`)

## B. Import Batch ID
`AST-IMPORT-2026-001`

## C–R. Population

| Metric | Count |
| --- | ---: |
| Source row count | 1036 |
| Parsed rows | 969 |
| Unique legacy Asset Tags | 323 |
| Nexus assets created | 323 |
| Existing Nexus assets updated | 0 |
| Assets unchanged | 0 |
| Records excluded | 0 |
| Duplicate records | 0 |
| Missing asset numbers | 0 |
| Missing serial numbers | 300 |
| Missing locations | 0 |
| Unmapped custodians | 323 |
| Financial discrepancies | 5 |
| QR codes generated | 323 |
| Labels generated | 0 |
| Awaiting physical verification | 323 |
| Blocking issues remaining | 0 |

## Identity equation

```
323 unique source tags
= 323 created
+ 0 matched existing
+ 0 approved exclusions
+ 0 outstanding exceptions
= 323 explained
```

**Balanced:** yes
**Migration status:** COMPLETE