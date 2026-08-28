<?php

/**
 * Access Control re-engineering (PRD v1.0, 30 July 2026).
 *
 * Spatie remains the capability store. This registry adds metadata, scopes,
 * risk classification, and legacy→canonical aliases for the PDP.
 */
return [
    'cache_ttl_seconds' => (int) env('ACCESS_CONTROL_CACHE_TTL', 60),
    'endpoint_enforcement_mode' => env('ACCESS_CONTROL_ENDPOINT_ENFORCEMENT', 'mapped'),
    'endpoint_enforcement_exemptions' => [
        'api/v1/auth/*',
        'api/v1/access/effective',
        'api/v1/access/navigation',
        'api/v1/access/authorize',
        'api/v1/access/requests',
        'api/v1/profile',
        'api/v1/profile/*',
        'api/v1/setup/*',
        'api/v1/email-action/*',
    ],
    'endpoint_fallback_permission_rules' => [
        ['pattern' => 'api/v1/admin/access-requests*', 'permissions' => [
            'READ' => ['admin.access.requests.manage', 'users.view'],
            'WRITE' => ['admin.roles.approve', 'users.edit'],
        ]],
        ['pattern' => 'api/v1/admin/users*', 'permissions' => [
            'GET' => ['admin.users.view', 'users.view'],
            'POST' => ['admin.users.create', 'users.create'],
            'PUT' => ['admin.users.edit', 'users.edit'],
            'PATCH' => ['admin.users.edit', 'users.edit'],
            'DELETE' => ['admin.users.edit', 'users.delete'],
        ]],
        ['pattern' => 'api/v1/admin/roles*', 'permissions' => [
            'READ' => ['admin.roles.view', 'roles.manage'],
            'WRITE' => ['admin.roles.manage', 'roles.manage'],
            'DELETE' => ['admin.roles.manage', 'roles.manage'],
        ]],
        ['pattern' => 'api/v1/admin/departments*', 'permissions' => [
            'READ' => ['admin.organisation.manage', 'users.view', 'dashboard.view', 'profile.read.self'],
            'WRITE' => ['admin.organisation.manage'],
        ]],
        ['pattern' => 'api/v1/admin/positions*', 'permissions' => [
            'READ' => ['admin.organisation.manage', 'positions.manage'],
            'WRITE' => ['admin.organisation.manage', 'positions.manage'],
        ]],
        ['pattern' => 'api/v1/admin/dashboard', 'permissions' => [
            'READ' => ['admin-console.view'],
        ]],
        ['pattern' => 'api/v1/admin/platform-status', 'permissions' => [
            'READ' => ['admin-console.view-health'],
        ]],
        ['pattern' => 'api/v1/admin/system-health', 'permissions' => [
            'READ' => ['admin-console.view-health'],
        ]],
        ['pattern' => 'api/v1/admin/modules*', 'permissions' => [
            'READ' => ['admin-console.view-modules'],
            'WRITE' => ['admin-console.manage-modules'],
        ]],
        ['pattern' => 'api/v1/admin/configurations*', 'permissions' => [
            'READ' => ['admin-console.view-config'],
            'WRITE' => ['admin-console.propose-config', 'admin-console.approve-config', 'admin-console.activate-config', 'admin-console.rollback-config'],
        ]],
        ['pattern' => 'api/v1/admin/configuration-changes*', 'permissions' => [
            'READ' => ['admin-console.view-config'],
            'WRITE' => ['admin-console.review-config', 'admin-console.approve-config', 'admin-console.activate-config', 'admin-console.rollback-config'],
        ]],
        ['pattern' => 'api/v1/admin/reference-data*', 'permissions' => [
            'READ' => ['admin-console.manage-reference-data'],
            'WRITE' => ['admin-console.manage-reference-data', 'admin-console.approve-reference-data'],
        ]],
        ['pattern' => 'api/v1/admin/feature-flags*', 'permissions' => [
            'READ' => ['admin-console.manage-feature-flags'],
            'WRITE' => ['admin-console.manage-feature-flags', 'admin-console.approve-feature-flags'],
        ]],
        ['pattern' => 'api/v1/admin/calendars*', 'permissions' => [
            'READ' => ['admin-console.manage-calendars'],
            'WRITE' => ['admin-console.manage-calendars'],
        ]],
        ['pattern' => 'api/v1/admin/numbering-schemes*', 'permissions' => [
            'READ' => ['admin-console.manage-numbering'],
            'WRITE' => ['admin-console.manage-numbering'],
        ]],
        ['pattern' => 'api/v1/admin/localisation*', 'permissions' => [
            'READ' => ['admin-console.manage-localisation'],
            'WRITE' => ['admin-console.manage-localisation'],
        ]],
        ['pattern' => 'api/v1/admin/integrations*', 'permissions' => [
            'READ' => ['admin-console.manage-integrations'],
            'WRITE' => ['admin-console.manage-integrations'],
        ]],
        ['pattern' => 'api/v1/admin/jobs*', 'permissions' => [
            'READ' => ['admin-console.view-jobs'],
            'WRITE' => ['admin-console.run-jobs'],
        ]],
        ['pattern' => 'api/v1/admin/job-runs*', 'permissions' => [
            'READ' => ['admin-console.view-jobs'],
        ]],
        ['pattern' => 'api/v1/admin/queues*', 'permissions' => [
            'READ' => ['admin-console.view-jobs'],
        ]],
        ['pattern' => 'api/v1/admin/dead-letters*', 'permissions' => [
            'READ' => ['admin-console.manage-dead-letters'],
            'WRITE' => ['admin-console.manage-dead-letters'],
        ]],
        ['pattern' => 'api/v1/admin/maintenance-windows*', 'permissions' => [
            '*' => ['admin-console.manage-maintenance'],
        ]],
        ['pattern' => 'api/v1/admin/system-banners*', 'permissions' => [
            '*' => ['admin-console.manage-banners'],
        ]],
        ['pattern' => 'api/v1/admin/data-quality*', 'permissions' => [
            'READ' => ['admin-console.manage-data-quality'],
        ]],
        ['pattern' => 'api/v1/admin/data-corrections*', 'permissions' => [
            'READ' => ['admin-console.manage-data-quality'],
            'WRITE' => ['admin-console.request-data-correction', 'admin-console.approve-data-correction', 'admin-console.execute-data-correction'],
        ]],
        ['pattern' => 'api/v1/admin/backups*', 'permissions' => [
            'READ' => ['admin-console.view-backups'],
        ]],
        ['pattern' => 'api/v1/admin/restore-requests*', 'permissions' => [
            'READ' => ['admin-console.view-restore'],
            'WRITE' => ['admin-console.request-restore'],
        ]],
        ['pattern' => 'api/v1/admin/imports*', 'permissions' => [
            'READ' => ['admin-console.manage-data-quality'],
        ]],
        ['pattern' => 'api/v1/admin/migrations*', 'permissions' => [
            'READ' => ['admin-console.manage-data-quality'],
        ]],
        ['pattern' => 'api/v1/admin/support-sessions*', 'permissions' => [
            '*' => ['admin-console.manage-support-sessions'],
        ]],
        ['pattern' => 'api/v1/admin/break-glass*', 'permissions' => [
            'WRITE' => ['admin-console.request-break-glass', 'admin-console.approve-break-glass'],
        ]],
        ['pattern' => 'api/v1/admin/*', 'permissions' => [
            '*' => ['admin.platform.manage', 'system.admin'],
        ]],
        ['pattern' => 'api/v1/procurement/requests*', 'permissions' => [
            'READ' => ['procurement.view', 'procurement.admin', 'procurement.request.read.created', 'procurement.module.view', 'procurement.create'],
            'POST' => ['procurement.create', 'procurement.approve', 'procurement.admin', 'procurement.request.create', 'procurement.hod_approve'],
            'PUT' => ['procurement.create', 'procurement.approve', 'procurement.admin', 'procurement.request.edit.created'],
            'PATCH' => ['procurement.create', 'procurement.approve', 'procurement.admin', 'procurement.request.edit.created'],
            'DELETE' => ['procurement.create', 'procurement.admin', 'procurement.request.edit.created'],
        ]],
        ['pattern' => 'api/v1/procurement/supplier*', 'permissions' => [
            'READ' => ['supplier.portal', 'procurement.bid.read.own'],
            'WRITE' => ['supplier.portal', 'procurement.bid.submit.own'],
        ]],
        ['pattern' => 'api/v1/procurement/newspaper-notice-templates', 'permissions' => [
            'READ' => ['procurement.view', 'procurement.admin'],
        ]],
        ['pattern' => 'api/v1/procurement/committee-evaluations*', 'permissions' => [
            'READ' => [
                'procurement.evaluation.read.assigned',
                'procurement.view',
                'procurement.admin',
            ],
        ]],
        ['pattern' => 'api/v1/procurement/vendors*', 'permissions' => [
            'GET' => ['procurement.view', 'procurement.admin', 'procurement.manage_vendors', 'procurement.supplier.read'],
            'WRITE' => ['procurement.manage_vendors', 'procurement.admin', 'procurement.supplier.approve', 'procurement.create'],
        ]],
        ['pattern' => 'api/v1/procurement/invoices*', 'permissions' => [
            'READ' => ['procurement.view', 'procurement.approve_invoice', 'finance.view', 'finance.approve', 'procurement.admin'],
            'WRITE' => ['procurement.approve_invoice', 'finance.approve', 'finance.create', 'procurement.manage_po', 'procurement.admin'],
        ]],
        ['pattern' => 'api/v1/procurement/receipts*', 'permissions' => [
            'READ' => ['procurement.view', 'procurement.receive_goods', 'procurement.admin'],
            'WRITE' => ['procurement.receive_goods', 'procurement.admin', 'procurement.manage_po'],
        ]],
        ['pattern' => 'api/v1/procurement/purchase-orders*', 'permissions' => [
            'READ' => ['procurement.view', 'procurement.manage_po', 'procurement.receive_goods', 'finance.view', 'procurement.admin'],
            'WRITE' => ['procurement.manage_po', 'procurement.receive_goods', 'procurement.approve_invoice', 'finance.create', 'procurement.admin'],
        ]],
        ['pattern' => 'api/v1/procurement*', 'permissions' => [
            'READ' => ['procurement.view', 'procurement.admin', 'procurement.request.read.created', 'procurement.module.view'],
            'POST' => ['procurement.create', 'procurement.approve', 'procurement.admin', 'procurement.request.create', 'procurement.hod_approve'],
            'PUT' => ['procurement.create', 'procurement.approve', 'procurement.admin', 'procurement.request.edit.created'],
            'PATCH' => ['procurement.create', 'procurement.approve', 'procurement.admin', 'procurement.request.edit.created'],
            'DELETE' => ['procurement.admin'],
        ]],
        ['pattern' => 'api/v1/hr/timesheets/capacity-analytics', 'permissions' => [
            'READ' => ['hr.view', 'hr.admin', 'hr.approve', 'hr.edit', 'timesheets.view', 'timesheet.module.view'],
        ]],
        ['pattern' => 'api/v1/hr/timesheets/attendance/clock', 'permissions' => [
            'WRITE' => ['timesheet.create.self', 'timesheet.module.view', 'timesheets.create', 'hr.create', 'hr.admin'],
        ]],
        ['pattern' => 'api/v1/hr/timesheets*', 'permissions' => [
            'READ' => [
                'hr.view', 'hr.admin', 'timesheets.view', 'timesheets.view-own',
                'timesheet.module.view', 'timesheet.read.self',
            ],
            'WRITE' => [
                'hr.create', 'hr.edit', 'hr.admin', 'timesheets.create',
                'timesheets.create-own', 'timesheet.create.self',
            ],
        ]],
        ['pattern' => 'api/v1/hr/files*', 'permissions' => [
            'READ' => ['hr.view', 'hr.admin', 'profile.read.self', 'dashboard.view'],
            'WRITE' => ['hr.create', 'hr.edit', 'hr.admin'],
        ]],
        ['pattern' => 'api/v1/hr/documents', 'permissions' => [
            'READ' => ['hr.view', 'hr.admin', 'profile.read.self', 'documents.view.authorised'],
        ]],
        ['pattern' => 'api/v1/hr/incidents*', 'permissions' => [
            'READ' => ['hr.view', 'hr.admin', 'hr.create', 'profile.read.self'],
            'POST' => ['hr.create', 'hr.admin', 'profile.read.self', 'dashboard.view'],
            'PUT' => ['hr.create', 'hr.edit', 'hr.approve', 'hr.admin'],
            'PATCH' => ['hr.create', 'hr.edit', 'hr.approve', 'hr.admin'],
            'DELETE' => ['hr.admin'],
        ]],
        ['pattern' => 'api/v1/hr*', 'permissions' => [
            'READ' => ['hr.view', 'hr.admin'],
            'POST' => ['hr.create', 'hr.admin'],
            'PUT' => ['hr.edit', 'hr.admin'],
            'PATCH' => ['hr.edit', 'hr.admin'],
            'DELETE' => ['hr.admin'],
        ]],
        ['pattern' => 'api/v1/people-authority*', 'permissions' => [
            'READ' => ['people.view-directory', 'people.view-profile', 'people.manage'],
            'WRITE' => ['people.manage', 'roles.assign', 'authorities.manage'],
        ]],
        ['pattern' => 'api/v1/audit-management/findings*', 'permissions' => [
            'READ' => ['audit.view', 'audit.events.view', 'audit.admin', 'audit.findings.view', 'audit.response.manage'],
            'WRITE' => [
                'audit.admin', 'audit.findings.issue', 'audit.response.manage', 'audit.corrective.manage',
            ],
        ]],
        ['pattern' => 'api/v1/audit-management/corrective-actions*', 'permissions' => [
            'WRITE' => ['audit.admin', 'audit.corrective.manage', 'audit.corrective.verify'],
        ]],
        ['pattern' => 'api/v1/audit-management*', 'permissions' => [
            'READ' => ['audit.view', 'audit.events.view', 'audit.admin'],
            'WRITE' => ['audit.admin', 'audit.plan.manage', 'audit.engagement.manage', 'audit.plan.approve'],
        ]],
        ['pattern' => 'api/v1/audit-admin*', 'permissions' => [
            '*' => ['audit-trail.admin', 'audit.view', 'system.admin'],
        ]],
        ['pattern' => 'api/v1/audit-events*', 'permissions' => [
            'READ' => ['audit-trail.search', 'audit.view'],
            'WRITE' => ['audit-trail.admin', 'audit-trail.manage-ingestion'],
        ]],
        ['pattern' => 'api/v1/audit-integrity*', 'permissions' => [
            '*' => ['audit-trail.verify-integrity', 'audit-trail.admin'],
        ]],
        ['pattern' => 'api/v1/security-alerts*', 'permissions' => [
            'READ' => ['audit-trail.view-security', 'audit-trail.manage-alerts', 'audit-trail.admin'],
            'WRITE' => ['audit-trail.manage-alerts', 'audit-trail.admin'],
        ]],
        ['pattern' => 'api/v1/forensic-cases*', 'permissions' => [
            '*' => ['audit-trail.create-forensic-case', 'audit-trail.admin'],
        ]],
        ['pattern' => 'api/v1/forensic-packages*', 'permissions' => [
            'READ' => ['audit-trail.create-forensic-case', 'audit-trail.search', 'audit-trail.admin'],
        ]],
        ['pattern' => 'api/v1/records*', 'permissions' => [
            'READ' => ['audit-trail.view-record-history', 'audit.view'],
        ]],
        ['pattern' => 'api/v1/budget/variance/scan*', 'permissions' => [
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/budget/variance/explanations*', 'permissions' => [
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/budget/variance*', 'permissions' => [
            'READ' => ['finance.view', 'finance.admin', 'dashboard.view'],
            // HOD posts explanations; Finance reviews via explanations* above.
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin', 'dashboard.view'],
        ]],
        ['pattern' => 'api/v1/budget/journals', 'permissions' => [
            'WRITE' => [
                'finance.create', 'finance.approve', 'finance.admin',
                'programme.budget_availability.confirm.assigned',
            ],
        ]],
        ['pattern' => 'api/v1/budget*', 'permissions' => [
            'READ' => ['finance.view', 'finance.admin'],
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/risk*', 'permissions' => [
            'READ' => ['risk.view', 'risk.module.view'],
            'POST' => ['risk.create', 'risk.manage', 'risk.admin'],
            'PUT' => ['risk.manage', 'risk.admin'],
            'PATCH' => ['risk.manage', 'risk.admin'],
            'DELETE' => ['risk.admin'],
        ]],
        ['pattern' => 'api/v1/mande*', 'permissions' => [
            'READ' => ['mande.view', 'mande.module.view'],
            'WRITE' => ['mande.create', 'mande.review', 'mande.admin'],
        ]],
        ['pattern' => 'api/v1/travel*', 'permissions' => [
            'READ' => ['travel.view', 'travel.admin', 'travel.module.view', 'travel.request.read.self'],
            'POST' => ['travel.create', 'travel.approve', 'travel.admin', 'travel.request.create.self'],
            'PUT' => ['travel.create', 'travel.approve', 'travel.admin', 'travel.request.create.self'],
            'PATCH' => ['travel.create', 'travel.approve', 'travel.admin', 'travel.request.create.self'],
            'DELETE' => ['travel.admin'],
        ]],
        ['pattern' => 'api/v1/finance/advances/policies*', 'permissions' => [
            'READ' => ['salary_advance.admin', 'salary_advance.view', 'finance.admin', 'finance.view'],
            'WRITE' => ['salary_advance.admin', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/finance/advances*', 'permissions' => [
            'READ' => [
                'salary_advance.request.read.self', 'salary_advance.module.view',
                'salary_advance.view', 'finance.view', 'finance.admin',
            ],
            'WRITE' => [
                'salary_advance.request.create.self', 'salary_advance.request.edit.created',
                'salary_advance.request.submit.created', 'salary_advance.create',
                'salary_advance.certify', 'salary_advance.approve', 'salary_advance.finance_certify.assigned',
                'salary_advance.admin', 'finance.create', 'finance.approve', 'finance.admin',
            ],
        ]],
        ['pattern' => 'api/v1/finance/budgets*', 'permissions' => [
            'READ' => ['finance.view', 'finance.admin', 'dashboard.view'],
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/finance/balance-register*', 'permissions' => [
            'READ' => [
                'finance.view', 'finance.admin',
                'salary_advance.module.view', 'salary_advance.view',
                'imprest.view', 'dashboard.view',
            ],
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/finance*', 'permissions' => [
            'READ' => ['finance.view', 'finance.admin'],
            'WRITE' => ['finance.create', 'finance.approve', 'finance.admin'],
        ]],
        ['pattern' => 'api/v1/correspondence*', 'permissions' => [
            'READ' => ['correspondence.view', 'correspondence.read.assigned', 'correspondence.admin'],
            'POST' => ['correspondence.create', 'correspondence.review', 'correspondence.approve', 'correspondence.admin'],
            'PUT' => ['correspondence.create', 'correspondence.review', 'correspondence.approve', 'correspondence.admin'],
            'PATCH' => ['correspondence.create', 'correspondence.review', 'correspondence.approve', 'correspondence.admin'],
            'DELETE' => ['correspondence.admin'],
        ]],
        ['pattern' => 'api/v1/stock*', 'permissions' => [
            'READ' => ['stock.view', 'stock.admin'],
            'POST' => ['stock.create', 'stock.issue', 'stock.approve', 'stock.admin'],
            'PUT' => ['stock.edit', 'stock.transfer', 'stock.admin'],
            'PATCH' => ['stock.edit', 'stock.transfer', 'stock.admin'],
            'DELETE' => ['stock.admin'],
        ]],
        ['pattern' => 'api/v1/assignments/nl-search', 'permissions' => [
            'READ' => ['assignments.view', 'assignment.read.assigned', 'assignments.create', 'assignments.admin'],
            'WRITE' => ['assignments.view', 'assignment.read.assigned', 'assignments.create', 'assignments.admin'],
        ]],
        ['pattern' => 'api/v1/assignments/handover-pack.docx', 'permissions' => [
            'READ' => ['assignments.view', 'assignments.team', 'assignments.admin', 'assignment.read.assigned'],
        ]],
        ['pattern' => 'api/v1/assignments/workload-forecast', 'permissions' => [
            'READ' => ['assignments.view', 'assignments.team', 'assignments.admin'],
        ]],
        ['pattern' => 'api/v1/assignments*', 'permissions' => [
            'READ' => ['assignments.view', 'assignment.read.assigned', 'assignments.admin'],
            'WRITE' => ['assignments.create', 'assignments.issue', 'assignments.review', 'assignments.admin', 'assignment.module.view'],
        ]],
        ['pattern' => 'api/v1/programmes*', 'permissions' => [
            'READ' => ['pif.view', 'programme.request.read.created', 'programme.request.read.assigned'],
            'POST' => ['pif.create', 'programme.request.create', 'pif.approve', 'pif.admin'],
            'PUT' => ['pif.create', 'pif.approve', 'programme.finance-review', 'pif.admin'],
            'PATCH' => ['pif.create', 'pif.approve', 'programme.finance-review', 'pif.admin'],
            'DELETE' => ['pif.admin'],
        ]],
        ['pattern' => 'api/v1/leave*', 'permissions' => [
            'READ' => ['leave.view', 'leave.approve', 'leave.admin', 'leave.module.view', 'leave.request.read.self'],
            'POST' => ['leave.create', 'leave.approve', 'leave.admin', 'leave.request.create.self'],
            'PUT' => ['leave.create', 'leave.approve', 'leave.admin', 'leave.request.edit.created'],
            'PATCH' => ['leave.create', 'leave.approve', 'leave.admin', 'leave.request.edit.created'],
            'DELETE' => ['leave.admin'],
        ]],
        ['pattern' => 'api/v1/documents*', 'permissions' => [
            'READ' => ['documents.view', 'documents.view.authorised', 'documents.download'],
            'POST' => ['documents.upload', 'documents.finalize', 'documents.admin'],
            'PUT' => ['documents.admin', 'documents.legal-hold'],
            'PATCH' => ['documents.admin', 'documents.legal-hold'],
            'DELETE' => ['documents.admin'],
        ]],
        ['pattern' => 'api/v1/governance*', 'permissions' => [
            'READ' => ['governance.view', 'governance.admin'],
            'WRITE' => ['governance.create', 'governance.approve', 'governance.admin'],
        ]],
        ['pattern' => 'api/v1/workflow-engine*', 'permissions' => [
            'READ' => ['workflows.view-own', 'workflows.view-department', 'workflows.view-all', 'workflows.admin'],
            'WRITE' => ['workflows.submit', 'workflows.act', 'workflows.manage-definitions', 'workflows.admin'],
        ]],
        ['pattern' => 'api/v1/notifications*', 'permissions' => [
            'READ' => ['notifications.view-own', 'notifications.view.own', 'notifications.admin'],
            'WRITE' => ['notifications.manage-own-preferences', 'notifications.manage.preferences', 'notifications.acknowledge', 'notifications.admin'],
        ]],
        ['pattern' => 'api/v1/notification-admin*', 'permissions' => [
            '*' => ['notifications.admin', 'notifications.manage-policies'],
        ]],
        ['pattern' => 'api/v1/weekly-summaries*', 'permissions' => [
            'READ' => [
                'weekly-reports.view-own', 'weekly-reports.view-team', 'weekly_report.module.view',
                'weekly-reports.review-team', 'weekly-reports.accept', 'weekly-reports.admin',
                'weekly-reports.view-management',
            ],
            'WRITE' => ['weekly-reports.create-own', 'weekly_report.create.self', 'weekly-reports.review-team', 'weekly-reports.admin'],
        ]],
        ['pattern' => 'api/v1/weekly-summary*', 'permissions' => [
            'READ' => ['weekly-reports.view-own', 'weekly-reports.view-team', 'weekly_report.module.view'],
            'WRITE' => ['weekly-reports.create-own', 'weekly_report.create.self', 'weekly-reports.review-team', 'weekly-reports.admin'],
        ]],
        ['pattern' => 'api/v1/weekly-report-risks*', 'permissions' => [
            'READ' => ['weekly-reports.view-own', 'weekly-reports.view-team'],
            'WRITE' => ['weekly-reports.create-risk', 'weekly-reports.admin'],
        ]],
        ['pattern' => 'api/v1/srhr*', 'permissions' => [
            'READ' => ['srhr.view', 'srhr.admin'],
            'WRITE' => ['srhr.create', 'srhr.manage', 'srhr.admin'],
        ]],
        ['pattern' => 'api/v1/decisions/promote-meeting-pack', 'permissions' => [
            'WRITE' => ['decisions.manage', 'decisions.admin', 'governance.admin'],
        ]],
        ['pattern' => 'api/v1/decisions/promote-from-minutes', 'permissions' => [
            'WRITE' => ['decisions.manage', 'decisions.admin', 'governance.admin'],
        ]],
        ['pattern' => 'api/v1/decisions*', 'permissions' => [
            'READ' => ['decisions.view', 'decisions.admin'],
            'WRITE' => ['decisions.create', 'decisions.adopt', 'decisions.manage', 'decisions.admin'],
        ]],
        ['pattern' => 'api/v1/assets/{asset}/acknowledge', 'permissions' => [
            'WRITE' => [
                'assets.edit',
                'assets.manage',
                'assets.admin',
                'dashboard.view',
                'profile.read.self',
            ],
        ]],
        ['pattern' => 'api/v1/assets-meta*', 'permissions' => [
            'READ' => ['assets.view', 'assets.admin'],
            'WRITE' => ['assets.manage', 'assets.admin'],
        ]],
        ['pattern' => 'api/v1/asset-requests*', 'permissions' => [
            'READ' => ['assets.view', 'assets.admin', 'dashboard.view', 'profile.read.self'],
            'POST' => ['assets.create', 'assets.edit', 'dashboard.view', 'profile.read.self'],
            'PUT' => ['assets.edit', 'assets.manage', 'assets.admin', 'dashboard.view', 'profile.read.self'],
            'PATCH' => ['assets.edit', 'assets.manage', 'assets.admin', 'dashboard.view', 'profile.read.self'],
            'DELETE' => ['assets.admin', 'dashboard.view', 'profile.read.self'],
        ]],
        ['pattern' => 'api/v1/asset-*', 'permissions' => [
            'READ' => ['assets.view', 'assets.admin'],
            'POST' => ['assets.create', 'assets.edit', 'assets.manage', 'assets.admin'],
            'PUT' => ['assets.edit', 'assets.manage', 'assets.admin'],
            'PATCH' => ['assets.edit', 'assets.manage', 'assets.admin'],
            'DELETE' => ['assets.admin'],
        ]],
        ['pattern' => 'api/v1/assets*', 'permissions' => [
            'READ' => ['assets.view', 'assets.admin'],
            'POST' => ['assets.create', 'assets.manage', 'assets.admin'],
            'PUT' => ['assets.edit', 'assets.manage', 'assets.admin'],
            'PATCH' => ['assets.edit', 'assets.manage', 'assets.admin'],
            'DELETE' => ['assets.admin'],
        ]],
        ['pattern' => 'api/v1/workplan*', 'permissions' => [
            'READ' => ['workplan.view', 'workplan.admin'],
            'WRITE' => ['workplan.create', 'workplan.approve', 'workplan.admin'],
        ]],
        ['pattern' => 'api/v1/reports/schedules/{id}/approve', 'permissions' => [
            'WRITE' => ['reports.manage-schedules'],
        ]],
        ['pattern' => 'api/v1/reports/schedules/{id}/pause', 'permissions' => [
            'WRITE' => ['reports.manage-schedules'],
        ]],
        ['pattern' => 'api/v1/reports/schedules', 'permissions' => [
            'READ' => ['reports.view'],
            'WRITE' => ['reports.schedule'],
        ]],
        ['pattern' => 'api/v1/reports/export-events', 'permissions' => [
            'READ' => ['reports.view'],
        ]],
        ['pattern' => 'api/v1/reports*', 'permissions' => [
            'READ' => ['reports.view', 'reports.view.authorised'],
            'WRITE' => ['reports.export', 'reports.export.authorised'],
        ]],
        ['pattern' => 'api/v1/analytics*', 'permissions' => [
            'READ' => ['reports.view', 'reports.view.authorised'],
        ]],
        ['pattern' => 'api/v1/saam*', 'permissions' => [
            'READ' => ['saam.view'],
            'WRITE' => ['saam.delegate'],
        ]],
        ['pattern' => 'api/v1/imprest*', 'permissions' => [
            'READ' => ['imprest.view'],
            'WRITE' => ['imprest.create', 'imprest.approve', 'imprest.liquidate'],
        ]],
        ['pattern' => 'api/v1/fleet*', 'permissions' => [
            'READ' => ['admin.platform.manage', 'system.admin'],
            'WRITE' => ['admin.platform.manage', 'system.admin'],
        ]],
        ['pattern' => 'api/v1/approvals*', 'permissions' => [
            'READ' => ['approvals.inbox.view', 'workflows.view-own'],
            'WRITE' => ['approvals.task.act.assigned', 'workflows.act'],
        ]],
        ['pattern' => 'api/v1/calendar*', 'permissions' => [
            'READ' => ['calendar.view'],
            'WRITE' => ['calendar.create', 'calendar.admin'],
        ]],
        ['pattern' => 'api/v1/support*', 'permissions' => [
            'READ' => ['support.view'],
            'WRITE' => ['support.create', 'support.admin'],
        ]],
        ['pattern' => 'api/v1/dashboard*', 'permissions' => [
            'READ' => ['dashboard.view', 'reports.view'],
        ]],
        ['pattern' => 'api/v1/lookups', 'permissions' => [
            'READ' => ['dashboard.view', 'reports.view'],
        ]],
        ['pattern' => 'api/v1/tenant-users', 'permissions' => [
            'READ' => ['users.view', 'people.view-directory', 'dashboard.view', 'reports.view'],
        ]],
        ['pattern' => 'api/v1/users*', 'permissions' => [
            'READ' => ['users.view', 'people.view-directory'],
        ]],
        ['pattern' => 'api/v1/alerts*', 'permissions' => [
            'READ' => ['notifications.view-own', 'notifications.view.own', 'notifications.admin'],
        ]],
    ],

    'scopes' => [
        'self',
        'created',
        'assigned',
        'direct_reports',
        'reporting_tree',
        'department',
        'directorate',
        'project',
        'programme',
        'workflow_stage',
        'specific_records',
        'organisation',
        'system',
    ],

    /**
     * Legacy Spatie permission → canonical keys (union during transition).
     * Holding a legacy key grants the listed canonical capabilities for PDP/nav.
     */
    'legacy_aliases' => [
        'leave.view' => [
            'leave.request.read.self',
            'leave.balance.read.self',
            'leave.module.view',
        ],
        'leave.create' => [
            'leave.request.create.self',
            'leave.request.edit.created',
            'leave.request.submit.created',
            'leave.request.withdraw.created',
            'leave.module.view',
        ],
        'leave.approve' => [
            'leave.request.read.direct_reports',
            'leave.request.recommend.assigned',
            'leave.request.return.assigned',
            'leave.request.authorise.assigned',
            'leave.request.reject.assigned',
            'leave.module.view',
        ],
        'leave.admin' => [
            'leave.balance.certify.assigned',
            'leave.balance.adjust',
            'leave.balance.import',
            'leave.balance.export',
            'leave.calendar.view.organisation',
            'leave.report.view',
            'leave.report.export',
            'leave.type.configure',
            'leave.workflow.configure',
            'leave.module.view',
            'leave.request.read.direct_reports',
            'leave.request.authorise.assigned',
        ],
        'pif.view' => ['programme.request.read.created', 'programme.module.view'],
        'pif.create' => [
            'programme.request.create',
            'programme.request.edit.created',
            'programme.request.submit.created',
            'programme.request.withdraw.created',
            'programme.document.manage.created',
            'programme.module.view',
        ],
        'pif.approve' => [
            'programme.activity_authorise.act.assigned',
            'programme.sg_approval.act.assigned',
            'programme.module.view',
        ],
        'pif.admin' => [
            'programme.configuration.manage',
            'programme.report.view',
            'programme.report.export',
            'programme.module.view',
        ],
        'programme.finance-review' => [
            'programme.finance_review.read.assigned',
            'programme.finance_review.update.assigned',
            'programme.budget_availability.confirm.assigned',
            'programme.module.view',
        ],
        'governance.view' => ['programme.module.view', 'programme.request.read.created'],
        'salary_advance.view' => [
            'salary_advance.request.read.self',
            'salary_advance.module.view',
        ],
        'salary_advance.create' => [
            'salary_advance.request.create.self',
            'salary_advance.request.edit.created',
            'salary_advance.request.submit.created',
            'salary_advance.request.withdraw.created',
            'salary_advance.module.view',
        ],
        'salary_advance.certify' => [
            'salary_advance.financial_details.read.assigned',
            'salary_advance.salary_verify.assigned',
            'salary_advance.outstanding_advance_verify.assigned',
            'salary_advance.threshold_verify.assigned',
            'salary_advance.finance_certify.assigned',
            'salary_advance.module.view',
        ],
        'salary_advance.approve' => [
            'salary_advance.approve.assigned',
            'salary_advance.reject.assigned',
            'salary_advance.return.assigned',
            'salary_advance.module.view',
        ],
        'salary_advance.pay' => [
            'salary_advance.payroll_deduction.record.assigned',
            'salary_advance.module.view',
        ],
        'salary_advance.recover' => [
            'salary_advance.settlement.close.assigned',
            'salary_advance.module.view',
        ],
        'salary_advance.export' => [
            'salary_advance.report.view',
            'salary_advance.report.export',
        ],
        'salary_advance.admin' => [
            'salary_advance.configuration.manage',
            'salary_advance.module.view',
        ],
        'travel.view' => [
            'travel.module.view',
            'travel.request.read.self',
        ],
        'travel.create' => [
            'travel.request.create.self',
            'travel.module.view',
        ],
        'travel.approve' => [
            'travel.request.approve.assigned',
            'travel.module.view',
        ],
        'travel.admin' => [
            'travel.module.view',
            'travel.request.approve.assigned',
        ],
        'reports.view' => [
            'reports.view.authorised',
        ],
        'reports.export' => [
            'reports.export.authorised',
        ],
        'finance.view' => [
            'programme.budget_availability.confirm.assigned',
            'programme.module.view',
        ],
        'finance.create' => [
            'programme.budget_availability.confirm.assigned',
        ],
        'finance.approve' => [
            'programme.budget_availability.confirm.assigned',
        ],
        'assignments.view' => [
            'assignment.read.assigned',
            'assignment.module.view',
        ],
        'assignments.create' => [
            'assignment.module.view',
        ],
        'notifications.view-own' => [
            'notifications.view.own',
        ],
        'notifications.manage-own-preferences' => [
            'notifications.manage.preferences',
        ],
        'weekly-reports.view-own' => [
            'weekly_report.module.view',
        ],
        'weekly-reports.create-own' => [
            'weekly_report.create.self',
        ],
        'timesheets.view-own' => [
            'timesheet.read.self',
            'timesheet.module.view',
        ],
        'timesheets.create-own' => [
            'timesheet.create.self',
        ],
        'lifecycle.view' => [
            'lifecycle.view-own',
            'lifecycle.complete-own-tasks',
        ],
        'procurement.view' => [
            'procurement.request.read.created',
            'procurement.module.view',
        ],
        'procurement.create' => [
            'procurement.request.create',
            'procurement.request.edit.created',
            'procurement.request.submit.created',
            'procurement.module.view',
        ],
        'procurement.approve' => [
            'procurement.request.approve.assigned',
            'procurement.request.review.assigned',
            'procurement.module.view',
        ],
        'procurement.hod_approve' => [
            'procurement.request.approve.assigned',
            'procurement.module.view',
        ],
        'procurement.award' => [
            'procurement.award.recommend.assigned',
            'procurement.award.approve.assigned',
            'procurement.module.view',
        ],
        'procurement.manage_vendors' => [
            'procurement.supplier.read',
            'procurement.supplier.invite',
            'procurement.supplier.verify',
            'procurement.supplier.approve',
            'procurement.module.view',
        ],
        'procurement.admin' => [
            'procurement.configuration.manage',
            'procurement.report.view',
            'procurement.report.export',
            'procurement.module.view',
        ],
        'roles.manage' => [
            'admin.roles.view',
            'admin.roles.manage',
            'admin.access.simulate',
            'admin.access.explore',
        ],
        // NOTE: Spatie `roles.view` / `roles.assign` are People & Authority (PA directory tooling),
        // NOT the admin Role Catalogue / Access Governance matrix. Do not alias them to admin.roles.*.
        // Access admins must hold admin.roles.* (or system.admin) directly.
        // 'roles.assign' intentionally NOT aliased — HR PA operators must not get Access Admin grant APIs.
        'roles.approve' => ['admin.roles.approve'],
        'roles.revoke' => ['admin.roles.revoke'],
        'users.view' => ['admin.users.view'],
        'users.create' => ['admin.users.create'],
        'users.edit' => ['admin.users.edit'],
        'system.admin' => ['admin.platform.manage', 'admin.roles.view', 'admin.roles.manage', 'admin.roles.assign'],
        'audit.view' => ['audit.event.read.organisation'],
        'audit.export' => ['audit.export.create.organisation'],
        'mande.view' => ['mande.module.view', 'mande.indicator.read', 'mande.dashboard.view'],
        'mande.create' => [
            'mande.module.view',
            'mande.indicator.create',
            'mande.activity_report.create',
            'mande.evidence.upload',
        ],
        'mande.review' => [
            'mande.module.view',
            'mande.activity_report.review.assigned',
            'mande.activity_report.accept.assigned',
            'mande.evidence.validate.assigned',
        ],
        'mande.admin' => ['mande.module.view', 'mande.configuration.manage', 'mande.strategic_plan.manage'],
    ],

    /**
     * Canonical permission definitions (seeded into Spatie + registry table).
     * key => [display, description, module, feature, action, scopes[], risk, classification, routes[], endpoints[]]
     */
    'permissions' => require __DIR__.'/access_control_permissions.php',

    /**
     * Role templates (seeded as Spatie roles + role_versions when published).
     */
    'role_templates' => require __DIR__.'/access_control_role_templates.php',

    /**
     * Mandatory SoD rules (PRD §16.1).
     */
    'sod_rules' => [
        [
            'code' => 'no_self_approve',
            'description' => 'A requester shall not approve their own request.',
            'severity' => true,
        ],
        [
            'code' => 'no_self_role_grant',
            'description' => 'A user shall not approve a role assignment benefiting themselves.',
            'severity' => true,
        ],
        [
            'code' => 'access_admin_no_self_privileged',
            'description' => 'An Access Administrator shall not assign themselves privileged access.',
            'severity' => true,
        ],
        [
            'code' => 'procurement_requester_not_sole_evaluator',
            'description' => 'A procurement requester shall not be the sole evaluator or award approver.',
            'severity' => true,
        ],
        [
            'code' => 'bid_opener_no_alter',
            'description' => 'A bid opener shall not alter bids.',
            'severity' => true,
        ],
        [
            'code' => 'finance_preparer_not_sole_final',
            'description' => 'A Finance preparer shall not be the sole final authoriser of the same transaction.',
            'severity' => true,
        ],
        [
            'code' => 'payroll_preparer_not_sole_approver',
            'description' => 'A payroll preparer shall not be the sole payroll approver.',
            'blocked' => true,
        ],
        [
            'code' => 'finance_certifier_not_auto_final',
            'description' => 'A user who certifies financial availability shall not automatically become the final institutional approver.',
            'blocked' => true,
        ],
        [
            'code' => 'auditor_read_only',
            'description' => 'An auditor shall not edit the business records being audited.',
            'blocked' => true,
        ],
        [
            'code' => 'ict_no_business_approve',
            'description' => 'ICT administrators shall not use technical privileges to perform business approvals.',
            'blocked' => true,
        ],
        [
            'code' => 'workflow_admin_no_business_approve',
            'description' => 'A workflow administrator shall not use routing correction to record a business approval.',
            'blocked' => true,
        ],
        [
            'code' => 'supplier_no_competitor_bids',
            'description' => 'A supplier shall never access competitors’ bids or evaluations.',
            'blocked' => true,
        ],
        [
            'code' => 'signature_admin_no_proxy_sign',
            'description' => 'A user with signature-administration rights shall not automatically be allowed to sign on behalf of another person.',
            'blocked' => true,
        ],
    ],

    /**
     * Business-approval permission prefixes — ICT Platform Admin / technical roles
     * must not exercise these even if Spatie accidentally grants them.
     */
    'business_approval_prefixes' => [
        'leave.request.authorise',
        'leave.request.recommend',
        'travel.request.approve',
        'salary_advance.approve',
        'salary_advance.finance_certify',
        'procurement.request.approve',
        'procurement.award.approve',
        'programme.sg_approval',
        'programme.activity_authorise',
        'programme.funds_procurement_rates.authorise',
    ],

    'ict_platform_admin_roles' => [
        'ICT Platform Administrator',
    ],

    'auditor_roles' => [
        'Internal Auditor',
        'External Auditor',
    ],
];
