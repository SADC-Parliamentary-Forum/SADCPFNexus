import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class PerformanceTrackerScreen extends ConsumerStatefulWidget {
  const PerformanceTrackerScreen({super.key});

  @override
  ConsumerState<PerformanceTrackerScreen> createState() =>
      _PerformanceTrackerScreenState();
}

class _PerformanceTrackerScreenState
    extends ConsumerState<PerformanceTrackerScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _all = [];
  List<Map<String, dynamic>> _team = [];

  int _tracked = 0;
  int _watchlist = 0;
  int _atRisk = 0;

  bool _isSupervisorOrHr = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      final roles = await repo.getStoredRoles();
      _isSupervisorOrHr = roles.any((r) =>
          r.toLowerCase().contains('hr') ||
          r.toLowerCase().contains('supervisor') ||
          r.toLowerCase().contains('admin') ||
          r.toLowerCase().contains('manager'));

      final dio = ref.read(apiClientProvider).dio;

      final allRes = await dio.get<dynamic>('/hr/performance');
      final allData = allRes.data;
      final List<dynamic> rawAll =
          (allData is Map && allData['data'] != null)
              ? allData['data'] as List<dynamic>
              : (allData is List ? allData : []);
      _all = rawAll.cast<Map<String, dynamic>>();

      // Try loading team
      try {
        final teamRes = await dio.get<dynamic>('/hr/performance/team');
        final teamData = teamRes.data;
        final List<dynamic> rawTeam =
            (teamData is Map && teamData['data'] != null)
                ? teamData['data'] as List<dynamic>
                : (teamData is List ? teamData : []);
        _team = rawTeam.cast<Map<String, dynamic>>();
      } catch (_) {
        _team = [];
      }

      _tracked = _all.length;
      _watchlist = _all.where((t) => t['status'] == 'watchlist').length;
      _atRisk = _all
          .where((t) =>
              t['status'] == 'at_risk' ||
              t['status'] == 'critical_review_required')
          .length;

      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> _getTabItems(int index) {
    switch (index) {
      case 0:
        return _all;
      case 1:
        return _team;
      case 2:
        return _all.where((t) => t['status'] == 'watchlist').toList();
      case 3:
        return _all
            .where((t) =>
                t['status'] == 'at_risk' ||
                t['status'] == 'critical_review_required')
            .toList();
      default:
        return _all;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('Performance Tracker'),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          labelStyle: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Team'),
            Tab(text: 'Watchlist'),
            Tab(text: 'At Risk'),
          ],
        ),
      ),
      floatingActionButton: _isSupervisorOrHr
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
              onPressed: () {
                // Future: open new tracker form dialog
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('New tracker form coming soon')),
                );
              },
              child: const Icon(Icons.add),
            )
          : null,
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : Column(
                  children: [
                    _buildStatsRow(),
                    Expanded(
                      child: TabBarView(
                        controller: _tabController,
                        children: List.generate(
                          4,
                          (i) => _buildTrackerList(i),
                        ),
                      ),
                    ),
                  ],
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
            const Icon(Icons.error_outline,
                size: 48, color: AppColors.danger),
            const SizedBox(height: 12),
            const Text(
              'Failed to load performance data',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? '',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textPrimary,
                minimumSize: const Size(140, 44),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _StatChip(
            label: 'Tracked',
            value: _tracked,
            color: AppColors.info,
          ),
          const SizedBox(width: 8),
          _StatChip(
            label: 'Watchlist',
            value: _watchlist,
            color: const Color(0xFFF59E0B),
          ),
          const SizedBox(width: 8),
          _StatChip(
            label: 'At Risk',
            value: _atRisk,
            color: AppColors.danger,
          ),
        ],
      ),
    );
  }

  Widget _buildTrackerList(int tabIndex) {
    final items = _getTabItems(tabIndex);

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.trending_up_outlined,
              size: 56,
              color: AppColors.textMuted.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 12),
            const Text(
              'No trackers found',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Performance records will appear here.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _TrackerCard(
          tracker: items[i],
          onTap: () => context.push(
            '/hr/performance/detail',
            extra: items[i],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _StatChip extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$value',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _TrackerCard extends StatelessWidget {
  final Map<String, dynamic> tracker;
  final VoidCallback onTap;

  const _TrackerCard({required this.tracker, required this.onTap});

  static Color _statusColor(String? status) {
    switch (status) {
      case 'excellent':
      case 'strong':
        return AppColors.primary;
      case 'satisfactory':
        return AppColors.textMuted;
      case 'watchlist':
        return const Color(0xFFF59E0B);
      case 'at_risk':
      case 'critical_review_required':
        return AppColors.danger;
      default:
        return AppColors.textMuted;
    }
  }

  static String _statusLabel(String? status) {
    switch (status) {
      case 'excellent':
        return 'Excellent';
      case 'strong':
        return 'Strong';
      case 'satisfactory':
        return 'Satisfactory';
      case 'watchlist':
        return 'Watchlist';
      case 'at_risk':
        return 'At Risk';
      case 'critical_review_required':
        return 'Critical Review';
      default:
        return status ?? 'Unknown';
    }
  }

  static ({IconData icon, Color color, String label}) _trendInfo(
      String? trend) {
    switch (trend) {
      case 'improving':
        return (
          icon: Icons.trending_up,
          color: AppColors.success,
          label: 'Improving'
        );
      case 'declining':
        return (
          icon: Icons.trending_down,
          color: AppColors.danger,
          label: 'Declining'
        );
      case 'stable':
        return (
          icon: Icons.trending_flat,
          color: AppColors.textMuted,
          label: 'Stable'
        );
      default:
        return (
          icon: Icons.trending_flat,
          color: AppColors.textMuted,
          label: trend ?? 'N/A'
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final employee = tracker['employee'] as Map<String, dynamic>?;
    final name = employee?['name'] as String? ?? 'Unknown';
    final status = tracker['status'] as String?;
    final trend = tracker['performance_trend'] as String?;
    final completionRate = tracker['task_completion_rate'];
    final overdueCount = tracker['overdue_task_count'] as int? ?? 0;
    final warningFlag = tracker['active_warning_flag'] == true;

    final statusColor = _statusColor(status);
    final trendInfo = _trendInfo(trend);

    final completionPct = completionRate != null
        ? (double.tryParse(completionRate.toString()) ?? 0.0)
        : 0.0;

    final initials = name
        .split(' ')
        .where((s) => s.isNotEmpty)
        .take(2)
        .map((s) => s[0].toUpperCase())
        .join();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Avatar
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        initials,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (employee?['position'] != null)
                          Text(
                            employee!['position'] as String,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textMuted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  // Status badge
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                      border:
                          Border.all(color: statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      _statusLabel(status),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  // Trend
                  Icon(trendInfo.icon, size: 14, color: trendInfo.color),
                  const SizedBox(width: 4),
                  Text(
                    trendInfo.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: trendInfo.color,
                    ),
                  ),
                  const SizedBox(width: 16),
                  // Completion rate
                  const Icon(Icons.check_circle_outline,
                      size: 13, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    '${completionPct.toStringAsFixed(0)}% complete',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  if (overdueCount > 0) ...[
                    const Icon(Icons.schedule,
                        size: 13, color: AppColors.danger),
                    const SizedBox(width: 4),
                    Text(
                      '$overdueCount overdue',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
              if (completionPct > 0) ...[
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: completionPct / 100,
                    minHeight: 5,
                    backgroundColor: AppColors.border,
                    color: statusColor,
                  ),
                ),
              ],
              if (warningFlag) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(5),
                        border: Border.all(
                            color: AppColors.danger.withValues(alpha: 0.3)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.flag,
                              size: 11, color: AppColors.danger),
                          SizedBox(width: 3),
                          Text(
                            'Active Warning',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.danger,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
