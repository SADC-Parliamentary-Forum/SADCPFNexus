import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

class PifLifecycleReviewScreen extends ConsumerStatefulWidget {
  const PifLifecycleReviewScreen({super.key, this.programmeId});

  final String? programmeId;

  @override
  ConsumerState<PifLifecycleReviewScreen> createState() =>
      _PifLifecycleReviewScreenState();
}

class _PifLifecycleReviewScreenState
    extends ConsumerState<PifLifecycleReviewScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _programme;
  List<Map<String, dynamic>> _attachments = [];
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
          _attachments = [];
          _imprests = [];
          _procurementRequests = [];
          _loading = false;
        });
        return;
      }

      final results = await Future.wait([
        dio.get<Map<String, dynamic>>(
            '/programmes/${programme['id']}/attachments'),
        dio.get<dynamic>(
          '/imprest/requests',
          queryParameters: {'per_page': 100},
        ),
        dio.get<dynamic>(
          '/procurement/requests',
          queryParameters: {'per_page': 100},
        ),
      ]);

      final attachments = _readDataList(results[0].data);
      final imprests = _readDataList(results[1].data)
          .where((item) => _isRelatedImprest(item, programme))
          .toList();
      final procurement = _readDataList(results[2].data)
          .where((item) => _isRelatedProcurement(item, programme))
          .toList();

      if (!mounted) return;
      setState(() {
        _programme = programme;
        _attachments = attachments;
        _imprests = imprests;
        _procurementRequests = procurement;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load lifecycle review data.';
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

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
      case 'implemented':
      case 'completed':
      case 'liquidated':
        return AppColors.success;
      case 'submitted':
      case 'in_progress':
        return AppColors.primary;
      case 'rejected':
      case 'cancelled':
        return AppColors.danger;
      default:
        return AppColors.warning;
    }
  }

  int _countCompletedMilestones(List<dynamic> milestones) {
    return milestones.where((item) {
      if (item is! Map) return false;
      final map = Map<String, dynamic>.from(item);
      return _asDouble(map['completion_pct']) >= 100 ||
          map['status']?.toString().toLowerCase() == 'completed';
    }).length;
  }

  List<_CheckItem> _buildChecks(Map<String, dynamic> programme) {
    final milestones = (programme['milestones'] as List<dynamic>? ?? const []);
    final completedMilestones = _countCompletedMilestones(milestones);
    return [
      _CheckItem(
        label: 'Reference number assigned',
        passed: (programme['reference_number']?.toString() ?? '').isNotEmpty,
      ),
      _CheckItem(
        label: 'Submission or approval recorded',
        passed: (programme['submitted_at']?.toString() ?? '').isNotEmpty ||
            (programme['approved_at']?.toString() ?? '').isNotEmpty,
      ),
      _CheckItem(
        label: 'Budget lines captured',
        passed: (programme['budget_lines'] as List<dynamic>? ?? const [])
            .isNotEmpty,
      ),
      _CheckItem(
        label: 'Supporting attachments available',
        passed: _attachments.isNotEmpty,
      ),
      _CheckItem(
        label: 'Milestones started',
        passed: milestones.isNotEmpty && completedMilestones > 0,
      ),
      _CheckItem(
        label: 'Downstream finance records linked',
        passed: _imprests.isNotEmpty || _procurementRequests.isNotEmpty,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        title: const Text(
          'Lifecycle Review',
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
              ? _ReviewError(message: _error!, onRetry: _load)
              : _programme == null
                  ? const _ReviewEmpty()
                  : _buildBody(_programme!),
    );
  }

  Widget _buildBody(Map<String, dynamic> programme) {
    final status = _statusLabel(programme['status']?.toString());
    final statusColor = _statusColor(programme['status']?.toString());
    final activities = (programme['activities'] as List<dynamic>? ?? const []);
    final milestones = (programme['milestones'] as List<dynamic>? ?? const []);
    final deliverables =
        (programme['deliverables'] as List<dynamic>? ?? const []);
    final budgetLines =
        (programme['budget_lines'] as List<dynamic>? ?? const []);
    final procurementItems =
        (programme['procurement_items'] as List<dynamic>? ?? const []);
    final completedMilestones = _countCompletedMilestones(milestones);
    final totalBudget = _asDouble(programme['total_budget']);
    final checks = _buildChecks(programme);
    final checkPasses = checks.where((item) => item.passed).length;

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
                const SizedBox(height: 8),
                Text(
                  programme['overall_objective']?.toString() ??
                      programme['background']?.toString() ??
                      'No programme narrative available.',
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
                    _MetaPill(
                      icon: Icons.calendar_today_outlined,
                      label: AppDateFormatter.range(
                        programme['start_date']?.toString(),
                        programme['end_date']?.toString(),
                      ),
                    ),
                    _MetaPill(
                      icon: Icons.account_balance_wallet_outlined,
                      label:
                          '${programme['primary_currency'] ?? 'NAD'} ${totalBudget.toStringAsFixed(2)}',
                    ),
                    if (_attachments.isNotEmpty)
                      _MetaPill(
                        icon: Icons.attach_file,
                        label: '${_attachments.length} attachment(s)',
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _ReviewCard(
            title: 'Programme Snapshot',
            child: Column(
              children: [
                _ReviewRow(
                  label: 'Implementing department',
                  value:
                      programme['implementing_department']?.toString() ?? '-',
                ),
                _ReviewRow(
                  label: 'Responsible officer',
                  value: (programme['responsible_officer']?.toString() ?? '')
                          .isNotEmpty
                      ? programme['responsible_officer'].toString()
                      : (programme['responsible_officer_id']?.toString() ??
                          '-'),
                ),
                _ReviewRow(
                  label: 'Member states',
                  value:
                      (programme['member_states'] as List<dynamic>? ?? const [])
                              .join(', ')
                              .trim()
                              .isEmpty
                          ? '-'
                          : (programme['member_states'] as List<dynamic>)
                              .join(', '),
                ),
                _ReviewRow(
                  label: 'Approval recorded',
                  value: AppDateFormatter.short(
                    programme['approved_at']?.toString(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _ReviewCard(
            title: 'Delivery Ledger',
            child: Column(
              children: [
                _ReviewStatRow(
                  label: 'Activities',
                  value: '${activities.length}',
                  color: AppColors.primary,
                ),
                _ReviewStatRow(
                  label: 'Milestones',
                  value: '$completedMilestones/${milestones.length}',
                  color: AppColors.success,
                ),
                _ReviewStatRow(
                  label: 'Deliverables',
                  value: '${deliverables.length}',
                  color: AppColors.info,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _ReviewCard(
            title: 'Financial Chain',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ReviewStatRow(
                  label: 'Budget lines',
                  value: '${budgetLines.length}',
                  color: AppColors.primary,
                ),
                _ReviewStatRow(
                  label: 'Procurement items in programme',
                  value: '${procurementItems.length}',
                  color: AppColors.info,
                ),
                _ReviewStatRow(
                  label: 'Linked procurement requests',
                  value: '${_procurementRequests.length}',
                  color: AppColors.warning,
                ),
                _ReviewStatRow(
                  label: 'Linked imprest requests',
                  value: '${_imprests.length}',
                  color: AppColors.success,
                ),
                if (_imprests.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  ..._imprests.take(3).map((item) {
                    final statusText = _statusLabel(item['status']?.toString());
                    final color = _statusColor(item['status']?.toString());
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              item['reference_number']?.toString() ??
                                  'Imprest ${item['id']}',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          Text(
                            statusText,
                            style: TextStyle(
                              color: color,
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
          ),
          const SizedBox(height: 12),
          _ReviewCard(
            title: 'Supporting Evidence',
            child: _attachments.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: Text(
                      'No attachments uploaded yet.',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  )
                : Column(
                    children: _attachments.map((item) {
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.insert_drive_file_outlined,
                              size: 16,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item['original_filename']?.toString() ??
                                    'Attachment',
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Text(
                              AppDateFormatter.short(
                                item['created_at']?.toString(),
                              ),
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
          const SizedBox(height: 12),
          _ReviewCard(
            title: 'Governance Checks',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                  child: Text(
                    '$checkPasses of ${checks.length} checks satisfied',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ),
                ...checks.map((check) => Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                      child: Row(
                        children: [
                          Icon(
                            check.passed
                                ? Icons.check_circle
                                : Icons.radio_button_unchecked,
                            size: 16,
                            color: check.passed
                                ? AppColors.success
                                : AppColors.textMuted,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              check.label,
                              style: TextStyle(
                                color: check.passed
                                    ? AppColors.textPrimary
                                    : AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () =>
                  context.push('/pif/budget?id=${programme['id']}'),
              icon: const Icon(Icons.account_balance_outlined),
              label: const Text('Open budget commitment'),
            ),
          ),
        ],
      ),
    );
  }
}

class _CheckItem {
  const _CheckItem({required this.label, required this.passed});

  final String label;
  final bool passed;
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.title, required this.child});

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

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
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
          Flexible(
            child: Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewStatRow extends StatelessWidget {
  const _ReviewStatRow({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

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

class _ReviewError extends StatelessWidget {
  const _ReviewError({required this.message, required this.onRetry});

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

class _ReviewEmpty extends StatelessWidget {
  const _ReviewEmpty();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.fact_check_outlined,
              size: 48,
              color: AppColors.textMuted,
            ),
            SizedBox(height: 12),
            Text(
              'No programme available for lifecycle review.',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
