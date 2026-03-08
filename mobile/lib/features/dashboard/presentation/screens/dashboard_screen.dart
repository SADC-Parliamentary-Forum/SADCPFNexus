import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

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
      final response = await api.dio.get<Map<String, dynamic>>('/dashboard/stats');
      if (!mounted) return;
      setState(() {
        _userName = name ?? 'User';
        _stats = response.data;
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
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.bgDark,
        body: SafeArea(
          child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.bgDark,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_outlined, color: AppColors.textSecondary, size: 48),
                  const SizedBox(height: 16),
                  Text(_error!, textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.bgDark,
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
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Sticky Header ──────────────────────────────────────────
            SliverAppBar(
              pinned: true,
              floating: true,
              backgroundColor: AppColors.bgDark.withValues(alpha:0.96),
              elevation: 0,
              automaticallyImplyLeading: false,
              toolbarHeight: 64,
              flexibleSpace: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    // Avatar
                    Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primary.withValues(alpha:0.4), width: 2),
                        color: AppColors.bgSurface,
                      ),
                      child: const Icon(Icons.person_outline, color: AppColors.textSecondary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('${_greeting()},',
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary,
                              letterSpacing: 0.3)),
                          Text(firstName,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary, height: 1.2)),
                        ],
                      ),
                    ),
                    // Notification bell
                    Stack(
                      children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.bgSurface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: const Icon(Icons.notifications_outlined,
                            color: AppColors.textSecondary, size: 20),
                        ),
                        Positioned(
                          top: 8, right: 8,
                          child: Container(
                            width: 8, height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.danger, shape: BoxShape.circle),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Search bar in header bottom
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(56),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.bgSurface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Row(
                      children: [
                        SizedBox(width: 12),
                        Icon(Icons.search, color: AppColors.textSecondary, size: 20),
                        SizedBox(width: 8),
                        Text('Search resolutions, PIFs, requests…',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Dashboard title ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Dashboard',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary, height: 1.2)),
                    Text(_todayLabel(),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ),

            // ── KPI Cards ───────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('AT A GLANCE',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary, letterSpacing: 1.2)),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.55,
                      children: [
                        _KpiCard(
                          label: 'Pending Approvals',
                          value: '$pending',
                          icon: Icons.pending_actions,
                          color: AppColors.warning,
                          badge: pending > 0 ? '+$pending new' : 'None',
                          badgeHighlight: pending > 0,
                        ),
                        _KpiCard(
                          label: 'Active Travels',
                          value: '$travels',
                          icon: Icons.flight_takeoff,
                          color: AppColors.primary,
                          badge: travels > 0 ? 'In progress' : 'None',
                          badgeHighlight: false,
                        ),
                        _KpiCard(
                          label: 'Leave Requests',
                          value: '$leaveReqs',
                          icon: Icons.event_available,
                          color: AppColors.success,
                          badge: 'Pending review',
                          badgeHighlight: false,
                        ),
                        _KpiCard(
                          label: 'Open Requisitions',
                          value: '$requisitions',
                          icon: Icons.shopping_cart,
                          color: AppColors.info,
                          badge: 'Awaiting',
                          badgeHighlight: false,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── Quick Actions ───────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('QUICK ACTIONS',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary, letterSpacing: 1.2)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _ActionButton(icon: Icons.flight_takeoff, label: 'Travel',
                          onTap: () => context.push('/requests/travel/new')),
                        const SizedBox(width: 10),
                        _ActionButton(icon: Icons.event_available, label: 'Leave',
                          onTap: () => context.go('/requests')),
                        const SizedBox(width: 10),
                        _ActionButton(icon: Icons.account_balance_wallet, label: 'Finance',
                          onTap: () => context.push('/finance/command-center')),
                        const SizedBox(width: 10),
                        _ActionButton(icon: Icons.inventory_2_outlined, label: 'Procure',
                          onTap: () => context.push('/procurement/form')),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── Module Hub ──────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('ALL MODULES',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                        color: AppColors.textSecondary, letterSpacing: 1.2)),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.95,
                      children: [
                        _ModuleTile(icon: Icons.account_balance_outlined, label: 'Finance',
                          color: const Color(0xFF13EC80),
                          onTap: () => context.push('/finance/command-center')),
                        _ModuleTile(icon: Icons.inventory_2_outlined, label: 'Procurement',
                          color: const Color(0xFFD4AF37),
                          onTap: () => context.push('/procurement/form')),
                        _ModuleTile(icon: Icons.account_balance_wallet_outlined, label: 'Imprest',
                          color: const Color(0xFF3B82F6),
                          onTap: () => context.push('/imprest/form')),
                        _ModuleTile(icon: Icons.savings_outlined, label: 'Salary Adv.',
                          color: const Color(0xFF8B5CF6),
                          onTap: () => context.push('/salary/advance/new')),
                        _ModuleTile(icon: Icons.people_outline, label: 'HR',
                          color: const Color(0xFF10B981),
                          onTap: () => context.push('/hr/dashboard')),
                        _ModuleTile(icon: Icons.devices_outlined, label: 'Assets',
                          color: const Color(0xFFF59E0B),
                          onTap: () => context.push('/assets/inventory')),
                        _ModuleTile(icon: Icons.description_outlined, label: 'PIF',
                          color: const Color(0xFFEF4444),
                          onTap: () => context.push('/pif/form')),
                        _ModuleTile(icon: Icons.gavel_outlined, label: 'Governance',
                          color: const Color(0xFF06B6D4),
                          onTap: () => context.push('/governance/meetings')),
                        _ModuleTile(icon: Icons.search, label: 'Search',
                          color: const Color(0xFF64748B),
                          onTap: () => context.push('/search')),
                        _ModuleTile(icon: Icons.directions_car_outlined, label: 'Fleet',
                          color: const Color(0xFF0EA5E9),
                          onTap: () => context.push('/assets/fleet')),
                        _ModuleTile(icon: Icons.analytics_outlined, label: 'Analytics',
                          color: const Color(0xFFEC4899),
                          onTap: () => context.push('/analytics/global-summary')),
                        _ModuleTile(icon: Icons.dashboard_customize_outlined, label: 'Cockpit',
                          color: const Color(0xFFD4AF37),
                          onTap: () => context.push('/dashboard/executive-cockpit')),
                        _ModuleTile(icon: Icons.calendar_month_outlined, label: 'Calendar',
                          color: const Color(0xFF0D9488),
                          onTap: () => context.push('/calendar')),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── Recent Activity ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('RECENT ACTIVITY',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary, letterSpacing: 1.2)),
                        GestureDetector(
                          onTap: () => context.go('/requests'),
                          child: const Text('View all',
                            style: TextStyle(fontSize: 11, color: AppColors.primary,
                              fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Padding(
                        padding: EdgeInsets.all(32),
                        child: Column(
                          children: [
                            Icon(Icons.inbox_outlined, color: AppColors.border, size: 40),
                            SizedBox(height: 12),
                            Text('No recent activity',
                              style: TextStyle(color: AppColors.textPrimary,
                                fontSize: 13, fontWeight: FontWeight.w600)),
                            SizedBox(height: 4),
                            Text('Your submissions and approvals will appear here.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        children: [
          // Ghost background icon
          Positioned(
            top: -4, right: -4,
            child: Opacity(
              opacity: 0.06,
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
                  color: color.withValues(alpha:0.15),
                  borderRadius: BorderRadius.circular(8),
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
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          height: 1,
                        )),
                      if (badge != null) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: badgeHighlight
                              ? color.withValues(alpha:0.15)
                              : AppColors.bgCard.withValues(alpha:0.8),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(badge!,
                            style: TextStyle(
                              fontSize: 9, fontWeight: FontWeight.w700,
                              color: badgeHighlight ? color : AppColors.textSecondary)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(label,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
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

// ── Module Tile ───────────────────────────────────────────────────────────────
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(label,
              style: const TextStyle(
                color: AppColors.textSecondary,
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

// ── Action Button ─────────────────────────────────────────────────────────────
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
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(height: 5),
              Text(label,
                style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 9, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
