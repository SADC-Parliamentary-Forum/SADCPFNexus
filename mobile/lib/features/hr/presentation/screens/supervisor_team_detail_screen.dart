import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

/// Expanded supervisor team view with detailed performance metrics,
/// workload indicators, update compliance, and conduct flags for each direct report.
class SupervisorTeamDetailScreen extends ConsumerStatefulWidget {
  const SupervisorTeamDetailScreen({super.key});

  @override
  ConsumerState<SupervisorTeamDetailScreen> createState() =>
      _SupervisorTeamDetailScreenState();
}

class _SupervisorTeamDetailScreenState
    extends ConsumerState<SupervisorTeamDetailScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _team = [];
  String _sortBy = 'name'; // name | status | completion | overdue
  bool _showOnlyAttention = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<dynamic>('/hr/performance/team');
      final data = res.data;
      final List<dynamic> raw =
          (data is Map && data['data'] != null)
              ? data['data'] as List<dynamic>
              : (data is List ? data : []);
      _team = raw.cast<Map<String, dynamic>>();
      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> get _sortedFiltered {
    var items = _showOnlyAttention
        ? _team.where((t) {
            final status = t['status'] as String? ?? '';
            final warningFlag = t['active_warning_flag'] == true;
            final hrAttention = t['hr_attention_required'] == true || t['hr_attention_flag'] == true;
            return status == 'watchlist' ||
                status == 'at_risk' ||
                status == 'critical_review_required' ||
                warningFlag ||
                hrAttention;
          }).toList()
        : List<Map<String, dynamic>>.from(_team);

    items.sort((a, b) {
      switch (_sortBy) {
        case 'status':
          final order = ['critical_review_required', 'at_risk', 'watchlist', 'satisfactory', 'strong', 'excellent'];
          final ai = order.indexOf(a['status'] as String? ?? '');
          final bi = order.indexOf(b['status'] as String? ?? '');
          return ai.compareTo(bi);
        case 'completion':
          final ac = double.tryParse((a['assignment_completion_rate'] ?? a['task_completion_rate'] ?? 0).toString()) ?? 0;
          final bc = double.tryParse((b['assignment_completion_rate'] ?? b['task_completion_rate'] ?? 0).toString()) ?? 0;
          return bc.compareTo(ac);
        case 'overdue':
          final ao = a['overdue_task_count'] as int? ?? 0;
          final bo = b['overdue_task_count'] as int? ?? 0;
          return bo.compareTo(ao);
        default:
          final an = (a['employee'] as Map?)?['name'] as String? ?? '';
          final bn = (b['employee'] as Map?)?['name'] as String? ?? '';
          return an.compareTo(bn);
      }
    });
    return items;
  }

  // Summary stats
  int get _needsAttentionCount => _team
      .where((t) =>
          t['status'] == 'watchlist' ||
          t['status'] == 'at_risk' ||
          t['status'] == 'critical_review_required' ||
          t['active_warning_flag'] == true)
      .length;

  double get _avgCompletion {
    if (_team.isEmpty) return 0;
    final total = _team.fold<double>(0, (acc, t) {
      final v = t['assignment_completion_rate'] ?? t['task_completion_rate'] ?? 0;
      return acc + (double.tryParse(v.toString()) ?? 0);
    });
    return total / _team.length;
  }

  int get _totalOverdue =>
      _team.fold(0, (acc, t) => acc + (t['overdue_task_count'] as int? ?? 0));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('My Team — Supervisor View'),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : Column(
                  children: [
                    _buildSummaryBar(),
                    _buildControls(),
                    Expanded(
                      child: _buildTeamList(),
                    ),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
          const SizedBox(height: 12),
          Text(
            _error ?? 'Failed to load team data',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loadData,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgDark,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          _SummaryChip(
            label: 'Members',
            value: '${_team.length}',
            color: AppColors.primary,
          ),
          const SizedBox(width: 8),
          _SummaryChip(
            label: 'Attention',
            value: '$_needsAttentionCount',
            color: _needsAttentionCount > 0
                ? const Color(0xFFF59E0B)
                : AppColors.textMuted,
          ),
          const SizedBox(width: 8),
          _SummaryChip(
            label: 'Avg Completion',
            value: '${_avgCompletion.toStringAsFixed(0)}%',
            color: _avgCompletion >= 70 ? AppColors.success : AppColors.danger,
          ),
          const SizedBox(width: 8),
          _SummaryChip(
            label: 'Total Overdue',
            value: '$_totalOverdue',
            color: _totalOverdue > 0 ? AppColors.danger : AppColors.textMuted,
          ),
        ],
      ),
    );
  }

  Widget _buildControls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          // Sort dropdown
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _sortBy,
                  isDense: true,
                  dropdownColor: AppColors.bgSurface,
                  style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                  items: const [
                    DropdownMenuItem(value: 'name', child: Text('Sort: Name')),
                    DropdownMenuItem(value: 'status', child: Text('Sort: Risk first')),
                    DropdownMenuItem(value: 'completion', child: Text('Sort: Completion')),
                    DropdownMenuItem(value: 'overdue', child: Text('Sort: Overdue')),
                  ],
                  onChanged: (v) => setState(() => _sortBy = v ?? 'name'),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Attention filter toggle
          GestureDetector(
            onTap: () => setState(() => _showOnlyAttention = !_showOnlyAttention),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _showOnlyAttention
                    ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                    : AppColors.bgSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: _showOnlyAttention
                      ? const Color(0xFFF59E0B)
                      : AppColors.border,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.warning_amber,
                    size: 14,
                    color: _showOnlyAttention
                        ? const Color(0xFFF59E0B)
                        : AppColors.textMuted,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Attention only',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _showOnlyAttention
                          ? const Color(0xFFF59E0B)
                          : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeamList() {
    final items = _sortedFiltered;
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.people_outline, size: 56, color: AppColors.textMuted.withValues(alpha: 0.4)),
            const SizedBox(height: 12),
            const Text(
              'No team members found',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _TeamMemberDetailCard(
          tracker: items[i],
          onTap: () => context.push('/hr/performance/detail', extra: items[i]),
        ),
      ),
    );
  }
}

