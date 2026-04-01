import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/auth/auth_repository.dart';
import '../../../../../core/theme/app_theme.dart';

class ExecutiveCockpitScreen extends ConsumerStatefulWidget {
  const ExecutiveCockpitScreen({super.key});

  @override
  ConsumerState<ExecutiveCockpitScreen> createState() =>
      _ExecutiveCockpitScreenState();
}

class _ExecutiveCockpitScreenState
    extends ConsumerState<ExecutiveCockpitScreen> {
  bool _loading = true;
  String? _error;

  // KPI values
  int _pendingApprovals = 0;
  int _urgentApprovals = 0;
  int _totalSubmissions = 0;
  double _approvalRatePct = 0;
  int _activeTravel = 0;

  // Analytics
  List<Map<String, dynamic>> _byModule = [];
  List<Map<String, dynamic>> _recentActivity = [];

  // Pending approval items
  List<Map<String, dynamic>> _pendingItems = [];

  // User info
  String _userName = 'Secretary General';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = ref.read(authRepositoryProvider);
      _userName = await repo.getStoredUserName() ?? 'Secretary General';

      final dio = ref.read(apiClientProvider).dio;

      // Fetch analytics summary + pending approvals in parallel
      final results = await Future.wait([
        dio.get<Map<String, dynamic>>('/analytics/summary'),
        dio.get<Map<String, dynamic>>('/approvals/pending'),
      ]);

      final analytics = results[0].data ?? {};
      final approvalsData = results[1].data ?? {};

      // Parse analytics
      final kpi = analytics['kpi'] as Map<String, dynamic>? ?? {};
      _totalSubmissions = (kpi['total_submissions'] as num?)?.toInt() ?? 0;
      _approvalRatePct =
          (kpi['approval_rate_pct'] as num?)?.toDouble() ?? 0.0;
      _activeTravel = (kpi['active_travel'] as num?)?.toInt() ?? 0;

      final byModuleRaw = analytics['by_module'] as List<dynamic>? ?? [];
      _byModule = byModuleRaw.map((e) => Map<String, dynamic>.from(e as Map)).toList();

      final activityRaw = analytics['recent_activity'] as List<dynamic>? ?? [];
      _recentActivity =
          activityRaw.map((e) => Map<String, dynamic>.from(e as Map)).toList();

      // Parse pending approvals
      final pendingRaw = approvalsData['data'] as List<dynamic>? ??
          (approvalsData is List ? approvalsData as List<dynamic> : []);
      _pendingItems =
          pendingRaw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      _pendingApprovals = (approvalsData['total'] as num?)?.toInt() ??
          _pendingItems.length;
      _urgentApprovals = _pendingItems
          .where((e) => (e['is_urgent'] as bool?) == true)
          .length;

      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Executive Cockpit',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _load,
          ),
          Container(
            margin: const EdgeInsets.only(right: 12),
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
                color: AppColors.gold, shape: BoxShape.circle),
            child: Center(
              child: Text(
                _userName.isNotEmpty
                    ? _userName.split(' ').map((s) => s[0]).take(2).join()
                    : 'SG',
                style: const TextStyle(
                    color: Color(0xFF102219),
                    fontSize: 11,
                    fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Welcome
                      Text(
                        '${_greeting()}, ${_userName.split(' ').first}',
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12),
                      ),
                      const SizedBox(height: 2),
                      const Text('Institutional Overview',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 22,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(
                        _formattedDate(),
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 11),
                      ),
                      const SizedBox(height: 20),

                      // Alert banner — only when there are pending approvals
                      if (_pendingApprovals > 0)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.danger.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: AppColors.danger.withValues(alpha: 0.25)),
                          ),
                          child: Row(children: [
                            const Icon(Icons.priority_high,
                                color: AppColors.danger, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                '$_pendingApprovals item${_pendingApprovals == 1 ? '' : 's'} require your approval'
                                '${_urgentApprovals > 0 ? ' · $_urgentApprovals urgent' : ''}.',
                                style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton(
                              onPressed: () => context.push('/approvals'),
                              child: const Text('Review',
                                  style: TextStyle(
                                      color: AppColors.danger,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12)),
                            ),
                          ]),
                        ),

                      const SizedBox(height: 20),

                      // KPI Grid
                      const Text('KEY PERFORMANCE INDICATORS',
                          style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8)),
                      const SizedBox(height: 10),
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.4,
                        children: [
                          _kpiCard(
                            'Total Submissions',
                            '$_totalSubmissions',
                            AppColors.primary,
                            Icons.description_outlined,
                            'All time',
                            true,
                          ),
                          _kpiCard(
                            'Pending Approvals',
                            '$_pendingApprovals',
                            _pendingApprovals > 0
                                ? AppColors.warning
                                : AppColors.success,
                            Icons.pending_actions,
                            _urgentApprovals > 0
                                ? '$_urgentApprovals urgent'
                                : 'All reviewed',
                            _urgentApprovals == 0,
                          ),
                          _kpiCard(
                            'Approval Rate',
                            '${_approvalRatePct.toStringAsFixed(1)}%',
                            AppColors.success,
                            Icons.verified_user,
                            'Submitted requests',
                            true,
                          ),
                          _kpiCard(
                            'Active Travel',
                            '$_activeTravel',
                            AppColors.info,
                            Icons.flight_takeoff,
                            'In-progress missions',
                            true,
                          ),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // Pending sign-off items
                      if (_pendingItems.isNotEmpty) ...[
                        const Text('PENDING SIGN-OFF',
                            style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8)),
                        const SizedBox(height: 10),
                        ..._pendingItems.take(5).map((item) {
                          final module =
                              (item['module'] ?? item['type'] ?? 'Request')
                                  .toString();
                          final reference =
                              (item['reference'] ?? item['reference_number'] ?? '')
                                  .toString();
                          final requester =
                              (item['requester_name'] ?? item['requester'] ?? '')
                                  .toString();
                          return _approvalCard(
                            reference.isNotEmpty ? reference : module,
                            requester.isNotEmpty
                                ? '$requester · $module'
                                : module,
                            _moduleColor(module),
                            _moduleIcon(module),
                          );
                        }),
                        if (_pendingApprovals > 5)
                          TextButton(
                            onPressed: () => context.push('/approvals'),
                            child: Text(
                              'View all $_pendingApprovals pending approvals',
                              style: const TextStyle(
                                  color: AppColors.primary, fontSize: 13),
                            ),
                          ),
                      ],

                      const SizedBox(height: 20),

                      // Module activity
                      if (_byModule.isNotEmpty) ...[
                        const Text('MODULE ACTIVITY',
                            style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8)),
                        const SizedBox(height: 10),
                        ..._byModule.map((m) {
                          final count =
                              (m['count'] as num?)?.toInt() ?? 0;
                          final total = _byModule
                              .map((e) => (e['count'] as num?)?.toInt() ?? 0)
                              .fold(0, (a, b) => a + b);
                          final ratio =
                              total > 0 ? count / total : 0.0;
                          return _healthRow(
                            m['label']?.toString() ?? m['module']?.toString() ?? '',
                            ratio.clamp(0.0, 1.0),
                            count,
                            _moduleColor(m['module']?.toString() ?? ''),
                          );
                        }),
                      ],

                      // Recent activity
                      if (_recentActivity.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        const Text('RECENT ACTIVITY',
                            style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8)),
                        const SizedBox(height: 10),
                        ..._recentActivity.take(5).map((a) => _activityRow(a)),
                      ],

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
            const SizedBox(height: 12),
            const Text('Failed to load cockpit data',
                style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(_error ?? '',
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 12),
                textAlign: TextAlign.center),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _load,
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.textPrimary,
                  minimumSize: const Size(140, 44),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8))),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  String _formattedDate() {
    final now = DateTime.now();
    const days = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${days[now.weekday - 1]}, ${now.day} ${months[now.month - 1]} ${now.year}';
  }

  Color _moduleColor(String module) {
    switch (module.toLowerCase()) {
      case 'travel':
        return AppColors.primary;
      case 'leave':
        return AppColors.success;
      case 'procurement':
        return AppColors.warning;
      case 'imprest':
        return AppColors.info;
      case 'finance':
        return AppColors.gold;
      default:
        return AppColors.textSecondary;
    }
  }

  IconData _moduleIcon(String module) {
    switch (module.toLowerCase()) {
      case 'travel':
        return Icons.flight_takeoff;
      case 'leave':
        return Icons.beach_access_outlined;
      case 'procurement':
        return Icons.shopping_cart_outlined;
      case 'imprest':
        return Icons.account_balance_wallet_outlined;
      case 'salary advance':
      case 'finance':
        return Icons.savings_outlined;
      default:
        return Icons.task_alt_outlined;
    }
  }

  Widget _kpiCard(String label, String value, Color color, IconData icon,
          String trend, bool positive) =>
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border)),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8)),
                    child: Icon(icon, color: color, size: 14)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                      color: (positive ? AppColors.success : AppColors.danger)
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4)),
                  child: Text(trend,
                      style: TextStyle(
                          color: positive ? AppColors.success : AppColors.danger,
                          fontSize: 9,
                          fontWeight: FontWeight.w700)),
                ),
              ]),
              const Spacer(),
              Text(value,
                  style: TextStyle(
                      color: color,
                      fontSize: 22,
                      fontWeight: FontWeight.w900)),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 10),
                  overflow: TextOverflow.ellipsis),
            ]),
      );

  Widget _approvalCard(
          String title, String sub, Color color, IconData icon) =>
      Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: color, size: 20)),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(title,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                Text(sub,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 11)),
              ])),
          const Icon(Icons.chevron_right,
              color: AppColors.textMuted, size: 20),
        ]),
      );

  Widget _healthRow(
          String module, double ratio, int count, Color color) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(module,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12)),
            ),
            Text('$count',
                style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ratio,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 4,
            ),
          ),
        ]),
      );

  Widget _activityRow(Map<String, dynamic> activity) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.history,
                size: 16, color: AppColors.textMuted),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Text(
                '${activity['user'] ?? 'System'} — ${activity['event'] ?? activity['action'] ?? ''}',
                style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500),
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                '${activity['module'] ?? ''} · ${activity['timestamp'] ?? ''}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 10),
              ),
            ]),
          ),
        ]),
      );
}
