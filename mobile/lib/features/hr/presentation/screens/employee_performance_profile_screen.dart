import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class EmployeePerformanceProfileScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> tracker;

  const EmployeePerformanceProfileScreen({
    super.key,
    required this.tracker,
  });

  @override
  ConsumerState<EmployeePerformanceProfileScreen> createState() =>
      _EmployeePerformanceProfileScreenState();
}

class _EmployeePerformanceProfileScreenState
    extends ConsumerState<EmployeePerformanceProfileScreen> {
  bool _isSupervisor = false;
  bool _isHr = false;

  final TextEditingController _supervisorNotesController =
      TextEditingController();
  bool _savingSupervisorNotes = false;

  @override
  void initState() {
    super.initState();
    final supervisorSummary =
        widget.tracker['supervisor_summary'] as String? ?? '';
    _supervisorNotesController.text = supervisorSummary;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRoles());
  }

  @override
  void dispose() {
    _supervisorNotesController.dispose();
    super.dispose();
  }

  Future<void> _loadRoles() async {
    final repo = ref.read(authRepositoryProvider);
    final roles = await repo.getStoredRoles();
    if (mounted) {
      setState(() {
        _isSupervisor = roles.any((r) =>
            r.toLowerCase().contains('supervisor') ||
            r.toLowerCase().contains('manager') ||
            r.toLowerCase().contains('admin'));
        _isHr = roles.any((r) => r.toLowerCase().contains('hr'));
      });
    }
  }

  Future<void> _saveSupervisorNotes() async {
    final id = widget.tracker['id'];
    if (id == null) return;
    setState(() => _savingSupervisorNotes = true);
    try {
      await ref.read(apiClientProvider).dio.put<dynamic>(
        '/hr/performance/$id',
        data: {'supervisor_summary': _supervisorNotesController.text},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Notes saved')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _savingSupervisorNotes = false);
    }
  }

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
    final t = widget.tracker;
    final employee = t['employee'] as Map<String, dynamic>?;
    final name = employee?['name'] as String? ?? 'Unknown';
    final status = t['status'] as String?;
    final trend = t['performance_trend'] as String?;

    final trendInfo = _trendInfo(trend);
    final statusColor = _statusColor(status);

    final initials = name
        .split(' ')
        .where((s) => s.isNotEmpty)
        .take(2)
        .map((s) => s[0].toUpperCase())
        .join();

    final scores = [
      ('Output', t['output_score']),
      ('Timeliness', t['timeliness_score']),
      ('Quality', t['quality_score']),
      ('Workload', t['workload_score']),
      ('Update Compliance', t['update_compliance_score']),
      ('Dev Progress', t['development_progress_score']),
    ];

    final completedTasks = t['completed_task_count'] as int? ?? 0;
    final overdueTasks = t['overdue_task_count'] as int? ?? 0;
    final blockedTasks = t['blocked_task_count'] as int? ?? 0;
    final completionRate = t['task_completion_rate'];
    final avgDelay = t['avg_delay_days'];
    final hoursLogged = t['hours_logged'];

    final completionPct = completionRate != null
        ? (double.tryParse(completionRate.toString()) ?? 0.0)
        : 0.0;

    final warningFlag = t['active_warning_flag'] == true;
    final conductRisk = t['conduct_risk_flag'] == true;
    final recognition = t['recognition_flag'] == true;
    final probation = t['probation_flag'] == true;
    final hrAttention = t['hr_attention_flag'] == true;
    final mgmtAttention = t['management_attention_flag'] == true;

    final hrNotes = t['hr_summary'] as String?;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Text(
              'Performance Profile',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              name,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          // Header card
          _buildHeaderCard(
              initials, name, employee, statusColor, status, trendInfo),
          const SizedBox(height: 16),

          // Score grid
          _buildSectionTitle('Performance Scores'),
          const SizedBox(height: 8),
          _buildScoresGrid(scores),
          const SizedBox(height: 16),

          // Metrics
          _buildSectionTitle('Task Metrics'),
          const SizedBox(height: 8),
          _buildMetricsSection(
            completedTasks,
            overdueTasks,
            blockedTasks,
            completionPct,
            avgDelay,
            hoursLogged,
          ),
          const SizedBox(height: 16),

          // Flags
          if (warningFlag ||
              conductRisk ||
              recognition ||
              probation ||
              hrAttention ||
              mgmtAttention) ...[
            _buildSectionTitle('Active Flags'),
            const SizedBox(height: 8),
            _buildFlagsSection(
              warningFlag: warningFlag,
              conductRisk: conductRisk,
              recognition: recognition,
              probation: probation,
              hrAttention: hrAttention,
              mgmtAttention: mgmtAttention,
            ),
            const SizedBox(height: 16),
          ],

          // Supervisor Notes
          _buildSectionTitle('Supervisor Notes'),
          const SizedBox(height: 8),
          _buildSupervisorNotes(),
          const SizedBox(height: 16),

          // HR Notes
          if (_isHr && hrNotes != null && hrNotes.isNotEmpty) ...[
            _buildSectionTitle('HR Notes'),
            const SizedBox(height: 8),
            _buildHrNotes(hrNotes),
          ],
        ],
      ),
    );
  }

  Widget _buildHeaderCard(
    String initials,
    String name,
    Map<String, dynamic>? employee,
    Color statusColor,
    String? status,
    ({IconData icon, Color color, String label}) trendInfo,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: statusColor,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (employee?['position'] != null)
                  Text(
                    employee!['position'] as String,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textMuted,
                    ),
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _Badge(
                      label: _statusLabel(status),
                      color: statusColor,
                    ),
                    const SizedBox(width: 8),
                    _Badge(
                      label: trendInfo.label,
                      color: trendInfo.color,
                      icon: trendInfo.icon,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: AppColors.textSecondary,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildScoresGrid(List<(String, dynamic)> scores) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.8,
      ),
      itemCount: scores.length,
      itemBuilder: (_, i) {
        final label = scores[i].$1;
        final raw = scores[i].$2;
        final value =
            raw != null ? double.tryParse(raw.toString()) : null;
        return _ScoreCard(label: label, score: value);
      },
    );
  }

  Widget _buildMetricsSection(
    int completed,
    int overdue,
    int blocked,
    double completionPct,
    dynamic avgDelay,
    dynamic hoursLogged,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _MetricTile(
                label: 'Completed',
                value: '$completed',
                color: AppColors.success,
              ),
              const SizedBox(width: 8),
              _MetricTile(
                label: 'Overdue',
                value: '$overdue',
                color: overdue > 0 ? AppColors.danger : AppColors.textMuted,
              ),
              const SizedBox(width: 8),
              _MetricTile(
                label: 'Blocked',
                value: '$blocked',
                color: blocked > 0
                    ? const Color(0xFFF59E0B)
                    : AppColors.textMuted,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _MetricTile(
                label: 'Completion',
                value: '${completionPct.toStringAsFixed(0)}%',
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              _MetricTile(
                label: 'Avg Delay',
                value: avgDelay != null
                    ? '${double.tryParse(avgDelay.toString())?.toStringAsFixed(1) ?? avgDelay}d'
                    : 'N/A',
                color: AppColors.textMuted,
              ),
              const SizedBox(width: 8),
              _MetricTile(
                label: 'Hours Logged',
                value: hoursLogged != null
                    ? '${double.tryParse(hoursLogged.toString())?.toStringAsFixed(0) ?? hoursLogged}h'
                    : 'N/A',
                color: AppColors.info,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFlagsSection({
    required bool warningFlag,
    required bool conductRisk,
    required bool recognition,
    required bool probation,
    required bool hrAttention,
    required bool mgmtAttention,
  }) {
    final flags = [
      if (warningFlag) ('Warning', AppColors.danger),
      if (conductRisk) ('Conduct Risk', AppColors.danger),
      if (recognition) ('Recognition', AppColors.success),
      if (probation) ('Probation', const Color(0xFFF59E0B)),
      if (hrAttention) ('HR Attention', AppColors.info),
      if (mgmtAttention) ('Mgmt Attention', const Color(0xFFF59E0B)),
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: flags.map((f) {
          return Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: f.$2.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: f.$2.withValues(alpha: 0.3)),
            ),
            child: Text(
              f.$1,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: f.$2,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSupervisorNotes() {
    if (_isSupervisor) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            TextField(
              controller: _supervisorNotesController,
              maxLines: 4,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textPrimary,
              ),
              decoration: const InputDecoration(
                hintText: 'Enter supervisor notes...',
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _savingSupervisorNotes ? null : _saveSupervisorNotes,
              style: TextButton.styleFrom(
                backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                foregroundColor: AppColors.primary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: _savingSupervisorNotes
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: AppColors.primary))
                  : const Text(
                      'Save Notes',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600),
                    ),
            ),
          ],
        ),
      );
    } else {
      final notes = widget.tracker['supervisor_summary'] as String?;
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Text(
          notes?.isNotEmpty == true ? notes! : 'No supervisor notes.',
          style: TextStyle(
            fontSize: 13,
            color: notes?.isNotEmpty == true
                ? AppColors.textPrimary
                : AppColors.textMuted,
            fontStyle: notes?.isNotEmpty == true
                ? FontStyle.normal
                : FontStyle.italic,
          ),
        ),
      );
    }
  }

  Widget _buildHrNotes(String notes) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.info.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.lock_outline, size: 13, color: AppColors.info),
              SizedBox(width: 4),
              Text(
                'Confidential – HR Only',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: AppColors.info,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            notes,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const _Badge({required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  final String label;
  final double? score;

  const _ScoreCard({required this.label, this.score});

  @override
  Widget build(BuildContext context) {
    final hasScore = score != null;
    final progress = hasScore ? (score! / 10.0).clamp(0.0, 1.0) : 0.0;
    final scoreColor = hasScore
        ? (score! >= 8
            ? AppColors.success
            : score! >= 6
                ? AppColors.primary
                : score! >= 4
                    ? const Color(0xFFF59E0B)
                    : AppColors.danger)
        : AppColors.textMuted;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                hasScore ? score!.toStringAsFixed(1) : 'N/A',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: scoreColor,
                ),
              ),
              Text(
                hasScore ? '/ 10' : '',
                style: const TextStyle(
                    fontSize: 10, color: AppColors.textMuted),
              ),
            ],
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: AppColors.border,
              color: scoreColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MetricTile({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 9, color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}
