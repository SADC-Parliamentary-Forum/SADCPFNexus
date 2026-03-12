import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/auth/feature_access.dart';

/// Stitch-aligned navigation drawer (hamburger menu).
/// Menu items are filtered by user permissions/roles.
class AppDrawer extends ConsumerStatefulWidget {
  const AppDrawer({super.key});

  @override
  ConsumerState<AppDrawer> createState() => _AppDrawerState();
}

class _DrawerEntry {
  const _DrawerEntry({
    required this.path,
    required this.label,
    required this.icon,
    this.activeIcon,
  });
  final String path;
  final String label;
  final IconData icon;
  final IconData? activeIcon;
}

const _mainEntries = [
  _DrawerEntry(path: '/dashboard', label: 'Home', icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard),
  _DrawerEntry(path: '/requests', label: 'Requests', icon: Icons.description_outlined, activeIcon: Icons.description),
  _DrawerEntry(path: '/approvals', label: 'Approvals', icon: Icons.approval_outlined, activeIcon: Icons.approval),
  _DrawerEntry(path: '/reports', label: 'Reports', icon: Icons.analytics_outlined, activeIcon: Icons.analytics),
  _DrawerEntry(path: '/profile', label: 'Profile', icon: Icons.person_outline, activeIcon: Icons.person),
];

const _moduleEntries = [
  _DrawerEntry(path: '/requests/travel/new', label: 'Travel', icon: Icons.flight_takeoff),
  _DrawerEntry(path: '/requests', label: 'Leave', icon: Icons.event_available),
  _DrawerEntry(path: '/finance/command-center', label: 'Finance', icon: Icons.account_balance_outlined),
  _DrawerEntry(path: '/procurement/form', label: 'Procurement', icon: Icons.inventory_2_outlined),
  _DrawerEntry(path: '/imprest/form', label: 'Imprest', icon: Icons.account_balance_wallet_outlined),
  _DrawerEntry(path: '/hr/dashboard', label: 'HR', icon: Icons.people_outline),
  _DrawerEntry(path: '/hr/performance', label: 'Performance Tracker', icon: Icons.trending_up_outlined),
  _DrawerEntry(path: '/hr/files', label: 'Employee Files', icon: Icons.folder_shared_outlined),
  _DrawerEntry(path: '/pif/form', label: 'PIF', icon: Icons.description_outlined),
  _DrawerEntry(path: '/governance/meetings', label: 'Governance', icon: Icons.gavel_outlined),
  _DrawerEntry(path: '/assets/inventory', label: 'Assets', icon: Icons.devices_outlined),
];

class _AppDrawerState extends ConsumerState<AppDrawer> {
  List<String> _permissions = [];
  List<String> _roles = [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAccess());
  }

  Future<void> _loadAccess() async {
    final repo = ref.read(authRepositoryProvider);
    final permissions = await repo.getStoredPermissions();
    final roles = await repo.getStoredRoles();
    if (mounted) {
      setState(() {
        _permissions = permissions;
        _roles = roles;
        _loaded = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final location = GoRouterState.of(context).uri.toString();

    bool isSelected(String path) {
      if (path == '/dashboard') return location.startsWith('/dashboard');
      return location.startsWith(path);
    }

    void closeAndGo(String path) {
      Navigator.of(context).pop();
      context.go(path);
    }

    List<Widget> mainTiles = [];
    for (final e in _mainEntries) {
      if (!_loaded || canAccessFeature(_permissions, _roles, e.path)) {
        mainTiles.add(_DrawerTile(
          icon: e.icon,
          activeIcon: e.activeIcon,
          label: e.label,
          isSelected: isSelected(e.path),
          onTap: () => closeAndGo(e.path),
        ));
      }
    }

    List<Widget> moduleTiles = [];
    for (final e in _moduleEntries) {
      if (!_loaded || canAccessFeature(_permissions, _roles, e.path)) {
        moduleTiles.add(_DrawerTile(
          icon: e.icon,
          activeIcon: e.activeIcon,
          label: e.label,
          isSelected: isSelected(e.path),
          onTap: () => closeAndGo(e.path),
        ));
      }
    }

    return Drawer(
      backgroundColor: c.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'SADC PF Nexus',
                    style: textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: c.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Parliamentary Forum Governance',
                    style: textTheme.bodySmall?.copyWith(
                      color: c.onSurface.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                children: [
                  ...mainTiles,
                  if (moduleTiles.isNotEmpty) ...[
                    const Divider(height: 24),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                      child: Text(
                        'MODULES',
                        style: textTheme.labelSmall?.copyWith(
                          color: c.onSurface.withValues(alpha: 0.6),
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    ...moduleTiles,
                  ],
                  const Divider(height: 24),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                    child: Text(
                      'PREFERENCES',
                      style: textTheme.labelSmall?.copyWith(
                        color: c.onSurface.withValues(alpha: 0.6),
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  _DrawerTile(
                    icon: Icons.settings_outlined,
                    label: 'Settings',
                    isSelected: isSelected('/profile'),
                    onTap: () => closeAndGo('/profile'),
                  ),
                  const Divider(height: 24),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    child: Text(
                      'Travel Requisition Form design • Stitch',
                      style: textTheme.labelSmall?.copyWith(
                        color: c.onSurface.withValues(alpha: 0.5),
                        fontSize: 10,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  final IconData icon;
  final IconData? activeIcon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _DrawerTile({
    required this.icon,
    this.activeIcon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final iconData = isSelected && activeIcon != null ? activeIcon! : icon;

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: isSelected
              ? c.primary.withValues(alpha: 0.15)
              : c.outline.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          iconData,
          size: 20,
          color: isSelected ? c.primary : c.onSurface.withValues(alpha: 0.7),
        ),
      ),
      title: Text(
        label,
        style: textTheme.titleSmall?.copyWith(
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          color: isSelected ? c.primary : c.onSurface,
        ),
      ),
      selected: isSelected,
      selectedTileColor: c.primary.withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      onTap: onTap,
    );
  }
}
