import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/router/safe_back.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class ImprestDetailScreen extends ConsumerStatefulWidget {
  const ImprestDetailScreen({super.key, this.requestId});

  final String? requestId;

  @override
  ConsumerState<ImprestDetailScreen> createState() =>
      _ImprestDetailScreenState();
}

class _ImprestDetailScreenState extends ConsumerState<ImprestDetailScreen> {
  bool _loading = true;
  bool _withdrawing = false;
  String? _error;
  Map<String, dynamic>? _request;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = widget.requestId;
    if (id == null || id.isEmpty) {
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
          .get<Map<String, dynamic>>('/imprest/requests/$id');
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
        _error = 'Failed to load imprest request.';
        _loading = false;
      });
    }
  }

  Future<void> _withdraw() async {
    final id = widget.requestId;
    if (id == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Withdraw request?'),
        content: const Text(
            'This will delete the request if it is still in draft status.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Withdraw')),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _withdrawing = true);
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .delete('/imprest/requests/$id');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Imprest request withdrawn.'),
        backgroundColor: AppColors.success,
      ));
      context.safePopOrGoHome();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Only draft requests can be withdrawn.'),
        backgroundColor: AppColors.warning,
      ));
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return AppColors.success;
      case 'active':
        return AppColors.primary;
      case 'retired':
        return AppColors.success;
      case 'rejected':
        return AppColors.danger;
      case 'submitted':
        return AppColors.info;
      case 'pending_retirement':
        return AppColors.warning;
      default:
        return AppColors.textMuted;
    }
  }

  String _statusLabel(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return 'Approved';
      case 'active':
        return 'Active';
      case 'retired':
        return 'Retired';
      case 'rejected':
        return 'Rejected';
      case 'submitted':
        return 'Submitted';
      case 'pending_retirement':
        return 'Pending Retirement';
      default:
        return status ?? 'Draft';
    }
  }

  IconData _statusIcon(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
      case 'retired':
        return Icons.check_circle_outline;
      case 'active':
        return Icons.play_circle_outline;
      case 'rejected':
        return Icons.cancel_outlined;
      case 'submitted':
        return Icons.send_outlined;
      case 'pending_retirement':
        return Icons.access_time;
      default:
        return Icons.edit_note_outlined;
    }
  }

  String _fmt(dynamic value, {String prefix = ''}) {
    if (value == null) return '—';
    final str = value.toString();
    if (str.isEmpty) return '—';
    return '$prefix$str';
  }

  String _currency(dynamic value) {
    if (value == null) return '—';
    final num = double.tryParse(value.toString());
    if (num == null) return value.toString();
    return 'N\$${num.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.safePopOrGoHome(),
        ),
        title: const Text('Imprest Request',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            color: AppColors.danger, size: 40),
                        const SizedBox(height: 12),
                        Text(_error!,
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 14),
                            textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: _load,
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final r = _request!;
    final status = r['status']?.toString();
    final statusColor = _statusColor(status);
    final amountRequested =
        double.tryParse(r['amount_requested']?.toString() ?? '0') ?? 0;
    final amountApproved =
        double.tryParse(r['amount_approved']?.toString() ?? '0') ?? 0;
    final amountRetired =
        double.tryParse(r['amount_retired']?.toString() ?? '0') ?? 0;
    final disbursed = amountApproved > 0 ? amountApproved : amountRequested;
    final retirementPct = disbursed > 0 ? (amountRetired / disbursed).clamp(0.0, 1.0) : 0.0;

    final canWithdraw = status == 'draft';
    final canRetire = ['approved', 'active', 'pending_retirement']
        .contains(status?.toLowerCase());

    final requesterName =
        (r['requester'] as Map?)?['name']?.toString() ?? '—';
    final approver = r['approved_by_user'] as Map?;
    final approverName = approver?['name']?.toString() ?? '—';
    final steps = r['workflow_steps'] as List? ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Status header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
                colors: [statusColor.withValues(alpha: 0.1), AppColors.bgSurface]),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: statusColor.withValues(alpha: 0.3)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(_statusIcon(status), color: statusColor, size: 12),
                  const SizedBox(width: 4),
                  Text(_statusLabel(status),
                      style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ]),
              ),
              const Spacer(),
              Text(_fmt(r['reference_number']),
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 11)),
            ]),
            const SizedBox(height: 12),
            Text(_fmt(r['purpose']),
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(
              [
                if (r['advance_date'] != null)
                  'Approved ${AppDateFormatter.short(r['advance_date']?.toString())}',
                if (r['expected_liquidation_date'] != null)
                  'Retire by ${AppDateFormatter.short(r['expected_liquidation_date']?.toString())}',
              ].join('  ·  '),
              style:
                  const TextStyle(color: AppColors.textMuted, fontSize: 11),
            ),
          ]),
        ),
        const SizedBox(height: 16),

        // Details card
        _card(children: [
          _secHeader('Imprest Details',
              Icons.account_balance_wallet_outlined, AppColors.warning),
          _row('Requested by', requesterName),
          _row('Purpose', _fmt(r['purpose'])),
          _row('Budget Line', _fmt(r['budget_line'])),
          _row(
            'Advance Period',
            AppDateFormatter.range(
                r['advance_period_start']?.toString(),
                r['advance_period_end']?.toString()),
          ),
          _row('Amount Requested', _currency(r['amount_requested'])),
          if (amountApproved > 0)
            _row('Amount Approved', _currency(r['amount_approved'])),
          const SizedBox(height: 4),
        ]),
        const SizedBox(height: 12),

        // Retirement progress (only if disbursed)
        if (disbursed > 0) ...[
          _card(children: [
            _secHeader(
                'Retirement Progress', Icons.pie_chart_outline, AppColors.primary),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(children: [
                const Text('Retired',
                    style: TextStyle(
                        color: AppColors.textMuted, fontSize: 12)),
                const Spacer(),
                Text(
                  '${_currency(r['amount_retired'])} / ${_currency(disbursed)}',
                  style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w700),
                ),
              ]),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: retirementPct,
                  minHeight: 8,
                  backgroundColor: AppColors.bgCard,
                  valueColor:
                      const AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(children: [
                _badge('Retired: ${_currency(r['amount_retired'])}',
                    AppColors.success),
                const SizedBox(width: 8),
                _badge(
                    'Pending: ${_currency(disbursed - amountRetired)}',
                    AppColors.warning),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
        ],

        // Approval chain
        if (steps.isNotEmpty) ...[
          _card(children: [
            _secHeader('Approval Chain',
                Icons.account_tree_outlined, AppColors.info),
            ...steps.asMap().entries.map((entry) {
              final step = entry.value as Map? ?? {};
              final isLast = entry.key == steps.length - 1;
              final stepStatus = step['status']?.toString() ?? '';
              final approved = stepStatus == 'approved';
              final roleName = step['role']?.toString() ??
                  step['approver_role']?.toString() ??
                  'Approver';
              final approverUser = (step['approver'] as Map?)?['name']?.toString() ??
                  step['approver_name']?.toString() ??
                  '—';
              return _approvalStep(roleName, approverUser, approved, isLast);
            }),
          ]),
          const SizedBox(height: 12),
        ] else if (approver != null) ...[
          _card(children: [
            _secHeader('Approval Chain',
                Icons.account_tree_outlined, AppColors.info),
            _approvalStep('Requester', requesterName, true, false),
            _approvalStep('Approver', approverName,
                ['approved', 'active', 'retired'].contains(status?.toLowerCase()), true),
          ]),
          const SizedBox(height: 12),
        ],

        // Balance notice (if approved amount > retired)
        if (disbursed > 0 && amountRetired < disbursed && status != 'rejected') ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border:
                  Border.all(color: AppColors.info.withValues(alpha: 0.2)),
            ),
            child: Row(children: [
              const Icon(Icons.info_outline,
                  color: AppColors.info, size: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Outstanding balance: ${_currency(disbursed - amountRetired)}',
                  style:
                      const TextStyle(color: AppColors.info, fontSize: 12)),
              ),
            ]),
          ),
          const SizedBox(height: 20),
        ],

        // Actions
        if (canWithdraw || canRetire)
          Row(children: [
            if (canWithdraw)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _withdrawing ? null : _withdraw,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: _withdrawing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppColors.danger))
                      : const Icon(Icons.cancel_outlined, size: 16),
                  label: const Text('Withdraw',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            if (canWithdraw && canRetire) const SizedBox(width: 12),
            if (canRetire)
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => context
                      .push('/imprest/retirement?id=${widget.requestId}'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(Icons.receipt_long_outlined, size: 16),
                  label: const Text('Submit Retirement',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
          ]),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _card({required List<Widget> children}) => Container(
        decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border)),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start, children: children),
      );

  Widget _secHeader(String title, IconData icon, Color color) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Row(children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 14),
          ),
          const SizedBox(width: 8),
          Text(title,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700)),
        ]),
      );

  Widget _row(String label, String val) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
              width: 120,
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 12))),
          Expanded(
              child: Text(val,
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w500))),
        ]),
      );

  Widget _badge(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6)),
        child: Text(label,
            style: TextStyle(
                color: color, fontSize: 10, fontWeight: FontWeight.w700)),
      );

  Widget _approvalStep(
      String role, String name, bool done, bool isLast) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
        child: Row(children: [
          Column(children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                  color: done
                      ? AppColors.success.withValues(alpha: 0.1)
                      : AppColors.bgCard,
                  shape: BoxShape.circle,
                  border: Border.all(
                      color:
                          done ? AppColors.success : AppColors.border)),
              child: Icon(
                  done ? Icons.check : Icons.hourglass_empty,
                  color: done ? AppColors.success : AppColors.textMuted,
                  size: 14),
            ),
            if (!isLast)
              Container(width: 1, height: 20, color: AppColors.border),
          ]),
          const SizedBox(width: 12),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(name,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600)),
                Text(role,
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 11)),
              ])),
          if (done)
            const Text('Approved',
                style: TextStyle(
                    color: AppColors.success,
                    fontSize: 11,
                    fontWeight: FontWeight.w600)),
          if (!done && !isLast)
            const Text('Pending',
                style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 11,
                    fontWeight: FontWeight.w600)),
          if (!done && isLast)
            const Text('Awaiting',
                style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11)),
        ]),
      );
}
