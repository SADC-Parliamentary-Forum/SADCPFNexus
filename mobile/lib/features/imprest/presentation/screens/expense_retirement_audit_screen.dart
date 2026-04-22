import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/router/safe_back.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class ExpenseRetirementAuditScreen extends ConsumerStatefulWidget {
  const ExpenseRetirementAuditScreen({super.key, this.requestId});

  final String? requestId;

  @override
  ConsumerState<ExpenseRetirementAuditScreen> createState() =>
      _ExpenseRetirementAuditScreenState();
}

class _ExpenseRetirementAuditScreenState
    extends ConsumerState<ExpenseRetirementAuditScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _imprest;

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
        _imprest = res.data == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(res.data as Map);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load audit summary.';
        _loading = false;
      });
    }
  }

  String _currency(dynamic v) {
    if (v == null) return '—';
    final d = double.tryParse(v.toString());
    if (d == null) return v.toString();
    return 'N\$${d.toStringAsFixed(2)}';
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
        title: const Text('Audit Summary',
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
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
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
                    ]),
                  ),
                )
              : _buildBody(),
    );
  }

  Widget _buildBody() {
    final r = _imprest ?? {};
    final purpose = r['purpose']?.toString() ?? '—';
    final refNum = r['reference_number']?.toString() ?? '';
    final status = r['status']?.toString() ?? '';
    final advance =
        double.tryParse(r['amount_approved']?.toString() ?? '') ??
            double.tryParse(r['amount_requested']?.toString() ?? '') ??
            0.0;
    final retired =
        double.tryParse(r['amount_retired']?.toString() ?? '') ?? 0.0;
    final variance = advance - retired;
    final isOverspent = variance < 0;
    final isRetired = status == 'retired';

    final attachments = (r['attachments'] as List?) ?? [];
    final retirementDate =
        AppDateFormatter.short(r['retired_at']?.toString() ?? r['updated_at']?.toString());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          const Text('SETTLEMENT SUMMARY',
              style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8)),
          const Spacer(),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
                color: (isOverspent ? AppColors.danger : AppColors.success)
                    .withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6)),
            child: Text(
              isOverspent ? 'Overspent' : 'Refund Due',
              style: TextStyle(
                  color: isOverspent
                      ? AppColors.danger
                      : AppColors.success,
                  fontSize: 10,
                  fontWeight: FontWeight.w700),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Text(purpose,
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w800)),
        if (refNum.isNotEmpty)
          Text(refNum,
              style: const TextStyle(
                  color: AppColors.textMuted, fontSize: 11)),
        const SizedBox(height: 12),
        Text(
          '${isOverspent ? '' : '+'}${_currency(variance.abs())}',
          style: TextStyle(
              color: isOverspent ? AppColors.danger : AppColors.success,
              fontSize: 28,
              fontWeight: FontWeight.w900),
        ),
        const Text('Final Budget Variance',
            style:
                TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        const SizedBox(height: 16),

        if (isRetired)
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.3))),
            child: const Row(children: [
              Icon(Icons.verified_outlined,
                  color: AppColors.success, size: 16),
              SizedBox(width: 8),
              Text('Retirement Verified',
                  style: TextStyle(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w700)),
            ]),
          ),

        const SizedBox(height: 16),

        // Financials card
        _card(children: [
          const _SecHeader('Financials'),
          _lineItem('Advance Issued', _currency(advance), null),
          _lineItem('Amount Claimed', _currency(retired),
              isOverspent ? AppColors.danger : AppColors.success),
          _lineItem(
            isOverspent ? 'Shortfall' : 'Refund Due',
            _currency(variance.abs()),
            isOverspent ? AppColors.danger : AppColors.success,
          ),
          if (r['expected_liquidation_date'] != null)
            _lineItem(
                'Retirement Deadline',
                AppDateFormatter.short(
                    r['expected_liquidation_date'].toString()),
                null),
        ]),
        const SizedBox(height: 12),

        // Evidence / attachments card
        _card(children: [
          const _SecHeader('Evidence'),
          if (attachments.isEmpty)
            const Padding(
              padding: EdgeInsets.fromLTRB(14, 4, 14, 14),
              child: Text('No attachments uploaded.',
                  style: TextStyle(
                      color: AppColors.textMuted, fontSize: 12)),
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: attachments.take(8).map<Widget>((att) {
                  final name = (att as Map?)?['file_name']?.toString() ??
                      'File';
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                        color: AppColors.bgDark,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.attach_file,
                          color: AppColors.textMuted, size: 14),
                      const SizedBox(width: 4),
                      Text(name,
                          style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11)),
                    ]),
                  );
                }).toList(),
              ),
            ),
        ]),
        const SizedBox(height: 12),

        // Sign-off
        _card(children: [
          const _SecHeader('Sign-off'),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              if (isRetired) ...[
                Row(children: [
                  const Icon(Icons.check_circle,
                      color: AppColors.success, size: 16),
                  const SizedBox(width: 8),
                  Text('Retired on $retirementDate',
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600)),
                ]),
              ] else ...[
                const Text('Retirement not yet submitted.',
                    style: TextStyle(
                        color: AppColors.textMuted, fontSize: 13)),
              ],
            ]),
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children),
      );

  Widget _lineItem(String label, String value, Color? valueColor) =>
      Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        child: Row(children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12))),
          Text(value,
              style: TextStyle(
                  color: valueColor ?? AppColors.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ]),
      );
}

class _SecHeader extends StatelessWidget {
  final String title;
  const _SecHeader(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
        child: Text(title,
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w700)),
      );
}
