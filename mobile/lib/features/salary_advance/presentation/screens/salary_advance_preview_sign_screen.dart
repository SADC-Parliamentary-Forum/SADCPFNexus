import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart' show AppDateFormatter;
import '../../data/salary_advance_helpers.dart';

class SalaryAdvancePreviewSignScreen extends ConsumerStatefulWidget {
  const SalaryAdvancePreviewSignScreen({super.key, this.requestId});
  final String? requestId;

  @override
  ConsumerState<SalaryAdvancePreviewSignScreen> createState() =>
      _SalaryAdvancePreviewSignScreenState();
}

class _SalaryAdvancePreviewSignScreenState
    extends ConsumerState<SalaryAdvancePreviewSignScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _advance;

  bool _acknowledged = false;
  bool _signed = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final id = widget.requestId;
    if (id == null) {
      setState(() { _loading = false; _error = 'No advance ID provided.'; });
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final r = await dio.get<Map<String, dynamic>>('/finance/advances/$id');
      if (!mounted) return;
      setState(() {
        _advance = r.data?['data'] as Map<String, dynamic>? ?? r.data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().contains('404') ? 'Advance not found.' : 'Failed to load advance details.';
      });
    }
  }

  void _onTapSign() {
    HapticFeedback.mediumImpact();
    setState(() => _signed = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Acknowledged — tap Submit to finalise.'),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _submitAdvance() async {
    if (!_acknowledged || !_signed) return;
    setState(() => _submitting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post(
        '/finance/advances/${widget.requestId}/submit',
        data: {'deduction_authority_confirmed': true},
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Salary advance request submitted successfully.'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      final id = widget.requestId;
      if (id != null) {
        context.go('/salary/advances/$id');
      } else if (context.canPop()) {
        context.pop();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().contains('422') ? 'Cannot submit this advance.' : 'Submission failed. Try again.'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.scaffoldBackgroundColor,
        elevation: 0,
        foregroundColor: c.onSurface,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () {
            if (context.canPop()) context.pop();
          },
        ),
        title: Text(
          'Salary Advance Request',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.onSurface),
        ),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : _buildBody(context),
      bottomNavigationBar: _loading || _error != null ? null : _buildBottomBar(context),
    );
  }

  Widget _buildError() => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
      const SizedBox(height: 12),
      Text(_error!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
      const SizedBox(height: 16),
      ElevatedButton(
        onPressed: _load,
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
        child: const Text('Retry', style: TextStyle(color: Colors.white)),
      ),
    ]),
  );

  Widget _buildBody(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final a = _advance!;
    final amount = (a['amount'] as num?)?.toDouble() ?? 0;
    final months = (a['repayment_months'] as int?) ?? 1;
    final currency = (a['currency'] as String?) ?? 'NAD';
    final purpose = (a['purpose'] as String?) ?? '';
    final advanceType = (a['advance_type'] as String? ?? '').replaceAll('_', ' ');
    final ref_ = (a['reference_number'] as String?) ?? '';
    final recoveryDate = a['intended_recovery_payroll_date']?.toString();
    final isFullEom = months <= 1;
    final monthly = months > 0 ? amount / months : 0.0;
    final schedule = isFullEom
        ? <(String, String, String)>[
            (
              recoveryDate != null && recoveryDate.isNotEmpty
                  ? 'Payroll month ending $recoveryDate'
                  : 'Next applicable payroll month',
              formatSaCurrency(amount, currency: currency),
              formatSaCurrency(0, currency: currency),
            ),
          ]
        : _buildSchedule(amount, months, monthly, currency);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
      children: [
        // Step indicator (step 3 of 3)
        Row(
          children: List.generate(3, (i) => Expanded(
            child: Container(
              height: 4,
              margin: EdgeInsets.only(right: i < 2 ? 4 : 0),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
        const SizedBox(height: 20),

        // Heading
        Text(
          'Deduction Preview & Sign',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.onSurface),
        ),
        const SizedBox(height: 6),
        Text(
          isFullEom
              ? 'Confirm full payroll deduction authority for your $advanceType advance. This consent is digitally logged.'
              : 'Review the repayment schedule for your $advanceType advance before signing. This action is binding.',
          style: TextStyle(fontSize: 13, color: c.onSurface.withValues(alpha: 0.65), height: 1.5),
        ),
        const SizedBox(height: 16),

        // Reference & amount summary
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.outline),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _row(context, 'Reference', ref_),
            _row(context, 'Purpose', purpose.isEmpty ? advanceType : purpose),
            _row(context, 'Amount Requested', formatSaCurrency(amount, currency: currency)),
            _row(context, 'Recovery', isFullEom ? 'Full amount — one payroll month' : '$months months'),
            _row(
              context,
              isFullEom ? 'Payroll Deduction' : 'Monthly Deduction',
              formatSaCurrency(isFullEom ? amount : monthly, currency: currency),
            ),
          ]),
        ),
        const SizedBox(height: 20),

        // Deduction Schedule
        Row(
          children: [
            Icon(Icons.calendar_today, size: 14, color: c.onSurface.withValues(alpha: 0.55)),
            const SizedBox(width: 6),
            Text(
              isFullEom
                  ? 'Full EOM Recovery'
                  : 'Deduction Schedule · $months Month${months == 1 ? "" : "s"} Term',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.onSurface.withValues(alpha: 0.85)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: c.outline),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(children: [
            // Header
            Container(
              decoration: BoxDecoration(
                color: c.onSurface.withValues(alpha: 0.05),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(children: [
                  Expanded(flex: 3, child: Text('Month', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.onSurface.withValues(alpha: 0.55)))),
                  Expanded(flex: 2, child: Text('Deduction', textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.onSurface.withValues(alpha: 0.55)))),
                  Expanded(flex: 2, child: Text('Balance', textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.onSurface.withValues(alpha: 0.55)))),
                ]),
              ),
            ),
            Divider(height: 1, color: c.outline),
            ...schedule.asMap().entries.map((e) => Column(children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(children: [
                  Expanded(flex: 3, child: Text(e.value.$1, style: TextStyle(fontSize: 13, color: c.onSurface.withValues(alpha: 0.85)))),
                  Expanded(flex: 2, child: Text(e.value.$2, textAlign: TextAlign.right,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.onSurface))),
                  Expanded(flex: 2, child: Text(e.value.$3, textAlign: TextAlign.right,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                          color: e.key == schedule.length - 1 ? AppColors.success : c.onSurface))),
                ]),
              ),
              if (e.key < schedule.length - 1) Divider(height: 1, color: c.outline.withValues(alpha: 0.6)),
            ])),
            Divider(height: 1, color: c.outline),
            // Footer total
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(11)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Total Repayment:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.onSurface)),
                  Text(formatSaCurrency(amount, currency: currency),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.success)),
                ],
              ),
            ),
          ]),
        ),
        const SizedBox(height: 20),

        // Digital Signature
        GestureDetector(
          onTap: _signed ? null : _onTapSign,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            decoration: BoxDecoration(
              border: Border.all(
                color: _signed ? AppColors.primary : c.outline,
                width: _signed ? 1.5 : 1,
              ),
              borderRadius: BorderRadius.circular(14),
              color: _signed ? AppColors.primary.withValues(alpha: 0.1) : c.surface,
            ),
            padding: const EdgeInsets.all(20),
            child: Column(children: [
              Icon(Icons.fingerprint, size: 48,
                  color: _signed ? AppColors.primary : c.onSurface.withValues(alpha: 0.45)),
              const SizedBox(height: 10),
              Text(
                _signed ? 'Signed Successfully' : 'Tap to Acknowledge',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700,
                    color: _signed ? AppColors.success : c.onSurface.withValues(alpha: 0.85)),
              ),
              const SizedBox(height: 4),
              Text('I have reviewed the deduction schedule above.',
                  style: TextStyle(fontSize: 11, color: c.onSurface.withValues(alpha: 0.55)), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              Divider(color: c.outline.withValues(alpha: 0.6)),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.access_time, size: 12, color: c.onSurface.withValues(alpha: 0.45)),
                const SizedBox(width: 4),
                Text(
                  _signed ? 'Acknowledged at ${TimeOfDay.now().format(context)}' : 'Awaiting acknowledgement',
                  style: TextStyle(fontSize: 11, color: c.onSurface.withValues(alpha: 0.45)),
                ),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 16),

        // Acknowledgement Checkbox — deduction authority
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Checkbox(
            value: _acknowledged,
            activeColor: AppColors.primary,
            checkColor: const Color(0xFF102219),
            side: BorderSide(color: c.onSurface.withValues(alpha: 0.3)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            onChanged: (v) => setState(() => _acknowledged = v!),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                isFullEom
                    ? 'I authorise the Finance Department to deduct the full advance of ${formatSaCurrency(amount, currency: currency)} from my salary in the applicable payroll month. This consent is digitally logged.'
                    : 'I acknowledge that deductions will be made automatically from my salary for the duration of the repayment term.',
                style: TextStyle(fontSize: 13, color: c.onSurface.withValues(alpha: 0.8), height: 1.4),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final canSubmit = _acknowledged && _signed && !_submitting;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: c.outline.withValues(alpha: 0.6))),
      ),
      child: ElevatedButton.icon(
        onPressed: canSubmit ? _submitAdvance : null,
        icon: _submitting
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black54))
            : const Icon(Icons.send, size: 18),
        label: Text(_submitting ? 'Submitting…' : 'Submit Request'),
        style: ElevatedButton.styleFrom(
          backgroundColor: canSubmit ? AppColors.primary : c.onSurface.withValues(alpha: 0.15),
          foregroundColor: canSubmit ? const Color(0xFF102219) : c.onSurface.withValues(alpha: 0.4),
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  List<(String, String, String)> _buildSchedule(double amount, int months, double monthly, String currency) {
    final result = <(String, String, String)>[];
    final now = DateTime.now();
    double remaining = amount;
    for (var i = 0; i < months; i++) {
      final date = DateTime(now.year, now.month + i + 1);
      final monthLabel = AppDateFormatter.short('${date.year}-${date.month.toString().padLeft(2, '0')}-01')
          .split(' ').sublist(1).join(' '); // "MMM YYYY"
      remaining -= monthly;
      final balance = remaining < 0.01 ? 0.0 : remaining;
      result.add((
        monthLabel,
        formatSaCurrency(monthly, currency: currency),
        formatSaCurrency(balance, currency: currency),
      ));
    }
    return result;
  }

  Widget _row(BuildContext context, String label, String value) {
    final c = Theme.of(context).colorScheme;
    return Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 140, child: Text(label, style: TextStyle(color: c.onSurface.withValues(alpha: 0.55), fontSize: 12))),
      Expanded(child: Text(value, style: TextStyle(color: c.onSurface, fontSize: 12, fontWeight: FontWeight.w500))),
    ]),
  );
  }
}
