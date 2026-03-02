import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  int _getSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/requests')) return 1;
    if (location.startsWith('/approvals')) return 2;
    if (location.startsWith('/reports')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  void _onTap(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/dashboard');
        break;
      case 1:
        context.go('/requests');
        break;
      case 2:
        context.go('/approvals');
        break;
      case 3:
        context.go('/reports');
        break;
      case 4:
        context.go('/profile');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _getSelectedIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.bgSurface,
          border: Border(
            top: BorderSide(color: AppColors.border, width: 1),
          ),
        ),
        child: SafeArea(
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                _NavItem(
                  icon: Icons.dashboard_outlined,
                  activeIcon: Icons.dashboard,
                  label: 'Home',
                  isActive: selectedIndex == 0,
                  onTap: () => _onTap(context, 0),
                ),
                _NavItem(
                  icon: Icons.description_outlined,
                  activeIcon: Icons.description,
                  label: 'Requests',
                  isActive: selectedIndex == 1,
                  onTap: () => _onTap(context, 1),
                ),
                _NavItem(
                  icon: Icons.approval_outlined,
                  activeIcon: Icons.approval,
                  label: 'Approvals',
                  isActive: selectedIndex == 2,
                  onTap: () => _onTap(context, 2),
                ),
                _NavItem(
                  icon: Icons.analytics_outlined,
                  activeIcon: Icons.analytics,
                  label: 'Reports',
                  isActive: selectedIndex == 3,
                  onTap: () => _onTap(context, 3),
                ),
                _NavItem(
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Profile',
                  isActive: selectedIndex == 4,
                  onTap: () => _onTap(context, 4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary.withOpacity(0.15) : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                isActive ? activeIcon : icon,
                color: isActive ? AppColors.primary : AppColors.textSecondary,
                size: 22,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primary : AppColors.textSecondary,
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
