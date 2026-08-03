/// Feature access: whether the user can access a route/feature based on permissions and roles.
/// Aligns with web [canAccessRoute] and backend permissions.
library;

const _adminRoles = ['System Admin', 'System Administrator', 'super-admin'];

final _adminOnlyPaths = [
  '/admin',
  '/organogram',
  '/analytics',
  '/finance/budget',
  '/analytics/global-summary',
  '/dashboard/executive-cockpit',
  '/calendar/upload',
];

final _routeAccess = <String, List<String>>{
  '/dashboard': [],
  '/approvals': [
    'travel.approve',
    'travel.request.approve.assigned',
    'leave.approve',
    'leave.request.authorise.assigned',
    'imprest.approve',
    'procurement.approve',
    'procurement.request.approve.assigned',
    'finance.approve',
    'governance.approve',
    'hr.approve',
    'approvals.inbox.view',
    'approval.inbox.view',
    'approval.task.act.assigned',
  ],
  '/alerts': [],
  '/requests/travel/finance-queue': [
    'travel.finance-review',
    'travel.finance_review.update.assigned',
    'travel.funds.confirm.assigned',
    'travel.view',
    'finance.approve',
  ],
  '/requests/travel/toil': [
    'travel.review-toil',
    'travel.approve',
    'travel.request.approve.assigned',
    'hr.view',
  ],
  '/requests/travel/new': [
    'travel.view',
    'travel.create',
    'travel.request.create.self',
  ],
  '/requests/travel/detail': [
    'travel.view',
    'travel.request.read.self',
    'travel.request.approve.assigned',
  ],
  '/requests/leave/new': [
    'leave.view',
    'leave.create',
    'leave.request.create.self',
  ],
  '/requests/leave/balance': [
    'leave.view',
    'leave.balance.read.self',
  ],
  '/requests/leave/detail': [
    'leave.view',
    'leave.request.read.self',
    'leave.request.read.direct_reports',
  ],
  '/requests/imprest/detail': ['imprest.view'],
  '/requests': [],
  '/travel': [
    'travel.view',
    'travel.module.view',
    'travel.request.read.self',
  ],
  '/leave': [
    'leave.view',
    'leave.module.view',
    'leave.request.read.self',
  ],
  '/finance': [
    'finance.view',
    'salary_advance.financial_details.read.assigned',
    'programme.finance_review.read.assigned',
  ],
  '/finance/command-center': ['finance.view'],
  '/finance/budget-variance': ['finance.view'],
  '/finance/audit-compliance': ['finance.view', 'audit.event.read.organisation'],
  '/imprest/form': ['imprest.create', 'imprest.view'],
  '/imprest/retirement': ['imprest.view', 'imprest.liquidate'],
  '/imprest/audit': ['imprest.view', 'audit.event.read.organisation'],
  '/imprest': ['imprest.view'],
  '/pif/form': [
    'pif.create',
    'programme.request.create',
  ],
  '/pif/review': [
    'pif.approve',
    'programme.manager_review.act.assigned',
    'programme.activity_authorise.act.assigned',
  ],
  '/pif/budget': [
    'programme.finance-review',
    'programme.finance_review.read.assigned',
    'programme.finance_review.update.assigned',
  ],
  '/pif': [
    'governance.view',
    'pif.view',
    'programme.module.view',
    'programme.request.read.created',
  ],
  '/workplan': [],
  '/hr/incident/new': ['hr.create', 'hr.view'],
  '/hr/overtime/new': ['overtime.request', 'hr.view'],
  '/hr/performance': ['hr.view', 'appraisals.view'],
  '/hr/files': ['hr.view', 'people.view-profile'],
  '/hr/timesheets': [
    'hr.view',
    'timesheets.view',
    'timesheet.read.self',
  ],
  '/hr': ['hr.view', 'profile.read.self'],
  '/timesheets': [
    'timesheets.view',
    'timesheets.create',
    'timesheet.read.self',
    'timesheet.create.self',
  ],
  '/reports': ['reports.view', 'reports.view.authorised'],
  '/assets/request': ['assets.view', 'assets.create'],
  '/assets/inventory': ['assets.view'],
  '/assets/assigned': ['assets.view'],
  '/assets/condition-report': ['assets.view'],
  '/assets/fleet': ['assets.view'],
  '/assets': ['assets.view'],
  '/fleet': ['assets.view'],
  '/governance': ['governance.view', 'decisions.view', 'meetings.view'],
  '/procurement/vendors/new': [
    'procurement.manage_vendors',
    'procurement.supplier.invite',
    'procurement.supplier.approve',
  ],
  '/procurement/vendors': [
    'procurement.view',
    'procurement.manage_vendors',
    'procurement.supplier.read',
  ],
  '/procurement/form': [
    'procurement.create',
    'procurement.request.create',
  ],
  '/procurement/tenders': [
    'procurement.view',
    'procurement.rfq.publish.assigned',
    'procurement.bid.open.assigned',
  ],
  '/procurement/notices': ['procurement.view', 'procurement.supplier.read'],
  '/procurement/rfq': [
    'procurement.view',
    'procurement.rfq.create.assigned',
    'procurement.rfq.publish.assigned',
  ],
  '/procurement/approval-matrix': ['procurement.admin'],
  '/procurement/three-quote': ['procurement.view', 'procurement.admin'],
  '/procurement/detail': [
    'procurement.view',
    'procurement.request.read.created',
    'procurement.request.read.assigned',
  ],
  '/procurement': [
    'procurement.view',
    'procurement.module.view',
    'procurement.request.read.created',
  ],
  '/salary/advances': [
    'finance.view',
    'salary_advance.view',
    'salary_advance.module.view',
    'salary_advance.request.read.self',
    'salary_advance.request.create.self',
  ],
  '/salary/advance/new': [
    'finance.view',
    'salary_advance.create',
    'salary_advance.request.create.self',
  ],
  '/salary/advance/preview': [
    'finance.view',
    'salary_advance.view',
    'salary_advance.request.read.self',
  ],
  '/calendar': [],
  '/search': [],
  '/offline/drafts': [],
  '/support': [],
  '/profile/security': ['profile.read.self'],
  '/profile': [],
  '/notifications': [
    'notifications.view-own',
    'notification.read.self',
    'notifications.view',
  ],
  '/assignments/create': ['assignments.create', 'assignment.create'],
  '/assignments/calendar': ['assignments.view', 'assignment.read.assigned'],
  '/assignments': [
    'assignments.view',
    'assignment.module.view',
    'assignment.read.assigned',
  ],
  '/audit': [
    'audit.view',
    'audit.findings.view',
    'audit.dashboard.auditor',
    'audit.event.read.organisation',
    'governance.view',
  ],
  '/risk': ['risk.view', 'risk.register.view', 'governance.view'],
  '/correspondence': [
    'correspondence.view',
    'correspondence.read.created',
    'correspondence.read.assigned',
    'governance.view',
  ],
  '/stock/scan': ['stock.view', 'assets.view'],
  '/weekly-summaries': [
    'weekly-reports.view-own',
    'weekly_summary.read.self',
    'weekly_summary.create.self',
  ],
  '/budget/cashflow': ['finance.view', 'finance.create'],
};

bool _isSystemAdmin(List<String> roles) {
  return roles.any((r) => _adminRoles.contains(r));
}

/// Returns true if the user can access the given path.
/// [permissions] and [roles] typically come from stored user (login/me).
bool canAccessFeature(
    List<String> permissions, List<String> roles, String pathOrId) {
  final path = pathOrId.split('?').first;
  if (path.isEmpty) return false;
  if (permissions.isEmpty && roles.isEmpty) return false;

  for (final p in _adminOnlyPaths) {
    if (path == p || path.startsWith('$p/')) {
      return _isSystemAdmin(roles);
    }
  }

  MapEntry<String, List<String>>? match;
  for (final entry in _routeAccess.entries) {
    if (path == entry.key || path.startsWith('${entry.key}/')) {
      if (match == null || entry.key.length > match.key.length) {
        match = entry;
      }
    }
  }

  if (match == null) return false;
  if (match.value.isEmpty) return true;
  if (_isSystemAdmin(roles)) return true;
  return match.value.any((perm) => permissions.contains(perm));
}
