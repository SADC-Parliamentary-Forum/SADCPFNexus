import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

class LeaveRequestDetailScreen extends ConsumerStatefulWidget {
  const LeaveRequestDetailScreen({super.key, this.requestId});

  final String? requestId;

  @override
  ConsumerState<LeaveRequestDetailScreen> createState() =>
      _LeaveRequestDetailScreenState();
}

class _LeaveRequestDetailScreenState
    extends ConsumerState<LeaveRequestDetailScreen> {
  bool _loading = true;
  bool _cancelling = false;
  String? _error;
  Map<String, dynamic>? _request;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final requestId = widget.requestId;
    if (requestId == null || requestId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing request ID.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>('/leave/requests/$requestId');
      if (!mounted) return;
      setState(() {
        _request = res.data == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(res.data as Map);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load leave request.';
        _loading = false;
      });
    }
  }

  Future<void> _cancelLeave() async {
    final requestId = widget.requestId;
    if (requestId == null || requestId.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel leave request?'),
        content: const Text(
          'This will delete the request if it is still in draft status.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel Leave'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _cancelling = true);
    try {
      await ref.read(apiClientProvider).dio.delete('/leave/requests/$requestId');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request cancelled.'),
          backgroundColor: AppColors.success,
        ),
      );
      context.safePopOrGoHome();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Only draft leave requests can be cancelled.'),
          backgroundColor: AppColors.warning,
        ),
      );
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  String _statusLabel(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'draft':
        return 'Draft';
      case 'submitted':
        return 'Pending Approval';
      default:
        return status == null || status.isEmpty ? 'Unknown' : status;
    }
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
        return AppColors.danger;
      case 'draft':
        return AppColors.textMuted;
      default:
        return AppColors.warning;
    }
  }

  int _daysRequested(Map<String, dynamic> request) {
    final value = request['days_requested'];
    if (value is num) return value.round();
    return int.tryParse('$value') ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            size: 18,
            color: AppColors.textPrimary,
          ),
          onPressed: () => context.safePopOrGoHome(),
        ),
        title: const Text(
          'Leave Request',
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
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _buildContent(_request ?? const {}),
    );
  }

  Widget _buildContent(Map<String, dynamic> request) {
    final status = request['status']?.toString();
    final statusColor = _statusColor(status);
    final approvalHistory = _extractApprovalHistory(request);
    final annualBalance = request['requester'] is Map
        ? request['requester']['annual_leave_balance']
        : null;
    final daysRequested = _daysRequested(request);
    final remainingBalance = annualBalance is num
        ? (annualBalance.toDouble() - daysRequested).clamp(0, annualBalance.toDouble())
        : null;

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  statusColor.withValues(alpha: 0.1),
                  AppColors.bgSurface,
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _statusLabel(status),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Flexible(
                      child: Text(
                        'REF: ${request['reference_number'] ?? '-'}',
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                        ),
                        textAlign: TextAlign.end,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  request['reason']?.toString().isNotEmpty == true
                      ? request['reason'].toString()
                      : 'Leave Request',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (request['created_at'] != null)
                      'Submitted ${AppDateFormatter.short(request['created_at'].toString())}',
                    if (request['approved_at'] != null)
                      'Approved ${AppDateFormatter.short(request['approved_at'].toString())}',
                  ].join(' · '),
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _card(children: [
            _secHeader(
              'Leave Details',
              Icons.event_available_outlined,
              AppColors.success,
            ),
            _row('Leave Type', request['leave_type']?.toString() ?? '-'),
            _row(
              'Dates',
              request['start_date'] == null
                  ? '-'
                  : AppDateFormatter.range(
                      request['start_date'].toString(),
                      request['end_date']?.toString() ??
                          request['start_date'].toString(),
                    ),
            ),
            _row(
              'Duration',
              daysRequested > 0 ? '$daysRequested working days' : '-',
            ),
            _row('Reason', request['reason']?.toString() ?? '-'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),
          _card(children: [
            _secHeader(
              'Balance Impact',
              Icons.account_balance_outlined,
              AppColors.warning,
            ),
            _row(
              'Balance Before',
              annualBalance is num ? '${annualBalance.toString()} days' : '-',
            ),
            _row(
              'Days Requested',
              daysRequested > 0 ? '$daysRequested days' : '-',
            ),
            _row(
              'Balance After',
              remainingBalance is num
                  ? '${remainingBalance.toStringAsFixed(0)} days'
                  : '-',
            ),
            const SizedBox(height: 8),
          ]),
          if (approvalHistory.isNotEmpty) ...[
            const SizedBox(height: 12),
            _card(children: [
              _secHeader(
                'Approval Chain',
                Icons.account_tree_outlined,
                AppColors.primary,
              ),
              ...approvalHistory.asMap().entries.map(
                    (entry) => _approvalStep(
                      entry.value['label'] ?? 'Approval',
                      entry.value['user'] ?? '-',
                      entry.value['done'] == true,
                      entry.value['note'] ?? '',
                      entry.key == approvalHistory.length - 1,
                    ),
                  ),
            ]),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: _cancelling ? null : _cancelLeave,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: _cancelling
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.danger,
                      ),
                    )
                  : const Icon(Icons.cancel_outlined, size: 16),
              label: Text(
                _cancelling ? 'Cancelling...' : 'Cancel Leave',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _extractApprovalHistory(Map<String, dynamic> request) {
    final approvalRequest = request['approval_request'];
    if (approvalRequest is! Map) return [];

    final history = approvalRequest['history'] as List<dynamic>? ?? [];
    if (history.isNotEmpty) {
      return history
          .map((item) => item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{})
          .map(
            (item) => {
              'label': item['action']?.toString() ?? 'Action',
              'user': item['user'] is Map ? item['user']['name']?.toString() ?? '-' : '-',
              'done': true,
              'note': item['comment']?.toString() ??
                  (item['created_at'] != null
                      ? AppDateFormatter.short(item['created_at'].toString())
                      : ''),
            },
          )
          .toList();
    }

    final workflow = approvalRequest['workflow'];
    final steps = workflow is Map ? workflow['steps'] as List<dynamic>? ?? [] : [];
    return steps
        .map((item) => item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{})
        .map(
          (item) => {
            'label': item['name']?.toString() ?? item['role']?.toString() ?? 'Approval',
            'user': item['approver_name']?.toString() ?? '-',
            'done': false,
            'note': item['status']?.toString() ?? '',
          },
        )
        .toList();
  }

  Widget _card({required List<Widget> children}) => Container(
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      );

  Widget _secHeader(String title, IconData icon, Color color) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 14),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 130,
              child: Text(
                label,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _approvalStep(
    String role,
    String name,
    bool done,
    String note,
    bool isLast,
  ) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
        child: Row(
          children: [
            Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: done
                        ? AppColors.success.withValues(alpha: 0.1)
                        : AppColors.bgCard,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: done ? AppColors.success : AppColors.border,
                    ),
                  ),
                  child: Icon(
                    done ? Icons.check : Icons.hourglass_empty,
                    color: done ? AppColors.success : AppColors.textMuted,
                    size: 14,
                  ),
                ),
                if (!isLast)
                  Container(width: 1, height: 24, color: AppColors.border),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    role,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                  if (note.isNotEmpty)
                    Text(
                      note,
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 10,
                      ),
                    ),
                ],
              ),
            ),
            if (done)
              const Text(
                'Approved',
                style: TextStyle(
                  color: AppColors.success,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
      );
}
