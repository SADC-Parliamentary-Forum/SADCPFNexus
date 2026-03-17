import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class HrPerformanceDashboardScreen extends ConsumerStatefulWidget {
  const HrPerformanceDashboardScreen({super.key});

  @override
  ConsumerState<HrPerformanceDashboardScreen> createState() =>
      _HrPerformanceDashboardScreenState();
}

class _HrPerformanceDashboardScreenState
    extends ConsumerState<HrPerformanceDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _loading = true;
  String? _error;

  List<Map<String, dynamic>> _all = [];

  // Aggregated stats
  int _excellent = 0;
  int _strong = 0;
  int _satisfactory = 0;
  int _watchlist = 0;
  int _atRisk = 0;
  int _critical = 0;
  int _probation = 0;
  int _warnings = 0;
  int _devActions = 0;
  int _hrAttention = 0;
  int _declining = 0;

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
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<dynamic>('/hr/performance', queryParameters: {'per_page': 200});
      final data = res.data;
      final List<dynamic> raw =
          (data is Map && data['data'] != null)
              ? data['data'] as List<dynamic>
              : (data is List ? data : []);
      _all = raw.cast<Map<String, dynamic>>();

      _excellent = _all.where((t) => t['status'] == 'excellent').length;
      _strong = _all.where((t) => t['status'] == 'strong').length;
      _satisfactory = _all.where((t) => t['status'] == 'satisfactory').length;
      _watchlist = _all.where((t) => t['status'] == 'watchlist').length;
      _atRisk = _all.where((t) => t['status'] == 'at_risk').length;
      _critical = _all.where((t) => t['status'] == 'critical_review_required').length;
      _probation = _all.where((t) => t['probation_flag'] == true).length;
      _warnings = _all.where((t) => t['active_warning_flag'] == true).length;
      _devActions = _all.where((t) => (t['active_development_action_count'] as int? ?? 0) > 0).length;
      _hrAttention = _all.where((t) => t['hr_attention_required'] == true || t['hr_attention_flag'] == true).length;
      _declining = _all.where((t) => t['trend'] == 'declining' || t['performance_trend'] == 'declining').length;

      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> get _watchlistItems =>
      _all.where((t) => t['status'] == 'watchlist').toList();

  List<Map<String, dynamic>> get _atRiskItems => _all
      .where((t) =>
          t['status'] == 'at_risk' || t['status'] == 'critical_review_required')
      .toList();

  List<Map<String, dynamic>> get _devActionItems => _all
      .where((t) => (t['active_development_action_count'] as int? ?? 0) > 0)
      .toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('HR Performance Monitoring'),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
            tooltip: 'Refresh',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Watchlist'),
            Tab(text: 'At Risk'),
            Tab(text: 'Dev. Actions'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _buildOverviewTab(),
                    _buildListTab(_watchlistItems, 'Watchlist', const Color(0xFFF59E0B)),
                    _buildListTab(_atRiskItems, 'At Risk / Critical', AppColors.danger),
                    _buildListTab(_devActionItems, 'Open Dev. Actions', AppColors.info),
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
            const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
            const SizedBox(height: 12),
            const Text(
              'Failed to load dashboard',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _loadData,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.bgDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOverviewTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        children: [
          // Alert banners
          if (_warnings > 0) _buildAlertBanner(
            icon: Icons.flag,
            label: '$_warnings active warning${_warnings > 1 ? 's' : ''}',
            color: AppColors.danger,
          ),
          if (_probation > 0) _buildAlertBanner(
            icon: Icons.pending_actions,
            label: '$_probation on probation — review due',
            color: const Color(0xFFF59E0B),
          ),
          if (_hrAttention > 0) _buildAlertBanner(
            icon: Icons.notifications_active,
            label: '$_hrAttention need HR attention',
            color: AppColors.info,
          ),

          const SizedBox(height: 4),
          const _SectionHeader(title: 'Status Distribution'),
          const SizedBox(height: 8),
          _buildStatusGrid(),

          const SizedBox(height: 16),
          const _SectionHeader(title: 'Trend & Risk Summary'),
          const SizedBox(height: 8),
          _buildRiskSummary(),

          const SizedBox(height: 16),
          const _SectionHeader(title: 'Quick Actions'),
          const SizedBox(height: 8),
          _buildQuickActions(),

          const SizedBox(height: 16),
          // Declining performers
          if (_declining > 0) ...[
            const _SectionHeader(title: 'Declining Trend'),
            const SizedBox(height: 8),
            ..._all
                .where((t) =>
                    t['trend'] == 'declining' ||
                    t['performance_trend'] == 'declining')
                .take(5)
                .map((t) => _TrackerListTile(tracker: t)),
          ],
        ],
      ),
    );
  }

  Widget _buildAlertBanner({required IconData icon, required String label, required Color color}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusGrid() {
    final items = [
      _StatusItem('Excellent', _excellent, AppColors.primary),
      _StatusItem('Strong', _strong, AppColors.success),
      _StatusItem('Satisfactory', _satisfactory, AppColors.textSecondary),
      _StatusItem('Watchlist', _watchlist, const Color(0xFFF59E0B)),
      _StatusItem('At Risk', _atRisk, AppColors.danger),
      _StatusItem('Critical', _critical, const Color(0xFFDC2626)),
    ];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1.4,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final item = items[i];
        return Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: item.color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: item.color.withValues(alpha: 0.25)),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${item.count}',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: item.color),
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRiskSummary() {
    final rows = [
      ('Active Warnings', _warnings, AppColors.danger),
      ('On Probation', _probation, const Color(0xFFF59E0B)),
      ('Declining Trend', _declining, AppColors.danger),
      ('Dev. Actions Open', _devActions, AppColors.info),
      ('HR Attention', _hrAttention, AppColors.info),
    ];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: rows.asMap().entries.map((entry) {
          final i = entry.key;
          final row = entry.value;
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              border: i < rows.length - 1
                  ? const Border(bottom: BorderSide(color: AppColors.border))
                  : null,
            ),
            child: Row(
              children: [
                Text(
                  row.$1,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: row.$3.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${row.$2}',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: row.$3,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildQuickActions() {
    final actions = [
      ('All Trackers', Icons.trending_up, '/hr/performance'),
      ('Team View', Icons.group, '/hr/performance/team'),
      ('HR Files', Icons.folder_open, '/hr/files'),
    ];
    return Row(
      children: actions.map((action) {
        return Expanded(
          child: GestureDetector(
            onTap: () => context.push(action.$3),
            child: Container(
              margin: EdgeInsets.only(
                right: action == actions.last ? 0 : 8,
              ),
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
              ),
              child: Column(
                children: [
                  Icon(action.$2, size: 22, color: AppColors.primary),
                  const SizedBox(height: 4),
                  Text(
                    action.$1,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildListTab(
    List<Map<String, dynamic>> items,
    String label,
    Color accentColor,
  ) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 56,
              color: AppColors.textMuted.withValues(alpha: 0.4),
            ),
            const SizedBox(height: 12),
            Text(
              'No $label cases',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Nothing to flag here right now.',
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
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _TrackerListTile(tracker: items[i], accentColor: accentColor),
      ),
    );
  }
}

// ─── Supporting widgets ──────────────────────────────────────────────────────

class _StatusItem {
  final String label;
  final int count;
  final Color color;
  const _StatusItem(this.label, this.count, this.color);
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(
      title.toUpperCase(),
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: AppColors.textMuted,
        letterSpacing: 1.0,
      ),
    );
  }
}

class _TrackerListTile extends StatelessWidget {
  final Map<String, dynamic> tracker;
  final Color? accentColor;

  const _TrackerListTile({required this.tracker, this.accentColor});

  static Color _statusColor(String? s) {
    switch (s) {
      case 'excellent':
      case 'strong':
        return AppColors.primary;
      case 'watchlist':
        return const Color(0xFFF59E0B);
      case 'at_risk':
      case 'critical_review_required':
        return AppColors.danger;
      default:
        return AppColors.textMuted;
    }
  }

  static String _statusLabel(String? s) {
    switch (s) {
      case 'excellent': return 'Excellent';
      case 'strong': return 'Strong';
      case 'satisfactory': return 'Satisfactory';
      case 'watchlist': return 'Watchlist';
      case 'at_risk': return 'At Risk';
      case 'critical_review_required': return 'Critical';
      default: return s ?? 'Unknown';
    }
  }

  @override
  Widget build(BuildContext context) {
    final employee = tracker['employee'] as Map<String, dynamic>?;
    final name = employee?['name'] as String? ?? 'Unknown';
    final status = tracker['status'] as String?;
    final statusColor = accentColor ?? _statusColor(status);

    final initials = name
        .split(' ')
        .where((s) => s.isNotEmpty)
        .take(2)
        .map((s) => s[0].toUpperCase())
        .join();

    final completionRate = tracker['assignment_completion_rate'] ?? tracker['task_completion_rate'];
    final completionPct = completionRate != null
        ? (double.tryParse(completionRate.toString()) ?? 0.0)
        : 0.0;
    final overdue = tracker['overdue_task_count'] as int? ?? 0;
    final devActions = tracker['active_development_action_count'] as int? ?? 0;
    final warningFlag = tracker['active_warning_flag'] == true;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
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
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    _StatusBadge(label: _statusLabel(status), color: statusColor),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      '${completionPct.toStringAsFixed(0)}% complete',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                    if (overdue > 0) ...[
                      const SizedBox(width: 10),
                      Text(
                        '$overdue overdue',
                        style: const TextStyle(fontSize: 11, color: AppColors.danger, fontWeight: FontWeight.w600),
                      ),
                    ],
                    if (devActions > 0) ...[
                      const SizedBox(width: 10),
                      Text(
                        '$devActions dev.',
                        style: const TextStyle(fontSize: 11, color: AppColors.info, fontWeight: FontWeight.w600),
                      ),
                    ],
                    if (warningFlag) ...[
                      const SizedBox(width: 10),
                      const Icon(Icons.flag, size: 12, color: AppColors.danger),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
