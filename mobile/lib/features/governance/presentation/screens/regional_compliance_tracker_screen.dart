import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class RegionalComplianceTrackerScreen extends ConsumerStatefulWidget {
  const RegionalComplianceTrackerScreen({super.key});

  @override
  ConsumerState<RegionalComplianceTrackerScreen> createState() =>
      _RegionalComplianceTrackerScreenState();
}

class _RegionalComplianceTrackerScreenState
    extends ConsumerState<RegionalComplianceTrackerScreen> {
  bool _loading = true;
  String? _error;
  String _view = 'Resolutions';
  List<Map<String, dynamic>> _resolutions = [];

  static const _views = ['Resolutions', 'Committees', 'Audit'];

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
      final res = await dio.get<Map<String, dynamic>>(
        '/governance/resolutions',
        queryParameters: {'per_page': 100},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>? ?? const [];
      setState(() {
        _resolutions = data
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load governance compliance data.';
        _loading = false;
      });
    }
  }

  String _statusLabel(String? status) {
    final value = (status ?? '').trim();
    if (value.isEmpty) return 'Pending';
    return value
        .replaceAll('_', ' ')
        .split(' ')
        .map(
          (word) => word.isEmpty
              ? word
              : '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}',
        )
        .join(' ');
  }

  double _statusScore(String? status) {
    switch ((status ?? '').toLowerCase().replaceAll(' ', '_')) {
      case 'implemented':
        return 1;
      case 'actioned':
        return 0.9;
      case 'adopted':
        return 0.8;
      case 'in_progress':
        return 0.55;
      case 'pending_review':
        return 0.35;
      case 'draft':
        return 0.15;
      case 'rejected':
        return 0;
      default:
        return 0.2;
    }
  }

  Color _statusColor(String? status) {
    final score = _statusScore(status);
    if (score >= 0.8) return AppColors.success;
    if (score >= 0.5) return AppColors.primary;
    if (score >= 0.25) return AppColors.warning;
    return AppColors.danger;
  }

  List<_CommitteeSnapshot> _committeeSnapshots() {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final resolution in _resolutions) {
      final committee = (resolution['committee']?.toString() ?? '').trim();
      final type = (resolution['type']?.toString() ?? '').trim();
      final key = committee.isNotEmpty
          ? committee
          : (type.isNotEmpty ? type : 'Unassigned');
      grouped.putIfAbsent(key, () => []).add(resolution);
    }

    final snapshots = grouped.entries.map((entry) {
      final values = entry.value;
      final average = values.isEmpty
          ? 0.0
          : values.fold<double>(
                0,
                (sum, item) => sum + _statusScore(item['status']?.toString()),
              ) /
              values.length;
      final implemented = values.where((item) {
        return _statusScore(item['status']?.toString()) >= 0.8;
      }).length;
      return _CommitteeSnapshot(
        name: entry.key,
        total: values.length,
        implemented: implemented,
        score: average,
      );
    }).toList();

    snapshots.sort((a, b) => b.score.compareTo(a.score));
    return snapshots;
  }

  List<_AuditMetric> _auditMetrics() {
    final total = _resolutions.length;
    if (total == 0) {
      return const [];
    }

    int count(bool Function(Map<String, dynamic> item) test) {
      return _resolutions.where(test).length;
    }

    return [
      _AuditMetric(
        label: 'Reference assigned',
        complete: count(
          (item) => (item['reference_number']?.toString() ?? '').isNotEmpty,
        ),
        total: total,
      ),
      _AuditMetric(
        label: 'Adoption date captured',
        complete: count(
          (item) => (item['adopted_at']?.toString() ?? '').isNotEmpty,
        ),
        total: total,
      ),
      _AuditMetric(
        label: 'Lead member assigned',
        complete: count(
          (item) => (item['lead_member']?.toString() ?? '').isNotEmpty,
        ),
        total: total,
      ),
      _AuditMetric(
        label: 'Supporting documents uploaded',
        complete: count((item) {
          final docs = item['documents'];
          return docs is List && docs.isNotEmpty;
        }),
        total: total,
      ),
      _AuditMetric(
        label: 'Implementation started',
        complete: count(
          (item) => _statusScore(item['status']?.toString()) >= 0.5,
        ),
        total: total,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final score = _resolutions.isEmpty
        ? 0.0
        : _resolutions.fold<double>(
              0,
              (sum, item) => sum + _statusScore(item['status']?.toString()),
            ) /
            _resolutions.length;
    final implemented = _resolutions.where((item) {
      return _statusScore(item['status']?.toString()) >= 0.8;
    }).length;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        title: const Text(
          'Regional Compliance',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
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
              ? _ComplianceError(message: _error!, onRetry: _load)
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            _statusColor('in_progress').withValues(alpha: 0.12),
                            AppColors.bgSurface,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Governance compliance score',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 11,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${(score * 100).round()}%',
                                  style: TextStyle(
                                    color: _statusColor('implemented'),
                                    fontSize: 32,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                Text(
                                  '${_resolutions.length} tracked resolutions, $implemented advanced or complete',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(
                            width: 74,
                            height: 74,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                CircularProgressIndicator(
                                  value: score,
                                  strokeWidth: 7,
                                  backgroundColor: AppColors.bgCard,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    _statusColor(_scoreStatus(score)),
                                  ),
                                ),
                                Text(
                                  '${(score * 100).round()}',
                                  style: TextStyle(
                                    color: _statusColor(_scoreStatus(score)),
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 38,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _views.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, index) {
                          final label = _views[index];
                          final active = label == _view;
                          return GestureDetector(
                            onTap: () => setState(() => _view = label),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: active
                                    ? AppColors.primary
                                    : AppColors.bgSurface,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: active
                                      ? AppColors.primary
                                      : AppColors.border,
                                ),
                              ),
                              child: Text(
                                label,
                                style: TextStyle(
                                  color: active
                                      ? AppColors.bgDark
                                      : AppColors.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (_view == 'Resolutions') _buildResolutionsView(),
                    if (_view == 'Committees') _buildCommitteeView(),
                    if (_view == 'Audit') _buildAuditView(),
                  ],
                ),
    );
  }

  String _scoreStatus(double score) {
    if (score >= 0.8) return 'implemented';
    if (score >= 0.5) return 'in_progress';
    if (score >= 0.25) return 'pending_review';
    return 'rejected';
  }

  Widget _buildResolutionsView() {
    if (_resolutions.isEmpty) {
      return const _ComplianceEmpty(
        title: 'No resolutions found.',
        subtitle:
            'Create or import governance resolutions to track compliance.',
      );
    }

    return Column(
      children: _resolutions.map((resolution) {
        final status = resolution['status']?.toString();
        final color = _statusColor(status);
        final committee = (resolution['committee']?.toString() ?? '').trim();
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      resolution['reference_number']?.toString() ??
                          'Resolution',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _statusLabel(status),
                      style: TextStyle(
                        color: color,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                resolution['title']?.toString() ?? 'Untitled resolution',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _statusScore(status),
                  minHeight: 6,
                  backgroundColor: AppColors.bgCard,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    committee.isEmpty ? 'Unassigned committee' : committee,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    AppDateFormatter.short(
                      resolution['adopted_at']?.toString(),
                    ),
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
    );
  }

  Widget _buildCommitteeView() {
    final committees = _committeeSnapshots();
    if (committees.isEmpty) {
      return const _ComplianceEmpty(
        title: 'No committee data found.',
        subtitle: 'Committee coverage will appear once resolutions are tagged.',
      );
    }

    return Column(
      children: committees.map((committee) {
        final color = _statusColor(_scoreStatus(committee.score));
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
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
                committee.name,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _CommitteePill(
                    label: 'Tracked',
                    value: '${committee.total}',
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  _CommitteePill(
                    label: 'Advanced',
                    value: '${committee.implemented}',
                    color: AppColors.success,
                  ),
                  const SizedBox(width: 8),
                  _CommitteePill(
                    label: 'Score',
                    value: '${(committee.score * 100).round()}%',
                    color: color,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: committee.score,
                  minHeight: 6,
                  backgroundColor: AppColors.bgCard,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAuditView() {
    final metrics = _auditMetrics();
    if (metrics.isEmpty) {
      return const _ComplianceEmpty(
        title: 'No audit checks available.',
        subtitle: 'Audit completeness appears when governance records exist.',
      );
    }

    return Column(
      children: metrics.map((metric) {
        final ratio = metric.total == 0 ? 0.0 : metric.complete / metric.total;
        final color = _statusColor(_scoreStatus(ratio));
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      metric.label,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    '${metric.complete}/${metric.total}',
                    style: TextStyle(
                      color: color,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 6,
                  backgroundColor: AppColors.bgCard,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${(ratio * 100).round()}% complete',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _CommitteeSnapshot {
  const _CommitteeSnapshot({
    required this.name,
    required this.total,
    required this.implemented,
    required this.score,
  });

  final String name;
  final int total;
  final int implemented;
  final double score;
}

class _AuditMetric {
  const _AuditMetric({
    required this.label,
    required this.complete,
    required this.total,
  });

  final String label;
  final int complete;
  final int total;
}

class _CommitteePill extends StatelessWidget {
  const _CommitteePill({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 9,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ComplianceError extends StatelessWidget {
  const _ComplianceError({required this.message, required this.onRetry});

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

class _ComplianceEmpty extends StatelessWidget {
  const _ComplianceEmpty({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.fact_check_outlined,
            size: 48,
            color: AppColors.textMuted,
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 13,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
