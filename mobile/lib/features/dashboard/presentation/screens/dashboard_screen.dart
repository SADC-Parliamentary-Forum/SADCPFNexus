import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/auth/feature_access.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/shell_drawer_scope.dart';

// Stitch horizontal padding
const _paddingH = 20.0;

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  String? _userName;
  Map<String, dynamic>? _stats;
  bool _loading = true;
  String? _error;
  List<String> _permissions = [];
  List<String> _roles = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = null; });
    try {
      final repo = ref.read(authRepositoryProvider);
      final api = ref.read(apiClientProvider);
      final name = await repo.getStoredUserName();
      final perms = await repo.getStoredPermissions();
      final roles = await repo.getStoredRoles();
      final response = await api.dio.get<Map<String, dynamic>>('/dashboard/stats');
      if (!mounted) return;
      setState(() {
        _userName = name ?? 'User';
        _stats = response.data;
        _permissions = perms;
        _roles = roles;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString();
      setState(() {
        _loading = false;
        _error = (msg.contains('SocketException') || msg.contains('Connection'))
            ? 'Cannot reach server. Check your connection.'
            : 'Failed to load dashboard data.';
      });
    }
  }

  static String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  static String _todayLabel() {
    final now = DateTime.now();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return '${days[now.weekday - 1]}, ${now.day} ${months[now.month - 1]} ${now.year}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final textTheme = theme.textTheme;

    if (_loading) {
      return Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          child: Center(child: CircularProgressIndicator(color: c.primary)),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.cloud_off_outlined, color: c.onSurface.withValues(alpha: 0.7), size: 48),
                  const SizedBox(height: 16),
                  Text(_error!, textAlign: TextAlign.center,
                    style: textTheme.bodyMedium?.copyWith(
                      color: c.onSurface.withValues(alpha: 0.7),
                      fontSize: 14,
                    )),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: c.primary,
                      foregroundColor: c.onPrimary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(kStitchRoundness),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final pending      = (_stats?['pending_approvals']   as num?)?.toInt() ?? 0;
    final travels      = (_stats?['active_travels']      as num?)?.toInt() ?? 0;
    final leaveReqs    = (_stats?['leave_requests']      as num?)?.toInt() ?? 0;
    final requisitions = (_stats?['open_requisitions']   as num?)?.toInt() ?? 0;

    final firstName = (_userName ?? 'User').split(' ').first;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              floating: true,
              backgroundColor: theme.scaffoldBackgroundColor.withValues(alpha: 0.96),
              elevation: 0,
              automaticallyImplyLeading: false,
              toolbarHeight: 64,
              flexibleSpace: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.menu),
                      onPressed: ShellDrawerScope.openDrawerOf(context),
                      style: IconButton.styleFrom(
                        backgroundColor: c.surface,
                        foregroundColor: c.onSurface,
                      ),
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: c.primary.withValues(alpha: 0.4), width: 2),
                      ),
                      child: CircleAvatar(
                        backgroundColor: c.primary.withValues(alpha: 0.15),
                        child: Text(
                          (_userName ?? 'U').trim().split(' ').where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join(),
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: c.primary,
                            height: 1,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('${_greeting()},',
                            style: textTheme.labelMedium?.copyWith(
                              fontSize: 11, color: c.onSurface.withValues(alpha: 0.7), letterSpacing: 0.3)),
                          Text(firstName,
                            style: textTheme.titleMedium?.copyWith(
                              fontSize: 16, fontWeight: FontWeight.w800, height: 1.2)),
                        ],
                      ),
                    ),
                    Stack(
                      children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: c.surface,
                            borderRadius: BorderRadius.circular(kStitchCardRoundness),
                            border: Border.all(color: c.outline),
                          ),
                          child: Icon(Icons.notifications_outlined,
                            color: c.onSurface.withValues(alpha: 0.7), size: 20),
                        ),
                        Positioned(
                          top: 8, right: 8,
                          child: Container(
                            width: 8, height: 8,
                            decoration: BoxDecoration(
                              color: c.error, shape: BoxShape.circle),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Search bar with autocomplete (below app bar so it never covers left icons)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(kStitchSpace16, kStitchSpace12, kStitchSpace16, 0),
                child: _DashboardSearchBar(theme: theme),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(_paddingH, kStitchSpace20, _paddingH, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Dashboard',
                      style: textTheme.headlineSmall?.copyWith(fontSize: 22, height: 1.2)),
                    Text(_todayLabel(),
                      style: textTheme.bodySmall?.copyWith(fontSize: 12)),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(_paddingH, kStitchSpace16, _paddingH, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('AT A GLANCE',
                      style: textTheme.labelSmall?.copyWith(
                        fontSize: 10, fontWeight: FontWeight.w700,
                        color: c.onSurface.withValues(alpha: 0.7), letterSpacing: 1.2)),
                    const SizedBox(height: kStitchSpace12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: kStitchSpace12,
                      crossAxisSpacing: kStitchSpace12,
                      childAspectRatio: 1.55,
                      children: [
                        _KpiCard(
                          label: 'Pending Approvals',
                          value: '$pending',
                          icon: Icons.pending_actions,
                          color: c.secondary,
                          badge: pending > 0 ? '+$pending new' : 'None',
                          badgeHighlight: pending > 0,
                        ),
                        _KpiCard(
                          label: 'Active Travels',
                          value: '$travels',
                          icon: Icons.flight_takeoff,
                          color: c.primary,
                          badge: travels > 0 ? 'In progress' : 'None',
                          badgeHighlight: false,
                        ),
                        _KpiCard(
                          label: 'Leave Requests',
                          value: '$leaveReqs',
                          icon: Icons.event_available,
                          color: c.primary,
                          badge: 'Pending review',
                          badgeHighlight: false,
                        ),
                        _KpiCard(
                          label: 'Open Requisitions',
                          value: '$requisitions',
                          icon: Icons.shopping_cart,
                          color: c.primary,
                          badge: 'Awaiting',
                          badgeHighlight: false,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(_paddingH, kStitchSpace24, _paddingH, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('QUICK ACTIONS',
                      style: textTheme.labelSmall?.copyWith(
                        fontSize: 10, fontWeight: FontWeight.w700,
                        color: c.onSurface.withValues(alpha: 0.7), letterSpacing: 1.2)),
                    const SizedBox(height: kStitchSpace12),
                    Row(
                      children: [
                        if (canAccessFeature(_permissions, _roles, '/requests/travel/new'))
                          _ActionButton(icon: Icons.flight_takeoff, label: 'Travel',
                            onTap: () => context.push('/requests/travel/new')),
                        if (canAccessFeature(_permissions, _roles, '/requests')) ...[
                          const SizedBox(width: 10),
                          _ActionButton(icon: Icons.event_available, label: 'Leave',
                            onTap: () => context.go('/requests')),
                        ],
                        if (canAccessFeature(_permissions, _roles, '/finance/command-center')) ...[
                          const SizedBox(width: 10),
                          _ActionButton(icon: Icons.account_balance_wallet, label: 'Finance',
                            onTap: () => context.push('/finance/command-center')),
                        ],
                        if (canAccessFeature(_permissions, _roles, '/procurement/form')) ...[
                          const SizedBox(width: 10),
                          _ActionButton(icon: Icons.inventory_2_outlined, label: 'Procure',
                            onTap: () => context.push('/procurement/form')),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(_paddingH, kStitchSpace24, _paddingH, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ALL MODULES',
                      style: textTheme.labelSmall?.copyWith(
                        fontSize: 10, fontWeight: FontWeight.w700,
                        color: c.onSurface.withValues(alpha: 0.7), letterSpacing: 1.2)),
                    const SizedBox(height: kStitchSpace12),
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.95,
                      children: [
                        if (canAccessFeature(_permissions, _roles, '/finance/command-center'))
                          _ModuleTile(icon: Icons.account_balance_outlined, label: 'Finance',
                            color: c.primary,
                            onTap: () => context.push('/finance/command-center')),
                        if (canAccessFeature(_permissions, _roles, '/procurement/form'))
                          _ModuleTile(icon: Icons.inventory_2_outlined, label: 'Procurement',
                            color: c.secondary,
                            onTap: () => context.push('/procurement/form')),
                        if (canAccessFeature(_permissions, _roles, '/imprest/form'))
                          _ModuleTile(icon: Icons.account_balance_wallet_outlined, label: 'Imprest',
                            color: c.primary,
                            onTap: () => context.push('/imprest/form')),
                        if (canAccessFeature(_permissions, _roles, '/salary/advance/new'))
                          _ModuleTile(icon: Icons.savings_outlined, label: 'Salary Adv.',
                            color: c.primary,
                            onTap: () => context.push('/salary/advance/new')),
                        if (canAccessFeature(_permissions, _roles, '/hr/dashboard'))
                          _ModuleTile(icon: Icons.people_outline, label: 'HR',
                            color: c.primary,
                            onTap: () => context.push('/hr/dashboard')),
                        if (canAccessFeature(_permissions, _roles, '/hr/assignments'))
                          _ModuleTile(icon: Icons.assignment_outlined, label: 'Assignments',
                            color: c.primary,
                            onTap: () => context.push('/hr/assignments')),
                        if (canAccessFeature(_permissions, _roles, '/assets/inventory'))
                          _ModuleTile(icon: Icons.devices_outlined, label: 'Assets',
                            color: c.secondary,
                            onTap: () => context.push('/assets/inventory')),
                        if (canAccessFeature(_permissions, _roles, '/pif/form'))
                          _ModuleTile(icon: Icons.description_outlined, label: 'PIF',
                            color: c.error,
                            onTap: () => context.push('/pif/form')),
                        if (canAccessFeature(_permissions, _roles, '/governance/meetings'))
                          _ModuleTile(icon: Icons.gavel_outlined, label: 'Governance',
                            color: c.primary,
                            onTap: () => context.push('/governance/meetings')),
                        if (canAccessFeature(_permissions, _roles, '/search'))
                          _ModuleTile(icon: Icons.search, label: 'Search',
                            color: c.onSurface.withValues(alpha: 0.7),
                            onTap: () => context.push('/search')),
                        if (canAccessFeature(_permissions, _roles, '/assets/fleet'))
                          _ModuleTile(icon: Icons.directions_car_outlined, label: 'Fleet',
                            color: c.primary,
                            onTap: () => context.push('/assets/fleet')),
                        if (canAccessFeature(_permissions, _roles, '/analytics/global-summary'))
                          _ModuleTile(icon: Icons.analytics_outlined, label: 'Analytics',
                            color: c.primary,
                            onTap: () => context.push('/analytics/global-summary')),
                        if (canAccessFeature(_permissions, _roles, '/dashboard/executive-cockpit'))
                          _ModuleTile(icon: Icons.dashboard_customize_outlined, label: 'Cockpit',
                            color: c.secondary,
                            onTap: () => context.push('/dashboard/executive-cockpit')),
                        if (canAccessFeature(_permissions, _roles, '/calendar'))
                          _ModuleTile(icon: Icons.calendar_month_outlined, label: 'Calendar',
                            color: c.primary,
                            onTap: () => context.push('/calendar')),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('RECENT ACTIVITY',
                          style: textTheme.labelSmall?.copyWith(
                            fontSize: 10, fontWeight: FontWeight.w700,
                            color: c.onSurface.withValues(alpha: 0.7), letterSpacing: 1.2)),
                        GestureDetector(
                          onTap: () => context.go('/requests'),
                          child: Text('View all',
                            style: textTheme.labelMedium?.copyWith(
                              fontSize: 11, color: c.primary, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const SizedBox(height: kStitchSpace12),
                    Container(
                      decoration: BoxDecoration(
                        color: c.surface,
                        borderRadius: BorderRadius.circular(kStitchCardRoundness),
                        border: Border.all(color: c.outline),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          children: [
                            Icon(Icons.inbox_outlined, color: c.outline, size: 40),
                            const SizedBox(height: kStitchSpace12),
                            Text('No recent activity',
                              style: textTheme.titleSmall?.copyWith(
                                fontSize: 13, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text('Your submissions and approvals will appear here.',
                              textAlign: TextAlign.center,
                              style: textTheme.bodySmall?.copyWith(fontSize: 12)),
                          ],
                        ),
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

// ── KPI Card ─────────────────────────────────────────────────────────────────
class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? badge;
  final bool badgeHighlight;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.badge,
    this.badgeHighlight = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(kStitchSpace12),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(kStitchCardRoundness),
        border: Border(
          left: BorderSide(color: color, width: 3),
          top: BorderSide(color: c.outline),
          right: BorderSide(color: c.outline),
          bottom: BorderSide(color: c.outline),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.22 : 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -4, right: -4,
            child: Opacity(
              opacity: 0.10,
              child: Icon(icon, color: color, size: 60),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(kStitchRoundness),
                ),
                child: Icon(icon, color: color, size: 16),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(value,
                        style: textTheme.headlineMedium?.copyWith(
                          fontSize: 26, fontWeight: FontWeight.w800, height: 1)),
                      if (badge != null) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: badgeHighlight
                              ? color.withValues(alpha: 0.15)
                              : c.outline.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(kStitchRoundness),
                          ),
                          child: Text(badge!,
                            style: TextStyle(
                              fontSize: 9, fontWeight: FontWeight.w700,
                              color: badgeHighlight ? color : c.onSurface.withValues(alpha: 0.7))),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(label,
                    style: textTheme.labelSmall?.copyWith(
                      color: c.onSurface.withValues(alpha: 0.7), fontSize: 10),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ModuleTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(kStitchCardRoundness),
          border: Border.all(color: c.outline),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: Theme.of(context).brightness == Brightness.dark ? 0.22 : 0.05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(kStitchRoundness),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(label,
              style: textTheme.labelSmall?.copyWith(
                color: c.onSurface.withValues(alpha: 0.7),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(kStitchCardRoundness),
            border: Border.all(color: c.outline),
          ),
          child: Column(
            children: [
              Icon(icon, color: c.primary, size: 20),
              const SizedBox(height: 5),
              Text(label,
                style: textTheme.labelSmall?.copyWith(
                  color: c.onSurface.withValues(alpha: 0.7),
                  fontSize: 9,
                  fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Stitch-styled search bar with autocomplete (suggestions). Placed in body so it never covers app bar icons.
class _DashboardSearchBar extends StatelessWidget {
  final ThemeData theme;

  const _DashboardSearchBar({required this.theme});

  static const List<String> _kSuggestions = [
    'Resolutions',
    'PIFs',
    'Travel requests',
    'Budget',
    'Leave requests',
    'Approvals',
    'Reports',
    'Documents',
    'Governance',
    'Finance',
  ];

  @override
  Widget build(BuildContext context) {
    final c = theme.colorScheme;
    final textTheme = theme.textTheme;

    return Autocomplete<String>(
      optionsBuilder: (text) {
        final value = text.text.toLowerCase();
        if (value.isEmpty) return _kSuggestions;
        return _kSuggestions.where((s) => s.toLowerCase().contains(value));
      },
      onSelected: (value) {
        context.push('/search');
      },
      fieldViewBuilder: (context, controller, focusNode, onSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          onSubmitted: (_) => context.push('/search'),
          style: textTheme.bodyMedium?.copyWith(color: c.onSurface, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Search resolutions, PIFs, requests…',
            hintStyle: textTheme.bodyMedium?.copyWith(
              color: c.onSurface.withValues(alpha: 0.6),
              fontSize: 14,
            ),
            prefixIcon: Icon(
              Icons.search,
              color: c.onSurface.withValues(alpha: 0.6),
              size: 20,
            ),
            filled: true,
            fillColor: c.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(kStitchRoundness),
              borderSide: BorderSide(color: c.outline),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(kStitchRoundness),
              borderSide: BorderSide(color: c.outline),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(kStitchRoundness),
              borderSide: BorderSide(color: c.primary, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(kStitchRoundness),
            color: c.surface,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final option = options.elementAt(index);
                  return InkWell(
                    onTap: () => onSelected(option),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Text(
                        option,
                        style: textTheme.bodyMedium?.copyWith(color: c.onSurface),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}
