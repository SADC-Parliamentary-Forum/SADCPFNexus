import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';
import '../../../../shared/widgets/stitch_screen.dart';
import '../../data/salary_advance_helpers.dart';

class SalaryAdvanceDetailScreen extends ConsumerStatefulWidget {
  const SalaryAdvanceDetailScreen({super.key, this.requestId});
  final String? requestId;

  @override
  ConsumerState<SalaryAdvanceDetailScreen> createState() =>
      _SalaryAdvanceDetailScreenState();
}

class _SalaryAdvanceDetailScreenState
    extends ConsumerState<SalaryAdvanceDetailScreen> {
  bool _loading = true;
  bool _acting = false;
  String? _error;
  Map<String, dynamic>? _advance;

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
        _error = 'Missing advance ID.';
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
          .get<Map<String, dynamic>>('/finance/advances/$id');
      if (!mounted) return;
      setState(() {
        _advance = extractSalaryAdvanceObject(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load salary advance.';
        _loading = false;
      });
    }
  }

  Future<void> _withdraw() async {
    final id = widget.requestId;
    if (id == null) return;
    final status = (_advance?['status']?.toString() ?? '').toLowerCase();
    final isDraft = status == 'draft';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isDraft ? 'Delete draft?' : 'Withdraw request?'),
        content: Text(isDraft
            ? 'This permanently deletes your draft salary advance request.'
            : 'This withdraws your salary advance application if it is still withdrawable.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(isDraft ? 'Delete' : 'Withdraw')),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _acting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      if (isDraft) {
        await dio.delete('/finance/advances/$id');
      } else {
        await dio.post('/finance/advances/$id/withdraw');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(isDraft ? 'Draft deleted.' : 'Advance withdrawn.'),
        backgroundColor: AppColors.success,
      ));
      if (isDraft) {
        context.safePopOrGoHome();
      } else {
        await _load();
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(isDraft
            ? 'Could not delete this draft.'
            : 'Could not withdraw this advance.'),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _resubmit() async {
    final id = widget.requestId;
    if (id == null) return;
    setState(() => _acting = true);
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .post('/finance/advances/$id/resubmit');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Advance resubmitted.'),
        backgroundColor: AppColors.success,
      ));
      await _load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Could not resubmit this advance.'),
        backgroundColor: AppColors.danger,
      ));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Advance detail',
      fallbackRoute: '/salary/advances',
      body: _loading
          ? const StitchLoadingState(label: 'Loading advance')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                    children: [
                      _header(context),
                      const SizedBox(height: 16),
                      _summaryCard(context),
                      const SizedBox(height: 12),
                      _workflowCard(context),
                      const SizedBox(height: 12),
                      _paymentRecoveryCard(context),
                      const SizedBox(height: 12),
                      _ledgerCard(context),
                      const SizedBox(height: 20),
                      _actions(),
                    ],
                  ),
                ),
    );
  }

  Widget _header(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final a = _advance!;
    final status = salaryAdvanceStatusConfig(a['status']?.toString());
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(a['reference_number']?.toString() ?? 'Salary advance',
          style: TextStyle(
              fontSize: 22, fontWeight: FontWeight.w800, color: c.onSurface)),
      const SizedBox(height: 8),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: status.color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(status.icon, size: 14, color: status.color),
          const SizedBox(width: 6),
          Text(status.label,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: status.color)),
        ]),
      ),
    ]);
  }

  Widget _summaryCard(BuildContext context) {
    final a = _advance!;
    final currency = a['currency']?.toString() ?? 'NAD';
    return _section(
      context,
      title: 'Request',
      child: Column(children: [
        _row(context, 'Amount', formatSaCurrency(a['amount'], currency: currency)),
        if (a['approved_amount'] != null)
          _row(context, 'Approved amount',
              formatSaCurrency(a['approved_amount'], currency: currency)),
        _row(context, 'Type',
            (a['advance_type']?.toString() ?? '—').replaceAll('_', ' ')),
        _row(context, 'Purpose', a['purpose']?.toString() ?? '—'),
        _row(
            context,
            'Recovery',
            asSaDouble(a['repayment_months']) <= 1
                ? 'Full EOM'
                : '${a['repayment_months']} months'),
        if (a['intended_recovery_payroll_date'] != null)
          _row(context, 'Recovery payroll',
              AppDateFormatter.short(
                  a['intended_recovery_payroll_date'].toString())),
        if (a['created_at'] != null)
          _row(context, 'Created', AppDateFormatter.short(a['created_at'].toString())),
        if (a['submitted_at'] != null)
          _row(context, 'Submitted',
              AppDateFormatter.short(a['submitted_at'].toString())),
        if (a['rejection_reason'] != null)
          _row(context, 'Rejection reason', a['rejection_reason'].toString()),
        if (a['not_eligible_reason'] != null)
          _row(context, 'Not eligible', a['not_eligible_reason'].toString()),
      ]),
    );
  }

  Widget _workflowCard(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final a = _advance!;
    final steps = <(String, String?, bool)>[
      (
        'Submitted',
        a['submitted_at']?.toString(),
        a['submitted_at'] != null ||
            !['draft', 'withdrawn', 'cancelled'].contains(a['status']),
      ),
      (
        'Finance certified',
        a['finance_certified_at']?.toString(),
        a['finance_certified_at'] != null,
      ),
      ('Approved', a['approved_at']?.toString(), a['approved_at'] != null),
      ('Paid', a['paid_at']?.toString(), a['paid_at'] != null),
      (
        'Closed',
        a['closed_at']?.toString(),
        a['closed_at'] != null || a['status'] == 'closed',
      ),
    ];
    final approval = a['approval_request'] ?? a['approvalRequest'];
    final history = approval is Map
        ? (approval['history'] as List?) ?? const []
        : const [];

    return _section(
      context,
      title: 'Workflow status',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ...steps.map((s) {
          final done = s.$3;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
                  size: 18,
                  color: done
                      ? AppColors.success
                      : c.onSurface.withValues(alpha: 0.3)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(s.$1,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: done
                          ? c.onSurface
                          : c.onSurface.withValues(alpha: 0.6),
                    )),
              ),
              if (s.$2 != null)
                Text(AppDateFormatter.short(s.$2!),
                    style: TextStyle(
                        fontSize: 11, color: c.onSurface.withValues(alpha: 0.6))),
            ]),
          );
        }),
        if (history.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Divider(),
          const SizedBox(height: 8),
          Text('Approval history',
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: c.onSurface)),
          const SizedBox(height: 8),
          ...history.whereType<Map>().take(8).map((h) {
            final user = h['user'];
            final name = user is Map
                ? user['name']?.toString()
                : h['user_name']?.toString();
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '${h['action'] ?? h['status'] ?? 'Update'}'
                '${name != null ? ' · $name' : ''}'
                '${h['created_at'] != null ? ' · ${AppDateFormatter.short(h['created_at'].toString())}' : ''}',
                style: TextStyle(
                    fontSize: 12, color: c.onSurface.withValues(alpha: 0.7)),
              ),
            );
          }),
        ],
      ]),
    );
  }

  Widget _paymentRecoveryCard(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final a = _advance!;
    final currency = a['currency']?.toString() ?? 'NAD';
    final balance = outstandingBalanceFromRegister(a);
    final hasPayment = a['payment_reference'] != null ||
        a['payment_status'] != null ||
        a['paid_at'] != null;
    final hasRecovery = a['recovery_status'] != null ||
        a['recovered_amount'] != null ||
        a['intended_recovery_payroll_date'] != null ||
        balance > 0;

    if (!hasPayment && !hasRecovery) {
      return _section(
        context,
        title: 'Payment & recovery',
        child: Text('No payment or recovery recorded yet.',
            style: TextStyle(
                fontSize: 13, color: c.onSurface.withValues(alpha: 0.7))),
      );
    }

    return _section(
      context,
      title: 'Payment & recovery',
      child: Column(children: [
        if (a['payment_status'] != null)
          _row(context, 'Payment status', a['payment_status'].toString()),
        if (a['payment_reference'] != null)
          _row(context, 'Payment reference', a['payment_reference'].toString()),
        if (a['payment_method'] != null)
          _row(context, 'Payment method',
              a['payment_method'].toString().replaceAll('_', ' ')),
        if (a['paid_at'] != null)
          _row(context, 'Paid at', AppDateFormatter.short(a['paid_at'].toString())),
        if (a['recovery_status'] != null)
          _row(context, 'Recovery status',
              a['recovery_status'].toString().replaceAll('_', ' ')),
        if (a['recovered_amount'] != null)
          _row(context, 'Recovered amount',
              formatSaCurrency(a['recovered_amount'], currency: currency)),
        if (a['intended_recovery_payroll_date'] != null)
          _row(
              context,
              'Intended recovery',
              AppDateFormatter.short(
                  a['intended_recovery_payroll_date'].toString())),
        if (balance > 0)
          _row(context, 'Outstanding balance',
              formatSaCurrency(balance, currency: currency)),
      ]),
    );
  }

  Widget _ledgerCard(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final a = _advance!;
    final register = a['balance_register'] ?? a['balanceRegister'];
    if (register is! Map) return const SizedBox.shrink();
    final txns = (register['transactions'] as List?) ?? const [];
    if (txns.isEmpty) {
      return _section(
        context,
        title: 'Balance register',
        child: Text(
          'Balance: ${formatSaCurrency(register['balance'], currency: a['currency']?.toString() ?? 'NAD')}',
          style: TextStyle(fontSize: 13, color: c.onSurface),
        ),
      );
    }
    return _section(
      context,
      title: 'Ledger',
      child: Column(children: [
        _row(
            context,
            'Current balance',
            formatSaCurrency(register['balance'],
                currency: a['currency']?.toString() ?? 'NAD')),
        const SizedBox(height: 8),
        ...txns.whereType<Map>().take(10).map((t) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(
                child: Text(
                  '${t['type'] ?? 'txn'}'
                  '${t['created_at'] != null ? ' · ${AppDateFormatter.short(t['created_at'].toString())}' : ''}',
                  style: TextStyle(
                      fontSize: 12, color: c.onSurface.withValues(alpha: 0.7)),
                ),
              ),
              Text(
                formatSaCurrency(t['amount'],
                    currency: a['currency']?.toString() ?? 'NAD'),
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: c.onSurface),
              ),
            ]),
          );
        }),
      ]),
    );
  }

  Widget _actions() {
    final status = (_advance?['status']?.toString() ?? '').toLowerCase();
    final canContinueDraft = status == 'draft';
    final canWithdraw = [
      'draft',
      'submitted',
      'resubmitted',
      'finance_returned',
      'returned_for_correction',
    ].contains(status);
    final canResubmit =
        ['finance_returned', 'returned_for_correction'].contains(status);

    if (!canContinueDraft && !canWithdraw && !canResubmit) {
      return const SizedBox.shrink();
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (canContinueDraft)
        ElevatedButton.icon(
          onPressed: _acting
              ? null
              : () => context
                  .push('/salary/advance/preview?id=${widget.requestId}'),
          icon: const Icon(Icons.draw_outlined, size: 18),
          label: const Text('Continue to preview & sign'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF13EC80),
            foregroundColor: const Color(0xFF102219),
            minimumSize: const Size(double.infinity, 48),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      if (canResubmit) ...[
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _acting ? null : _resubmit,
          icon: const Icon(Icons.refresh, size: 18),
          label: Text(_acting ? 'Working…' : 'Resubmit'),
        ),
      ],
      if (canWithdraw) ...[
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _acting ? null : _withdraw,
          icon: const Icon(Icons.block_outlined, size: 18),
          label: Text(_acting
              ? 'Working…'
              : (status == 'draft' ? 'Delete draft' : 'Withdraw')),
          style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
        ),
      ],
    ]);
  }

  Widget _section(BuildContext context,
      {required String title, required Widget child}) {
    final c = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.outline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title,
            style: TextStyle(
                fontSize: 14, fontWeight: FontWeight.w700, color: c.onSurface)),
        const SizedBox(height: 10),
        child,
      ]),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    final c = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 130,
          child: Text(label,
              style: TextStyle(
                  fontSize: 12, color: c.onSurface.withValues(alpha: 0.6))),
        ),
        Expanded(
          child: Text(value,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: c.onSurface)),
        ),
      ]),
    );
  }
}
