import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class HrGovernanceDashboardScreen extends ConsumerStatefulWidget {
  const HrGovernanceDashboardScreen({super.key});

  @override
  ConsumerState<HrGovernanceDashboardScreen> createState() =>
      _HrGovernanceDashboardScreenState();
}

class _HrGovernanceDashboardScreenState
    extends ConsumerState<HrGovernanceDashboardScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _files = [];
  List<Map<String, dynamic>> _conductRecords = [];
  Map<String, dynamic> _assignmentStats = {};
  Map<String, dynamic> _performanceOverview = {};
  Map<String, dynamic> _summary = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        _safeListRequest(
          () => dio.get<dynamic>(
            '/hr/files',
            queryParameters: {'per_page': 100},
          ),
        ),
        _safeListRequest(
          () => dio.get<dynamic>(
            '/hr/conduct',
            queryParameters: {'per_page': 100},
          ),
        ),
        _safeMapRequest(() => dio.get<dynamic>('/hr/assignments/stats')),
        _safeMapRequest(() => dio.get<dynamic>('/hr/performance/overview')),
        _safeMapRequest(() => dio.get<dynamic>('/hr/summary')),
      ]);

      final files = results[0] as List<Map<String, dynamic>>?;
      final conductRecords = results[1] as List<Map<String, dynamic>>?;
      final assignmentStats = results[2] as Map<String, dynamic>?;
      final performanceOverview = results[3] as Map<String, dynamic>?;
      final summary = results[4] as Map<String, dynamic>?;

      final hasAnyData = files != null ||
          conductRecords != null ||
          assignmentStats != null ||
          performanceOverview != null ||
          summary != null;

      if (!hasAnyData) {
        throw StateError('No HR governance data available.');
      }

      if (!mounted) return;
      setState(() {
        _files = files ?? [];
        _conductRecords = conductRecords ?? [];
        _assignmentStats = assignmentStats ?? {};
        _performanceOverview = performanceOverview ?? {};
        _summary = summary ?? {};
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load the HR governance dashboard.';
        _loading = false;
      });
    }
  }

  Future<List<Map<String, dynamic>>?> _safeListRequest(
    Future<dynamic> Function() request,
  ) async {
    try {
      final res = await request();
      return _readDataList(res.data);
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> _safeMapRequest(
    Future<dynamic> Function() request,
  ) async {
    try {
      final res = await request();
      final data = res.data;
      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  List<Map<String, dynamic>> _readDataList(dynamic data) {
    if (data is Map && data['data'] is List) {
      return (data['data'] as List<dynamic>)
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? 0;
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  DateTime? _asDate(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }

  String _labelize(String? value) {
    final input = (value ?? '').trim();
    if (input.isEmpty) return 'Unknown';
    return input
        .replaceAll('_', ' ')
        .split(' ')
        .map(
          (word) => word.isEmpty
              ? word
              : '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}',
        )
        .join(' ');
  }

  Color _statusColor(String? value) {
    switch ((value ?? '').toLowerCase()) {
      case 'excellent':
      case 'strong':
      case 'satisfactory':
      case 'confirmed':
      case 'active':
      case 'completed':
      case 'resolved':
      case 'closed':
        return AppColors.success;
      case 'watchlist':
      case 'probation':
      case 'on_probation':
      case 'under_appeal':
      case 'acknowledged':
      case 'in_progress':
        return AppColors.warning;
      case 'critical_review_required':
      case 'at_risk':
      case 'suspended':
      case 'dismissal':
      case 'open':
        return AppColors.danger;
      default:
        return AppColors.primary;
    }
  }

  int _countEmploymentStatus(String status) {
    return _files.where((item) {
      return item['employment_status']?.toString().toLowerCase() == status;
    }).length;
  }

  List<_ExpiryItem> _expiringContracts() {
    final now = DateTime.now();
    final cutoff = now.add(const Duration(days: 90));
    final items = _files
        .map((item) {
          final expiry = _asDate(item['contract_expiry_date']);
          if (expiry == null) return null;
          if (expiry.isBefore(DateTime(now.year, now.month, now.day))) {
            return _ExpiryItem(
              name: _employeeName(item),
              role: item['current_position']?.toString() ??
                  item['department']?['name']?.toString() ??
                  'No role recorded',
              date: expiry,
              daysLeft: expiry.difference(now).inDays,
            );
          }
          if (expiry.isAfter(cutoff)) return null;
          return _ExpiryItem(
            name: _employeeName(item),
            role: item['current_position']?.toString() ??
                item['department']?['name']?.toString() ??
                'No role recorded',
            date: expiry,
            daysLeft: expiry.difference(now).inDays,
          );
        })
        .whereType<_ExpiryItem>()
        .toList();

    items.sort((a, b) => a.daysLeft.compareTo(b.daysLeft));
    return items;
  }

  String _employeeName(Map<String, dynamic> item) {
    final employee = item['employee'];
    if (employee is Map && (employee['name']?.toString() ?? '').isNotEmpty) {
      return employee['name'].toString();
    }
    return item['staff_number']?.toString() ?? 'Employee';
  }

  Map<String, dynamic> _statusCounts() {
    final counts = _performanceOverview['status_counts'];
    if (counts is Map) {
      return Map<String, dynamic>.from(counts);
    }
    return {};
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        title: const Text(
          'HR Governance',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? _DashboardError(message: _error!, onRetry: _load)
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final activeFiles = _files.where((item) {
      final fileStatus = item['file_status']?.toString().toLowerCase();
      return fileStatus == null || fileStatus.isEmpty || fileStatus == 'active';
    }).length;
    final warningFlags =
        _files.where((item) => item['active_warning_flag'] == true).length;
    final expiringContracts = _expiringContracts();
    final openConduct = _conductRecords.where((item) {
      final status = item['status']?.toString().toLowerCase();
      return status != 'resolved' && status != 'closed';
    }).length;

    final statusCounts = _statusCounts();
    final healthyPerformance = _asInt(statusCounts['excellent']) +
        _asInt(statusCounts['strong']) +
        _asInt(statusCounts['satisfactory']);
    final watchlist = _asInt(statusCounts['watchlist']) +
        _asInt(statusCounts['at_risk']) +
        _asInt(statusCounts['critical_review_required']);
    final attentionRequired =
        (_performanceOverview['attention_required'] as List<dynamic>? ??
                const [])
            .length;

    final assignmentsTotal = _asInt(_assignmentStats['total']);
    final assignmentsOverdue = _asInt(_assignmentStats['overdue']);
    final onTrackRate = assignmentsTotal == 0
        ? 1.0
        : ((assignmentsTotal - assignmentsOverdue) / assignmentsTotal)
            .clamp(0.0, 1.0);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.16),
                  AppColors.bgSurface,
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Live HR oversight snapshot',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '$activeFiles active personnel files, $openConduct open conduct record(s), ${expiringContracts.length} contract(s) expiring within 90 days.',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _TopStatCard(
                        label: 'Tracked Files',
                        value: '${_files.length}',
                        badge: '$activeFiles active',
                        badgeColor: AppColors.success,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _TopStatCard(
                        label: 'Attention Flags',
                        value:
                            '${warningFlags + openConduct + attentionRequired}',
                        badge: '$warningFlags warning flag(s)',
                        badgeColor: AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _Panel(
            title: 'Employment Posture',
            child: Column(
              children: [
                _MetricBarRow(
                  label: 'Permanent',
                  current: _countEmploymentStatus('permanent'),
                  total: _files.length,
                  color: AppColors.success,
                ),
                _MetricBarRow(
                  label: 'Contract',
                  current: _countEmploymentStatus('contract'),
                  total: _files.length,
                  color: AppColors.primary,
                ),
                _MetricBarRow(
                  label: 'Probation',
                  current: _countEmploymentStatus('probation'),
                  total: _files.length,
                  color: AppColors.warning,
                ),
                _MetricBarRow(
                  label: 'Separated',
                  current: _countEmploymentStatus('separated'),
                  total: _files.length,
                  color: AppColors.danger,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Panel(
            title: 'Assignment Oversight',
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
              child: Row(
                children: [
                  SizedBox(
                    width: 92,
                    height: 92,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CircularProgressIndicator(
                          value: onTrackRate,
                          strokeWidth: 8,
                          backgroundColor: AppColors.bgCard,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            onTrackRate >= 0.8
                                ? AppColors.success
                                : onTrackRate >= 0.5
                                    ? AppColors.warning
                                    : AppColors.danger,
                          ),
                        ),
                        Text(
                          '${(onTrackRate * 100).round()}%',
                          style: TextStyle(
                            color: onTrackRate >= 0.8
                                ? AppColors.success
                                : onTrackRate >= 0.5
                                    ? AppColors.warning
                                    : AppColors.danger,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 18),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _InfoLine(
                          label: 'Total assignments',
                          value: '${_asInt(_assignmentStats['total'])}',
                        ),
                        _InfoLine(
                          label: 'Overdue',
                          value: '${_asInt(_assignmentStats['overdue'])}',
                        ),
                        _InfoLine(
                          label: 'My assignments',
                          value:
                              '${_asInt(_assignmentStats['my_assignments'])}',
                        ),
                        if (_assignmentStats['team'] is Map)
                          _InfoLine(
                            label: 'Team completed',
                            value:
                                '${_asInt((_assignmentStats['team'] as Map)['completed'])}',
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _performanceOverview.isNotEmpty
              ? _Panel(
                  title: 'Performance Oversight',
                  child: Column(
                    children: [
                      _MetricBarRow(
                        label: 'Healthy cycles',
                        current: healthyPerformance,
                        total: healthyPerformance + watchlist,
                        color: AppColors.success,
                      ),
                      _MetricBarRow(
                        label: 'Watchlist and risk',
                        current: watchlist,
                        total: healthyPerformance + watchlist,
                        color: AppColors.warning,
                      ),
                      _MetricBarRow(
                        label: 'HR attention required',
                        current: attentionRequired,
                        total: healthyPerformance + watchlist,
                        color: AppColors.danger,
                      ),
                      if ((_performanceOverview['watchlist']
                                  as List<dynamic>? ??
                              const [])
                          .isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ...(_performanceOverview['watchlist'] as List<dynamic>)
                            .take(3)
                            .whereType<Map>()
                            .map((item) {
                          final tracker = Map<String, dynamic>.from(item);
                          final employee = tracker['employee'];
                          final employeeName = employee is Map
                              ? employee['name']?.toString() ?? 'Employee'
                              : 'Employee';
                          final status = tracker['status']?.toString();
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    employeeName,
                                    style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                Text(
                                  _labelize(status),
                                  style: TextStyle(
                                    color: _statusColor(status),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ],
                  ),
                )
              : _Panel(
                  title: 'Workload Snapshot',
                  child: Column(
                    children: [
                      _InfoLine(
                        label: 'Hours this month',
                        value: _asDouble(_summary['hours_this_month'])
                            .toStringAsFixed(1),
                      ),
                      _InfoLine(
                        label: 'Overtime MTD',
                        value: _asDouble(_summary['overtime_mtd'])
                            .toStringAsFixed(1),
                      ),
                      _InfoLine(
                        label: 'Annual leave left',
                        value: '${_asInt(_summary['annual_leave_left'])} days',
                      ),
                      _InfoLine(
                        label: 'LIL hours available',
                        value: _asDouble(_summary['lil_hours_available'])
                            .toStringAsFixed(1),
                      ),
                    ],
                  ),
                ),
          const SizedBox(height: 12),
          _Panel(
            title: 'Conduct and Warning Signals',
            child: Column(
              children: [
                _MetricBarRow(
                  label: 'Open conduct cases',
                  current: openConduct,
                  total: _conductRecords.length,
                  color: AppColors.danger,
                ),
                _MetricBarRow(
                  label: 'Resolved or closed',
                  current: _conductRecords.length - openConduct,
                  total: _conductRecords.length,
                  color: AppColors.success,
                ),
                _MetricBarRow(
                  label: 'Active warning flags',
                  current: warningFlags,
                  total: _files.length,
                  color: AppColors.warning,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Panel(
            title: 'Contract Expiry Pipeline',
            child: expiringContracts.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: Text(
                      'No contract expiries recorded in the next 90 days.',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  )
                : Column(
                    children: expiringContracts.take(5).map((item) {
                      final expired = item.daysLeft < 0;
                      final color =
                          expired ? AppColors.danger : AppColors.warning;
                      final label = expired
                          ? 'Expired ${item.daysLeft.abs()} day(s) ago'
                          : '${item.daysLeft} day(s) left';
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    item.role,
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  label,
                                  style: TextStyle(
                                    color: color,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  AppDateFormatter.short(
                                      item.date.toIso8601String()),
                                  style: const TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ExpiryItem {
  const _ExpiryItem({
    required this.name,
    required this.role,
    required this.date,
    required this.daysLeft,
  });

  final String name;
  final String role;
  final DateTime date;
  final int daysLeft;
}

class _TopStatCard extends StatelessWidget {
  const _TopStatCard({
    required this.label,
    required this.value,
    required this.badge,
    required this.badgeColor,
  });

  final String label;
  final String value;
  final String badge;
  final Color badgeColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: badgeColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              badge,
              style: TextStyle(
                color: badgeColor,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Text(
              title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _MetricBarRow extends StatelessWidget {
  const _MetricBarRow({
    required this.label,
    required this.current,
    required this.total,
    required this.color,
  });

  final String label;
  final int current;
  final int total;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final safeTotal = total <= 0 ? (current <= 0 ? 1 : current) : total;
    final ratio = (current / safeTotal).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ),
              Text(
                '$current/$safeTotal',
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 7,
              backgroundColor: AppColors.bgCard,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardError extends StatelessWidget {
  const _DashboardError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 44, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(
              message,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
