import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'app_drawer.dart';
import 'connectivity_banner.dart';
import 'notification_banner.dart';
import 'shell_drawer_scope.dart';
import '../../core/auth/auth_providers.dart';
import '../../l10n/app_locale.dart';
import '../../l10n/app_strings.dart';
import 'dart:async';

class AppShell extends ConsumerStatefulWidget {
  /// The active branch navigator, supplied by `StatefulShellRoute.indexedStack`.
  /// Each bottom-nav tab keeps its own offstage `Navigator` (and therefore its
  /// scroll position / in-flight state) instead of being torn down and
  /// rebuilt on every tab switch, as a plain `ShellRoute` would do.
  final StatefulNavigationShell navigationShell;
  const AppShell({super.key, required this.navigationShell});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  late AnimationController _animController;
  late Animation<Offset> _slideAnimation;
  final _navVisible = ValueNotifier<bool>(true);
  Timer? _idleTimer;
  DateTime _lastActivity = DateTime.now();
  int? _idleMinutes;

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
    _idleTimer = Timer.periodic(const Duration(seconds: 15), (_) => _checkIdle());
    _loadIdlePreference();
  }

  Future<void> _loadIdlePreference() async {
    try {
      final res = await ref.read(apiClientProvider).dio.get<Map<String, dynamic>>('/profile');
      final raw = res.data?['idle_timeout_minutes'];
      if (raw is num) {
        _idleMinutes = raw.toInt();
      } else {
        _idleMinutes = 120;
      }
    } catch (_) {
      _idleMinutes ??= 120;
    }
  }

  void _checkIdle() {
    final minutes = _idleMinutes;
    if (minutes == null || minutes <= 0) return;
    if (DateTime.now().difference(_lastActivity) >= Duration(minutes: minutes)) {
      ref.read(authSessionControllerProvider).handleUnauthorized();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _idleTimer?.cancel();
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

  void _onTap(BuildContext context, int index) {
    _showNav();
    // `goBranch` switches the offstage `Navigator` for the tapped tab
    // in-place; passing `initialLocation: true` when re-tapping the already
    // active tab pops it back to that branch's first route (mirrors the
    // common go_router "tap active tab to go to root" convention).
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = widget.navigationShell.currentIndex;
    void openDrawer() => _scaffoldKey.currentState?.openDrawer();

    return ShellDrawerScope(
      openDrawer: openDrawer,
      child: Scaffold(
        key: _scaffoldKey,
        drawer: const AppDrawer(),
        extendBody: true,
        body: Listener(
          onPointerDown: (_) => _lastActivity = DateTime.now(),
          child: ConnectivityBannerOverlay(
            child: NotificationBannerOverlay(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: NotificationListener<ScrollNotification>(
                      onNotification: _handleScroll,
                      child: widget.navigationShell,
                    ),
                  ),
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
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
// Glassy Nav Bar
// ─────────────────────────────────────────────

class _GlassNavBar extends ConsumerWidget {
  final int selectedIndex;
  final void Function(int) onTap;

  const _GlassNavBar({
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final c = Theme.of(context).colorScheme;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final strings = AppStrings.of(ref.watch(appLanguageProvider));

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
                label: strings.t('Home'),
                isActive: selectedIndex == 0,
                onTap: () => onTap(0),
              ),
              _GlassNavItem(
                icon: Icons.description_outlined,
                activeIcon: Icons.description_rounded,
                label: strings.t('Requests'),
                isActive: selectedIndex == 1,
                onTap: () => onTap(1),
              ),
              _GlassNavItem(
                icon: Icons.task_alt_outlined,
                activeIcon: Icons.task_alt_rounded,
                label: strings.t('Approvals'),
                isActive: selectedIndex == 2,
                onTap: () => onTap(2),
              ),
              _GlassNavItem(
                icon: Icons.bar_chart_outlined,
                activeIcon: Icons.bar_chart_rounded,
                label: strings.t('Reports'),
                isActive: selectedIndex == 3,
                onTap: () => onTap(3),
              ),
              _GlassNavItem(
                icon: Icons.person_outline_rounded,
                activeIcon: Icons.person_rounded,
                label: strings.t('Profile'),
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
      child: Semantics(
        button: true,
        selected: isActive,
        label: '$label tab',
        child: Column(
          children: [
            Expanded(
              child: InkWell(
                onTap: onTap,
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
            ),
          ],
        ),
      ),
    );
  }
}
