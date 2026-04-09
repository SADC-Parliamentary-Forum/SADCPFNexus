import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class GlobalExecutiveSummaryScreen extends ConsumerStatefulWidget {
  const GlobalExecutiveSummaryScreen({super.key});
  @override
  ConsumerState<GlobalExecutiveSummaryScreen> createState() => _GlobalExecutiveSummaryScreenState();
}

class _GlobalExecutiveSummaryScreenState extends ConsumerState<GlobalExecutiveSummaryScreen> {
  bool _loading = true;
  String? _error;

  // KPI data
  int _totalSubmissions = 0;
  double _approvalRate = 0;
  int _activeTravel = 0;
  int _pendingApprovals = 0;
  int _leaveRequests = 0;

  // Module breakdown
  List<Map<String, dynamic>> _byModule = [];

  // Monthly submissions (last 6 months)
  List<Map<String, dynamic>> _monthly = [];

  // Recent activity
  List<Map<String, dynamic>> _recentActivity = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(apiClientProvider);
      final results = await Future.wait([
        api.dio.get<Map<String, dynamic>>('/analytics/summary'),
        api.dio.get<Map<String, dynamic>>('/dashboard/stats'),
      ]);

      final analytics = results[0].data ?? {};
      final dashboard = results[1].data ?? {};

      final kpi = analytics['kpi'] as Map<String, dynamic>? ?? {};
      final byModule = (analytics['by_module'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final monthly = (analytics['monthly_submissions'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final recent = (analytics['recent_activity'] as List?)?.cast<Map<String, dynamic>>() ?? [];

      if (!mounted) return;
      setState(() {
        _totalSubmissions = kpi['total_submissions'] as int? ?? 0;
        _approvalRate = (kpi['approval_rate_pct'] as num?)?.toDouble() ?? 0;
        _activeTravel = kpi['active_travel'] as int? ?? 0;
        _pendingApprovals = dashboard['pending_approvals'] as int? ?? 0;
        _leaveRequests = dashboard['leave_requests'] as int? ?? 0;
        _byModule = byModule;
        _monthly = monthly.length > 6 ? monthly.sublist(monthly.length - 6) : monthly;
        _recentActivity = recent.take(5).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load analytics data.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Global Summary',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20, color: AppColors.textMuted),
            onPressed: _load,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: AppColors.textMuted, fontSize: 14)),
                    const SizedBox(height: 16),
                    TextButton(onPressed: _load, child: const Text('Retry', style: TextStyle(color: AppColors.primary))),
                  ]),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  backgroundColor: AppColors.bgSurface,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Header summary card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF1A4030), Color(0xFF102219)]),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                        ),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Container(
                              width: 32, height: 32,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.analytics_outlined, color: AppColors.primary, size: 18),
                            ),
                            const SizedBox(width: 10),
                            const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('Executive Intelligence',
                                style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700)),
                              Text('Live Data', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                            ]),
                          ]),
                          const SizedBox(height: 16),
                          Row(children: [
                            Expanded(child: _heroStat('Total Submissions', '$_totalSubmissions', AppColors.primary)),
                            Container(width: 1, height: 48, color: AppColors.border),
                            Expanded(child: _heroStat('Approval Rate', '${_approvalRate.toStringAsFixed(1)}%', AppColors.success)),
                            Container(width: 1, height: 48, color: AppColors.border),
                            Expanded(child: _heroStat('Active Travel', '$_activeTravel', AppColors.gold)),
                          ]),
                        ]),
                      ),
                      const SizedBox(height: 20),

                      // Quick stats row
                      Row(children: [
                        Expanded(child: _quickStat('Pending Approvals', '$_pendingApprovals', AppColors.warning, Icons.pending_actions_outlined)),
                        const SizedBox(width: 8),
                        Expanded(child: _quickStat('Leave Requests', '$_leaveRequests', AppColors.info, Icons.beach_access_outlined)),
                      ]),
                      const SizedBox(height: 20),

                      // Monthly submissions chart
                      if (_monthly.isNotEmpty) ...[
                        _sectionHeader('Monthly Submissions', Icons.bar_chart_outlined, AppColors.primary),
                        const SizedBox(height: 10),
                        _barChartCard(_monthly),
                        const SizedBox(height: 20),
                      ],

                      // Module breakdown
                      if (_byModule.isNotEmpty) ...[
                        _sectionHeader('Activity by Module', Icons.grid_view_outlined, AppColors.success),
                        const SizedBox(height: 10),
                        ..._byModule.map((m) => _moduleRow(
                          m['label'] as String? ?? m['module'] as String? ?? '',
                          m['count'] as int? ?? 0,
                          _totalSubmissions,
                        )),
                        const SizedBox(height: 20),
                      ],

                      // Recent activity
                      if (_recentActivity.isNotEmpty) ...[
                        _sectionHeader('Recent Activity', Icons.history_outlined, AppColors.gold),
                        const SizedBox(height: 10),
                        ..._recentActivity.map((a) => _activityRow(
                          a['event'] as String? ?? '',
                          a['user'] as String? ?? '',
                          a['timestamp'] as String? ?? '',
                        )),
                        const SizedBox(height: 20),
                      ],

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
    );
  }

  Widget _heroStat(String label, String val, Color color) => Column(children: [
    Text(val, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9), textAlign: TextAlign.center),
  ]);

  Widget _quickStat(String label, String val, Color color, IconData icon) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.bgSurface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(children: [
      Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: color, size: 18),
      ),
      const SizedBox(width: 10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(val, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ]),
    ]),
  );

  Widget _sectionHeader(String title, IconData icon, Color color) => Row(children: [
    Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, color: color, size: 16),
    ),
    const SizedBox(width: 8),
    Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
  ]);

  Widget _barChartCard(List<Map<String, dynamic>> months) {
    final maxCount = months.map((m) => (m['count'] as int? ?? 0)).reduce((a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Last 6 Months',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: months.map((m) {
            final count = m['count'] as int? ?? 0;
            final ratio = maxCount > 0 ? count / maxCount : 0.0;
            return Column(children: [
              Text('$count', style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
              const SizedBox(height: 4),
              Container(
                width: 32,
                height: 60 * ratio + 4,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(height: 6),
              Text(m['label'] as String? ?? '', style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
            ]);
          }).toList(),
        ),
      ]),
    );
  }

  Widget _moduleRow(String label, int count, int total) {
    final pct = total > 0 ? count / total : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
          Text('$count', style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct,
            backgroundColor: AppColors.border,
            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
            minHeight: 4,
          ),
        ),
      ]),
    );
  }

  Widget _activityRow(String event, String user, String timestamp) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(children: [
      Container(
        width: 32, height: 32,
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
        child: const Icon(Icons.history, color: AppColors.textMuted, size: 15),
      ),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(event, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
        Text('$user · $timestamp', style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ])),
    ]),
  );
}
