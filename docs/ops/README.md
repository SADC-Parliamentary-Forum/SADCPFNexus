# Operations runbooks (Production Slice 1)

These documents describe recovery and incident practices for SADC PF Nexus.
They do **not** claim a restore drill has been executed — operators must schedule drills.

| Document | Purpose |
|----------|---------|
| [backup-restore.md](./backup-restore.md) | Backup locations, restore steps, RTO/RPO targets |
| [deploy-rollback.md](./deploy-rollback.md) | `scripts/deploy.sh` deploy path + code/DB rollback |
| [incident-response.md](./incident-response.md) | Severity, communication, containment |
| [observability.md](./observability.md) | Request IDs, optional Sentry, structured logs |
| [staging-idor-matrix.md](./staging-idor-matrix.md) | Manual staging IDOR evidence pack |

Related: [DOCKER.md](../../DOCKER.md) (deploy), [REMAINING_WORK.md](../../REMAINING_WORK.md).