// ─── Team Member Detail Card ─────────────────────────────────────────────────

class _TeamMemberDetailCard extends StatelessWidget {
  final Map<String, dynamic> tracker;
  final VoidCallback onTap;

  const _TeamMemberDetailCard({required this.tracker, required this.onTap});

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
        return AppColors.textSecondary;
    }
  }

  static String _statusLabel(String? s) {
    switch (s) {
      case 'excellent': return 'Excellent';
      case 'strong': return 'Strong';
      case 'satisfactory': return 'Satisfactory';
      case 'watchlist': return 'Watchlist';
      case 'at_risk': return 'At Risk';
      case 'critical_review_required': return 'Critical Review';
      default: return s ?? 'Unknown';
    }
  }

  static ({IconData icon, Color color, String label}) _trendInfo(String? t) {
    switch (t) {
      case 'improving':
        return (icon: Icons.trending_up, color: AppColors.success, label: 'Improving');
      case 'declining':
        return (icon: Icons.trending_down, color: AppColors.danger, label: 'Declining');
      case 'stable':
        return (icon: Icons.trending_flat, color: AppColors.textMuted, label: 'Stable');
      case 'inconsistent':
        return (icon: Icons.shuffle, color: const Color(0xFFF59E0B), label: 'Inconsistent');
      default:
        return (icon: Icons.help_outline, color: AppColors.textMuted, label: 'N/A');
    }
  }

  @override
  Widget build(BuildContext context) {
    final employee = tracker['employee'] as Map<String, dynamic>?;
    final name = employee?['name'] as String? ?? 'Unknown';
    final email = employee?['email'] as String?;
    final status = tracker['status'] as String?;
    final trend = tracker['trend'] as String? ?? tracker['performance_trend'] as String?;

    final statusColor = _statusColor(status);
    final trendInfo = _trendInfo(trend);

    final initials = name
        .split(' ')
        .where((s) => s.isNotEmpty)
        .take(2)
        .map((s) => s[0].toUpperCase())
        .join();

    final completionRate = tracker['assignment_completion_rate'] ?? tracker['task_completion_rate'] ?? 0;
    final completionPct = double.tryParse(completionRate.toString()) ?? 0.0;

    final overdueCount = tracker['overdue_task_count'] as int? ?? 0;
    final blockedCount = tracker['blocked_task_count'] as int? ?? 0;
    final completedCount = tracker['completed_task_count'] as int? ?? 0;
    final hoursLogged = tracker['timesheet_hours_logged'] ?? tracker['hours_logged'];
    final updateCompliance = tracker['update_compliance_score'];
    final workloadScore = tracker['workload_score'];
    final commendations = tracker['commendation_count'] as int? ?? 0;
    final devActions = tracker['active_development_action_count'] as int? ?? 0;
    final warningFlag = tracker['active_warning_flag'] == true;
    final hrAttention = tracker['hr_attention_required'] == true || tracker['hr_attention_flag'] == true;
    final mgmtAttention = tracker['management_attention_required'] == true || tracker['management_attention_flag'] == true;
    final probation = tracker['probation_flag'] == true;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: warningFlag
                  ? AppColors.danger.withValues(alpha: 0.35)
                  : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        initials,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
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
                        if (email != null)
                          Text(
                            email,
                            style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                          ),
                      ],
                    ),
                  ),
                  _StatusBadge(label: _statusLabel(status), color: statusColor),
                ],
              ),
              const SizedBox(height: 10),

              // Completion progress bar
              Row(
                children: [
                  const Text('Completion', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                  const Spacer(),
                  Text(
                    '${completionPct.toStringAsFixed(0)}%',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: completionPct / 100,
                  minHeight: 5,
                  backgroundColor: AppColors.border,
                  color: completionPct >= 80
                      ? AppColors.success
                      : completionPct >= 60
                          ? AppColors.primary
                          : completionPct >= 40
                              ? const Color(0xFFF59E0B)
                              : AppColors.danger,
                ),
              ),
              const SizedBox(height: 10),

              // Core metrics grid
              Row(
                children: [
                  _MetricCell(label: 'Completed', value: '$completedCount', color: AppColors.success),
                  _MetricCell(
                    label: 'Overdue',
                    value: '$overdueCount',
                    color: overdueCount > 0 ? AppColors.danger : AppColors.textMuted,
                  ),
                  _MetricCell(
                    label: 'Blocked',
                    value: '$blockedCount',
                    color: blockedCount > 0 ? const Color(0xFFF59E0B) : AppColors.textMuted,
                  ),
                  _MetricCell(
                    label: 'Hours',
                    value: hoursLogged != null ? '${double.tryParse(hoursLogged.toString())?.toStringAsFixed(0) ?? hoursLogged}h' : 'N/A',
                    color: AppColors.info,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _MetricCell(
                    label: 'Updates',
                    value: updateCompliance != null ? '${double.tryParse(updateCompliance.toString())?.toStringAsFixed(1) ?? updateCompliance}/10' : 'N/A',
                    color: AppColors.primary,
                  ),
                  _MetricCell(
                    label: 'Workload',
                    value: workloadScore != null ? '${double.tryParse(workloadScore.toString())?.toStringAsFixed(1) ?? workloadScore}/10' : 'N/A',
                    color: workloadScore != null && (double.tryParse(workloadScore.toString()) ?? 0) >= 8
                        ? const Color(0xFFF59E0B)
                        : AppColors.textSecondary,
                  ),
                  _MetricCell(
                    label: 'Commend.',
                    value: '$commendations',
                    color: commendations > 0 ? AppColors.success : AppColors.textMuted,
                  ),
                  _MetricCell(
                    label: 'Dev. Actions',
                    value: '$devActions',
                    color: devActions > 0 ? AppColors.info : AppColors.textMuted,
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Workload progress (if available)
              if (workloadScore != null) ...[
                Row(
                  children: [
                    const Text('Workload', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                    const Spacer(),
                    Text(
                      '${double.tryParse(workloadScore.toString())?.toStringAsFixed(1) ?? workloadScore}/10',
                      style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (double.tryParse(workloadScore.toString()) ?? 0) / 10,
                    minHeight: 4,
                    backgroundColor: AppColors.border,
                    color: (double.tryParse(workloadScore.toString()) ?? 0) >= 8
                        ? const Color(0xFFF59E0B)
                        : AppColors.info,
                  ),
                ),
                const SizedBox(height: 10),
              ],

              // Footer: trend + flags
              Row(
                children: [
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
                  const Spacer(),
                  Wrap(
                    spacing: 4,
                    children: [
                      if (warningFlag)
                        const _FlagChip(label: 'Warning', color: AppColors.danger),
                      if (probation)
                        const _FlagChip(label: 'Probation', color: Color(0xFFF59E0B)),
                      if (hrAttention)
                        const _FlagChip(label: 'HR', color: AppColors.info),
                      if (mgmtAttention)
                        const _FlagChip(label: 'Mgmt', color: Color(0xFFF59E0B)),
                      if (commendations > 0)
                        _FlagChip(label: '★ $commendations', color: AppColors.success),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Reusable sub-widgets ────────────────────────────────────────────────────

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _SummaryChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
            const SizedBox(height: 1),
            Text(label, style: const TextStyle(fontSize: 9, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

class _MetricCell extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _MetricCell({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
            const SizedBox(height: 1),
            Text(label, style: const TextStyle(fontSize: 8, color: AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

class _FlagChip extends StatelessWidget {
  final String label;
  final Color color;
  const _FlagChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color)),
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
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
    );
  }
}
