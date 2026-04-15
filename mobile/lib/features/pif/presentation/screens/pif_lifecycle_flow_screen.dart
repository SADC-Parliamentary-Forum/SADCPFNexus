import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

class PifLifecycleFlowScreen extends ConsumerStatefulWidget {
  const PifLifecycleFlowScreen({super.key, this.programmeId});

  final String? programmeId;

  @override
  ConsumerState<PifLifecycleFlowScreen> createState() =>
      _PifLifecycleFlowScreenState();
}

class _PifLifecycleFlowScreenState
    extends ConsumerState<PifLifecycleFlowScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _programme;
  List<Map<String, dynamic>> _imprests = [];
  List<Map<String, dynamic>> _procurementRequests = [];

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
      final programme = await _loadProgramme(dio);
      if (!mounted) return;

      if (programme == null) {
        setState(() {
          _programme = null;
          _imprests = [];
          _procurementRequests = [];
          _loading = false;
        });
        return;
      }

      final results = await Future.wait([
        dio.get<dynamic>(
          '/imprest/requests',
          queryParameters: {'per_page': 100},
        ),
        dio.get<dynamic>(
          '/procurement/requests',
          queryParameters: {'per_page': 100},
        ),
      ]);

      final imprests = _readDataList(results[0].data)
          .where((item) => _isRelatedImprest(item, programme))
          .toList();
      final procurement = _readDataList(results[1].data)
          .where((item) => _isRelatedProcurement(item, programme))
          .toList();

      if (!mounted) return;
      setState(() {
        _programme = programme;
        _imprests = imprests;
        _procurementRequests = procurement;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load the programme lifecycle.';
        _loading = false;
      });
    }
  }

  Future<Map<String, dynamic>?> _loadProgramme(dynamic dio) async {
    final programmeId = widget.programmeId;
    if (programmeId != null && programmeId.isNotEmpty) {
      final res =
          await dio.get<Map<String, dynamic>>('/programmes/$programmeId');
      final data = res.data;
      return data == null ? null : Map<String, dynamic>.from(data as Map);
    }

    final res = await dio.get<dynamic>(
      '/programmes',
      queryParameters: {'per_page': 20},
    );
    final list = _readDataList(res.data);
    if (list.isEmpty) return null;

    for (final item in list) {
      final status = (item['status'] ?? '').toString().toLowerCase();
      if (status == 'approved' || status == 'submitted') {
        return item;
      }
    }

    return list.first;
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

  bool _isRelatedImprest(
    Map<String, dynamic> imprest,
    Map<String, dynamic> programme,
  ) {
    final ref = programme['reference_number']?.toString() ?? '';
    final title = programme['title']?.toString() ?? '';
    final budgetLine = imprest['budget_line']?.toString() ?? '';
    final purpose = imprest['purpose']?.toString() ?? '';
    return _matchesText(budgetLine, ref, title) ||
        _matchesText(purpose, ref, title);
  }

  bool _isRelatedProcurement(
    Map<String, dynamic> procurement,
    Map<String, dynamic> programme,
  ) {
    final ref = programme['reference_number']?.toString() ?? '';
    final title = programme['title']?.toString() ?? '';
    final budgetLine = procurement['budget_line']?.toString() ?? '';
    final requestTitle = procurement['title']?.toString() ?? '';
    final description = procurement['description']?.toString() ?? '';
    final justification = procurement['justification']?.toString() ?? '';

    return _matchesText(budgetLine, ref, title) ||
        _matchesText(requestTitle, ref, title) ||
        _matchesText(description, ref, title) ||
        _matchesText(justification, ref, title);
  }

  bool _matchesText(String haystack, String ref, String title) {
    final text = haystack.toLowerCase();
    final refText = ref.toLowerCase();
    final titleText = title.toLowerCase();
    return (refText.isNotEmpty && text.contains(refText)) ||
        (titleText.isNotEmpty && text.contains(titleText));
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? 0;
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
      case 'implemented':
      case 'liquidated':
      case 'completed':
        return AppColors.success;
      case 'submitted':
      case 'in_progress':
      case 'processing':
        return AppColors.primary;
      case 'rejected':
      case 'cancelled':
        return AppColors.danger;
      default:
        return AppColors.warning;
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

  double _programmeProgress(Map<String, dynamic> programme) {
    final status = programme['status']?.toString().toLowerCase();
    switch (status) {
      case 'approved':
        return 1;
      case 'submitted':
        return 0.75;
      case 'rejected':
        return 0.15;
      default:
        return 0.35;
    }
  }

  double _deliveryProgress(Map<String, dynamic> programme) {
    final milestones = (programme['milestones'] as List<dynamic>? ?? const []);
    if (milestones.isEmpty) {
      final activities =
          (programme['activities'] as List<dynamic>? ?? const []);
      return activities.isEmpty ? 0.1 : 0.35;
    }

    final total = milestones.length;
    final completion = milestones.fold<double>(0, (sum, item) {
      if (item is! Map) return sum;
      final milestone = Map<String, dynamic>.from(item);
      final pct = _asDouble(milestone['completion_pct']);
      final status = milestone['status']?.toString().toLowerCase();
      if (status == 'completed' || pct >= 100) return sum + 1;
      if (pct > 0) return sum + (pct / 100);
      return sum;
    });

    return (completion / total).clamp(0.0, 1.0);
  }

  double _budgetProgress(Map<String, dynamic> programme) {
    final budgetLines =
        (programme['budget_lines'] as List<dynamic>? ?? const []);
    final procurementItems =
        (programme['procurement_items'] as List<dynamic>? ?? const []);
    if (budgetLines.isEmpty &&
        procurementItems.isEmpty &&
        _procurementRequests.isEmpty) {
      return 0.1;
    }

    var progress = budgetLines.isNotEmpty ? 0.45 : 0.2;
    if (procurementItems.isNotEmpty) {
      progress += 0.25;
    }
    if (_procurementRequests.isNotEmpty) {
      progress += 0.3;
    }

    return progress.clamp(0.0, 1.0);
  }

  double _disbursementProgress(Map<String, dynamic> programme) {
    if (_imprests.isEmpty) {
      final travelRequired = programme['travel_required'] == true;
      return travelRequired ? 0.15 : 0.0;
    }

    final best = _imprests.fold<double>(0, (current, item) {
      final status = item['status']?.toString().toLowerCase();
      final value = switch (status) {
        'liquidated' => 1.0,
        'approved' => 0.85,
        'submitted' => 0.55,
        'draft' => 0.25,
        _ => 0.2,
      };
      return value > current ? value : current;
    });

    return best;
  }

  double _closureProgress(Map<String, dynamic> programme) {
    final delivery = _deliveryProgress(programme);
    final disbursement = _disbursementProgress(programme);
    final status = programme['status']?.toString().toLowerCase();
    if (_imprests.any(
      (item) => item['status']?.toString().toLowerCase() == 'liquidated',
    )) {
      return 1;
    }
    if (delivery >= 1 && status == 'approved') {
      return 0.8;
    }
    if (disbursement >= 0.85) {
      return 0.65;
    }
    return 0.15;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        title: const Text(
          'Programme Lifecycle',
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
              ? _ErrorState(message: _error!, onRetry: _load)
              : _programme == null
                  ? const _EmptyState(
                      title: 'No programmes found.',
                      subtitle:
                          'Create and submit a PIF to track its lifecycle.',
                    )
                  : _buildBody(_programme!),
    );
  }

  Widget _buildBody(Map<String, dynamic> programme) {
    final budgetLines =
        (programme['budget_lines'] as List<dynamic>? ?? const []);
    final milestones = (programme['milestones'] as List<dynamic>? ?? const []);
    final activities = (programme['activities'] as List<dynamic>? ?? const []);
    final deliverables =
        (programme['deliverables'] as List<dynamic>? ?? const []);
    final totalBudget = _asDouble(programme['total_budget']);
    final budgetLineTotal = budgetLines.fold<double>(0, (sum, item) {
      if (item is! Map) return sum;
      return sum + _asDouble(item['amount']);
    });
    final rawStatus = programme['status']?.toString();
    final status = _statusLabel(rawStatus);
    final statusColor = _statusColor(rawStatus);
    final period = AppDateFormatter.range(
      programme['start_date']?.toString(),
      programme['end_date']?.toString(),
    );
    final memberStates =
        (programme['member_states'] as List<dynamic>? ?? const []).join(', ');

    final steps = [
      _LifecycleStep(
        title: 'Programme Governance',
        subtitle: status,
        details:
            'Reference ${programme['reference_number'] ?? programme['id']}',
        progress: _programmeProgress(programme),
        color: statusColor,
        countLabel: memberStates.isEmpty ? 'No states' : memberStates,
      ),
      _LifecycleStep(
        title: 'Activities and Milestones',
        subtitle:
            '${activities.length} activities, ${milestones.length} milestones',
        details: '${deliverables.length} deliverables defined',
        progress: _deliveryProgress(programme),
        color: AppColors.primary,
        countLabel: milestones.isEmpty
            ? 'No milestones recorded'
            : '${milestones.where((item) {
                if (item is! Map) return false;
                final map = Map<String, dynamic>.from(item);
                return _asDouble(map['completion_pct']) >= 100;
              }).length}/${milestones.length} complete',
      ),
      _LifecycleStep(
        title: 'Budget and Procurement',
        subtitle:
            '${budgetLines.length} budget lines, ${_procurementRequests.length} live requests',
        details:
            '${programme['procurement_items'] is List ? (programme['procurement_items'] as List).length : 0} procurement items in PIF',
        progress: _budgetProgress(programme),
        color: AppColors.info,
        countLabel:
            '${programme['primary_currency'] ?? 'NAD'} ${budgetLineTotal.toStringAsFixed(2)}',
      ),
      _LifecycleStep(
        title: 'Travel and Disbursement',
        subtitle: _imprests.isEmpty
            ? 'No imprest linked yet'
            : '${_imprests.length} imprest request(s)',
        details: programme['travel_required'] == true
            ? 'Travel flagged in programme setup'
            : 'Travel not required on this programme',
        progress: _disbursementProgress(programme),
        color: AppColors.warning,
        countLabel: '${_asInt(programme['delegates_count'])} delegates',
      ),
      _LifecycleStep(
        title: 'Closure and Retirement',
        subtitle: _imprests.any(
          (item) => item['status']?.toString().toLowerCase() == 'liquidated',
        )
            ? 'Liquidation completed'
            : 'Awaiting retirement evidence',
        details: _imprests.isEmpty
            ? 'Closure depends on milestone completion and supporting evidence.'
            : 'Track liquidation to complete the financial chain.',
        progress: _closureProgress(programme),
        color: AppColors.success,
        countLabel: '${_imprests.where((item) {
          return item['status']?.toString().toLowerCase() == 'liquidated';
        }).length} retired',
      ),
    ];

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        status,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      programme['reference_number']?.toString() ??
                          'Programme ${programme['id']}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  programme['title']?.toString() ?? 'Programme',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  programme['overall_objective']?.toString() ??
                      programme['background']?.toString() ??
                      'No programme summary available.',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _InfoChip(
                      icon: Icons.calendar_today_outlined,
                      label: period,
                    ),
                    _InfoChip(
                      icon: Icons.account_balance_wallet_outlined,
                      label:
                          '${programme['primary_currency'] ?? 'NAD'} ${totalBudget.toStringAsFixed(2)}',
                    ),
                    if (memberStates.isNotEmpty)
                      _InfoChip(
                        icon: Icons.public_outlined,
                        label: memberStates,
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.push(
                      '/pif/lifecycle-review?id=${programme['id']}',
                    ),
                    icon: const Icon(Icons.insights_outlined),
                    label: const Text('Open lifecycle review'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'FLOW',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 10),
          ...steps.asMap().entries.map((entry) {
            return _StepCard(
              stepNumber: entry.key + 1,
              step: entry.value,
              isLast: entry.key == steps.length - 1,
            );
          }),
        ],
      ),
    );
  }
}

class _LifecycleStep {
  const _LifecycleStep({
    required this.title,
    required this.subtitle,
    required this.details,
    required this.progress,
    required this.color,
    required this.countLabel,
  });

  final String title;
  final String subtitle;
  final String details;
  final double progress;
  final Color color;
  final String countLabel;
}

class _StepCard extends StatelessWidget {
  const _StepCard({
    required this.stepNumber,
    required this.step,
    required this.isLast,
  });

  final int stepNumber;
  final _LifecycleStep step;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final progress = step.progress.clamp(0.0, 1.0);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: step.color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: step.color.withValues(alpha: 0.4)),
              ),
              child: Center(
                child: Text(
                  '$stepNumber',
                  style: TextStyle(
                    color: step.color,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 46,
                color: AppColors.border,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            margin: EdgeInsets.only(bottom: isLast ? 0 : 12),
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
                        step.title,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: step.color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${(progress * 100).round()}%',
                        style: TextStyle(
                          color: step.color,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  step.subtitle,
                  style: TextStyle(
                    color: step.color,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  step.details,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: AppColors.bgCard,
                    valueColor: AlwaysStoppedAnimation<Color>(step.color),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  step.countLabel,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

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

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.account_tree_outlined,
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
      ),
    );
  }
}
