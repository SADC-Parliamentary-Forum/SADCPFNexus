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
  '/approvals': ['travel.approve', 'leave.approve', 'imprest.approve', 'procurement.approve', 'finance.approve', 'governance.approve', 'hr.approve'],
  '/alerts': [],
  '/travel': ['travel.view'],
  '/leave': ['leave.view'],
  '/finance': ['finance.view'],
  '/imprest': ['imprest.view'],
  '/pif': ['governance.view'],
  '/workplan': [],
  '/hr': ['hr.view'],
  '/reports': ['reports.view'],
  '/assets': ['assets.view'],
  '/assets/request': ['assets.view'],
  '/governance': ['governance.view'],
  '/procurement': ['procurement.view'],
  '/salary/advance/new': ['finance.view'],
  '/assets/fleet': ['assets.view'],
  '/calendar': [],
  '/search': [],
};

bool _isSystemAdmin(List<String> roles) {
  return roles.any((r) => _adminRoles.contains(r));
}

/// Returns true if the user can access the given path.
/// [permissions] and [roles] typically come from stored user (login/me).
/// When both are empty (e.g. not yet loaded), allows access so UI does not flash restricted.
bool canAccessFeature(List<String> permissions, List<String> roles, String pathOrId) {
  final path = pathOrId.split('?').first;
  if (path.isEmpty) return true;
  if (permissions.isEmpty && roles.isEmpty) return true;

  for (final p in _adminOnlyPaths) {
    if (path == p || path.startsWith('$p/')) {
      return _isSystemAdmin(roles);
    }
  }

  for (final entry in _routeAccess.entries) {
    if (path == entry.key || path.startsWith('${entry.key}/')) {
      if (entry.value.isEmpty) return true;
      if (_isSystemAdmin(roles)) return true;
      return entry.value.any((perm) => permissions.contains(perm));
    }
  }

  return true;
}
