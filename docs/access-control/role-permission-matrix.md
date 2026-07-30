# Access Control — Role ↔ Permission Matrix (templates)

Source: `api/config/access_control_role_templates.php` (PRD §11).

| Role template | Risk | Feature-only | Notes |
|---|---|---|---|
| General Employee | low | no | Self-service baseline |
| Supervisor / Line Manager | medium | no | Direct-report recommend |
| Head of Department / Director | high | no | Dept authorise |
| Secretary General | critical | no | Final institutional |
| HR and Administration Officer | high | no | Leave certify |
| Finance Officer | critical | no | PIF finance + SA certify |
| Director Finance and Corporate Services | critical | no | Funds/rates authorise |
| Programme Officer | medium | no | PIF prepare (no finance edit) |
| Programme Manager | high | no | Programme approve |
| M&E Officer / Manager | med/high | no | Separate from PIF |
| Procurement Officer | high | no | Admin process |
| Procurement Evaluation Committee Member | high | **yes** | Evaluations only via My Work |
| Internal Auditor | high | no | Read-only SoD |
| ICT Platform Administrator | critical | no | No business approve |
| Security and Access Administrator | critical | no | Roles/access admin, no business approve |
| Workflow Administrator | high | no | Config only |
| External Supplier | medium | no | Own bids |

Existing Spatie roles (`staff`, `System Admin`, …) remain; templates are additive. System Admin keeps full catalogue so production login is not bricked.
