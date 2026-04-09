import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_drawer.dart';
import 'shell_drawer_scope.dart';

class AppShell extends StatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  late AnimationController _animController;
  late Animation<Offset> _slideAnimation;
  final _navVisible = ValueNotifier<bool>(true);

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    )..value = 1.0;

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 1.5),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ));

    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animController.dispose();
    _navVisible.dispose();
    super.dispose();
  }

  @override
  void didChangeMetrics() {
    final views = WidgetsBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return;
    final bottomInset = views.first.viewInsets.bottom;
    final keyboardVisible = bottomInset > 100;
    if (keyboardVisible && _navVisible.value) {
      _navVisible.value = false;
      _animController.reverse();
    } else if (!keyboardVisible && !_navVisible.value) {
      _navVisible.value = true;
      _animController.forward();
    }
  }

  void _showNav() {
    if (!_navVisible.value) {
      _navVisible.value = true;
      _animController.forward();
    }
  }

  bool _handleScroll(ScrollNotification notification) {
    if (notification is ScrollUpdateNotification) {
      final delta = notification.scrollDelta ?? 0;
      if (delta > 2.0 && _navVisible.value) {
        _navVisible.value = false;
        _animController.reverse();
      } else if (delta < -2.0 && !_navVisible.value) {
        _navVisible.value = true;
        _animController.forward();
      }
    }
    if (notification is ScrollEndNotification && !_navVisible.value) {
      _navVisible.value = true;
      _animController.forward();
    }
    return false;
  }

  int _getSelectedIndex(BuildContext context) {
    final location = GoRouter.of(context).routeInformationProvider.value.uri.toString();
    if (location.startsWith('/dashboard')) return 0;
    if (location.startsWith('/requests')) return 1;
    if (location.startsWith('/approvals')) return 2;
    if (location.startsWith('/reports')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  void _onTap(BuildContext context, int index) {
    _showNav();
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
    void openDrawer() => _scaffoldKey.currentState?.openDrawer();

    return ShellDrawerScope(
      openDrawer: openDrawer,
      child: Scaffold(
        key: _scaffoldKey,
        drawer: const AppDrawer(),
        extendBody: true,
        body: Stack(
          children: [
            // Content area — full screen, NotificationListener catches scroll from any child
            Positioned.fill(
              child: NotificationListener<ScrollNotification>(
                onNotification: _handleScroll,
                child: widget.child,
              ),
            ),

            // Transparent tap-zone at the bottom — only active when nav is hidden
            ValueListenableBuilder<bool>(
              valueListenable: _navVisible,
              builder: (context, visible, _) {
                if (visible) return const SizedBox.shrink();
                return Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 72,
                  child: GestureDetector(
                    onTap: _showNav,
                    behavior: HitTestBehavior.translucent,
                  ),
                );
              },
            ),

            // Glassy floating pill nav bar
            Positioned(
              bottom: 0,
              left: 12,
              right: 12,
              child: SlideTransition(
                position: _slideAnimation,
                child: _GlassNavBar(
                  selectedIndex: selectedIndex,
                  onTap: (index) => _onTap(context, index),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
// Glassy Nav Bar
// ─────────────────────────────────────────────

class _GlassNavBar extends StatelessWidget {
  final int selectedIndex;
  final void Function(int) onTap;

  const _GlassNavBar({
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final c = Theme.of(context).colorScheme;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    final glassColor = isDark
        ? const Color(0xCC1A211D) // dark surface at ~80%
        : const Color(0xCCFFFFFF); // white at ~80%

    return Padding(
      padding: EdgeInsets.only(
        bottom: bottomPadding + 8,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(32),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: glassColor,
            borderRadius: BorderRadius.circular(32),
            border: Border.all(
              color: c.outline.withValues(alpha: 0.3),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.10),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              _GlassNavItem(
                icon: Icons.dashboard_outlined,
                activeIcon: Icons.dashboard_rounded,
                label: 'Home',
                isActive: selectedIndex == 0,
                onTap: () => onTap(0),
              ),
              _GlassNavItem(
                icon: Icons.description_outlined,
                activeIcon: Icons.description_rounded,
                label: 'Requests',
                isActive: selectedIndex == 1,
                onTap: () => onTap(1),
              ),
              _GlassNavItem(
                icon: Icons.task_alt_outlined,
                activeIcon: Icons.task_alt_rounded,
                label: 'Approvals',
                isActive: selectedIndex == 2,
                onTap: () => onTap(2),
              ),
              _GlassNavItem(
                icon: Icons.bar_chart_outlined,
                activeIcon: Icons.bar_chart_rounded,
                label: 'Reports',
                isActive: selectedIndex == 3,
                onTap: () => onTap(3),
              ),
              _GlassNavItem(
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: 'Profile',
                isActive: selectedIndex == 4,
                onTap: () => onTap(4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
// Individual Nav Item
// ─────────────────────────────────────────────

class _GlassNavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _GlassNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final activeColor = c.primary;
    final inactiveColor = c.onSurface.withValues(alpha: 0.55);

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Icon(
                isActive ? activeIcon : icon,
                key: ValueKey(isActive),
                color: isActive ? activeColor : inactiveColor,
                size: 22,
              ),
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: textTheme.labelSmall!.copyWith(
                color: isActive ? activeColor : inactiveColor,
                fontSize: 10,
                fontWeight:
                    isActive ? FontWeight.w600 : FontWeight.w400,
              ),
              child: Text(label),
            ),
            const SizedBox(height: 4),
            // Dot indicator
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOutCubic,
              width: isActive ? 16 : 0,
              height: 3,
              decoration: BoxDecoration(
                color: isActive ? activeColor : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
