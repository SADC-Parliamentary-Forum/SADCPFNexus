<?php

/**
 * Access Control re-engineering (PRD v1.0, 30 July 2026).
 *
 * Spatie remains the capability store. This registry adds metadata, scopes,
 * risk classification, and legacy→canonical aliases for the PDP.
 */
return [
    'cache_ttl_seconds' => (int) env('ACCESS_CONTROL_CACHE_TTL', 60),

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
