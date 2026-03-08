import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Stitch-aligned navigation drawer (hamburger menu).
/// Uses theme colors, 8dp roundness, and theme text styles.
class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

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

    return Drawer(
      backgroundColor: c.surface,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header — Stitch branding (fixed at top)
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
            // Scrollable menu (prevents overflow on small screens)
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                children: [
                  _DrawerTile(
              icon: Icons.dashboard_outlined,
              activeIcon: Icons.dashboard,
              label: 'Home',
              isSelected: isSelected('/dashboard'),
              onTap: () => closeAndGo('/dashboard'),
            ),
            _DrawerTile(
              icon: Icons.description_outlined,
              activeIcon: Icons.description,
              label: 'Requests',
              isSelected: isSelected('/requests'),
              onTap: () => closeAndGo('/requests'),
            ),
            _DrawerTile(
              icon: Icons.approval_outlined,
              activeIcon: Icons.approval,
              label: 'Approvals',
              isSelected: isSelected('/approvals'),
              onTap: () => closeAndGo('/approvals'),
            ),
            _DrawerTile(
              icon: Icons.analytics_outlined,
              activeIcon: Icons.analytics,
              label: 'Reports',
              isSelected: isSelected('/reports'),
              onTap: () => closeAndGo('/reports'),
            ),
            _DrawerTile(
              icon: Icons.person_outline,
              activeIcon: Icons.person,
              label: 'Profile',
              isSelected: isSelected('/profile'),
              onTap: () => closeAndGo('/profile'),
            ),
            const Divider(height: 24),
            // Section label
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
            // Modules (Stitch / dashboard features)
            _DrawerTile(
              icon: Icons.flight_takeoff,
              label: 'Travel',
              isSelected: false,
              onTap: () => closeAndGo('/requests/travel/new'),
            ),
            _DrawerTile(
              icon: Icons.event_available,
              label: 'Leave',
              isSelected: false,
              onTap: () => closeAndGo('/requests'),
            ),
            _DrawerTile(
              icon: Icons.account_balance_outlined,
              label: 'Finance',
              isSelected: false,
              onTap: () => closeAndGo('/finance/command-center'),
            ),
            _DrawerTile(
              icon: Icons.inventory_2_outlined,
              label: 'Procurement',
              isSelected: false,
              onTap: () => closeAndGo('/procurement/form'),
            ),
            _DrawerTile(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Imprest',
              isSelected: false,
              onTap: () => closeAndGo('/imprest/form'),
            ),
            _DrawerTile(
              icon: Icons.people_outline,
              label: 'HR',
              isSelected: false,
              onTap: () => closeAndGo('/hr/dashboard'),
            ),
            _DrawerTile(
              icon: Icons.description_outlined,
              label: 'PIF',
              isSelected: false,
              onTap: () => closeAndGo('/pif/form'),
            ),
            _DrawerTile(
              icon: Icons.gavel_outlined,
              label: 'Governance',
              isSelected: false,
              onTap: () => closeAndGo('/governance/meetings'),
            ),
            _DrawerTile(
              icon: Icons.devices_outlined,
              label: 'Assets',
              isSelected: false,
              onTap: () => closeAndGo('/assets/inventory'),
            ),
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
