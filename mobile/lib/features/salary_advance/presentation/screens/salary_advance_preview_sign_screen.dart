import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart' show AppDateFormatter;

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
      await dio.post('/finance/advances/${widget.requestId}/submit');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Salary advance request submitted successfully.'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      if (context.canPop()) context.pop();
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
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () {
            if (context.canPop()) context.pop();
          },
        ),
        title: const Text(
          'Salary Advance Request',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A)),
        ),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : _buildBody(),
      bottomNavigationBar: _loading || _error != null ? null : _buildBottomBar(),
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

  Widget _buildBody() {
    final a = _advance!;
    final amount = (a['amount'] as num?)?.toDouble() ?? 0;
    final months = (a['repayment_months'] as int?) ?? 3;
    final currency = (a['currency'] as String?) ?? 'NAD';
    final purpose = (a['purpose'] as String?) ?? '';
    final advanceType = (a['advance_type'] as String? ?? '').replaceAll('_', ' ');
    final ref_ = (a['reference_number'] as String?) ?? '';
    final monthly = months > 0 ? amount / months : 0.0;
    final schedule = _buildSchedule(amount, months, monthly, currency);

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
                color: const Color(0xFF13EC80),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          )),
        ),
        const SizedBox(height: 20),

        // Heading
        const Text(
          'Deduction Preview & Sign',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
        ),
        const SizedBox(height: 6),
        Text(
          'Review the repayment schedule for your $advanceType advance before signing. This action is binding.',
          style: const TextStyle(fontSize: 13, color: Color(0xFF666666), height: 1.5),
        ),
        const SizedBox(height: 16),

        // Reference & amount summary
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF9FAFB),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _row('Reference', ref_),
            _row('Purpose', purpose.isEmpty ? advanceType : purpose),
            _row('Amount Requested', '$currency ${amount.toStringAsFixed(2)}'),
            _row('Repayment Term', '$months months'),
            _row('Monthly Deduction', '$currency ${monthly.toStringAsFixed(2)}'),
          ]),
        ),
        const SizedBox(height: 20),

        // Deduction Schedule
        Row(
          children: [
            const Icon(Icons.calendar_today, size: 14, color: Color(0xFF888888)),
            const SizedBox(width: 6),
            Text(
              'Deduction Schedule · $months Month${months == 1 ? "" : "s"} Term',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF333333)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFE0E0E0)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(children: [
            // Header
            Container(
              decoration: const BoxDecoration(
                color: Color(0xFFF5F5F5),
                borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
              ),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(children: [
                  Expanded(flex: 3, child: Text('Month', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF888888)))),
                  Expanded(flex: 2, child: Text('Deduction', textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF888888)))),
                  Expanded(flex: 2, child: Text('Balance', textAlign: TextAlign.right, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF888888)))),
                ]),
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE0E0E0)),
            ...schedule.asMap().entries.map((e) => Column(children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(children: [
                  Expanded(flex: 3, child: Text(e.value.$1, style: const TextStyle(fontSize: 13, color: Color(0xFF333333)))),
                  Expanded(flex: 2, child: Text(e.value.$2, textAlign: TextAlign.right,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1A1A1A)))),
                  Expanded(flex: 2, child: Text(e.value.$3, textAlign: TextAlign.right,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                          color: e.key == schedule.length - 1 ? const Color(0xFF0BAE5E) : const Color(0xFF1A1A1A)))),
                ]),
              ),
              if (e.key < schedule.length - 1) const Divider(height: 1, color: Color(0xFFEEEEEE)),
            ])),
            const Divider(height: 1, color: Color(0xFFE0E0E0)),
            // Footer total
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF0FFF6),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(11)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Repayment:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1A1A1A))),
                  Text('$currency ${amount.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0BAE5E))),
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
                color: _signed ? const Color(0xFF13EC80) : const Color(0xFFDDDDDD),
                width: _signed ? 1.5 : 1,
              ),
              borderRadius: BorderRadius.circular(14),
              color: _signed ? const Color(0xFFF0FFF6) : const Color(0xFFFAFAFA),
            ),
            padding: const EdgeInsets.all(20),
            child: Column(children: [
              Icon(Icons.fingerprint, size: 48,
                  color: _signed ? const Color(0xFF13EC80) : const Color(0xFF999999)),
              const SizedBox(height: 10),
              Text(
                _signed ? 'Signed Successfully' : 'Tap to Acknowledge',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700,
                    color: _signed ? const Color(0xFF0BAE5E) : const Color(0xFF333333)),
              ),
              const SizedBox(height: 4),
              const Text('I have reviewed the deduction schedule above.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF888888)), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              const Divider(color: Color(0xFFEEEEEE)),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Icon(Icons.access_time, size: 12, color: Color(0xFFAAAAAA)),
                const SizedBox(width: 4),
                Text(
                  _signed ? 'Acknowledged at ${TimeOfDay.now().format(context)}' : 'Awaiting acknowledgement',
                  style: const TextStyle(fontSize: 11, color: Color(0xFFAAAAAA)),
                ),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 16),

        // Acknowledgement Checkbox
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Checkbox(
            value: _acknowledged,
            activeColor: const Color(0xFF13EC80),
            checkColor: const Color(0xFF102219),
            side: const BorderSide(color: Color(0xFFCCCCCC)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            onChanged: (v) => setState(() => _acknowledged = v!),
          ),
          const SizedBox(width: 4),
          const Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text(
                'I acknowledge that deductions will be made automatically from my salary for the duration of the repayment term.',
                style: TextStyle(fontSize: 13, color: Color(0xFF444444), height: 1.4),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildBottomBar() {
    final canSubmit = _acknowledged && _signed && !_submitting;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFEEEEEE))),
      ),
      child: ElevatedButton.icon(
        onPressed: canSubmit ? _submitAdvance : null,
        icon: _submitting
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black54))
            : const Icon(Icons.send, size: 18),
        label: Text(_submitting ? 'Submitting…' : 'Submit Request'),
        style: ElevatedButton.styleFrom(
          backgroundColor: canSubmit ? const Color(0xFF13EC80) : const Color(0xFFCCCCCC),
          foregroundColor: canSubmit ? const Color(0xFF102219) : const Color(0xFF888888),
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
        '${date.month == 1 ? 'January' : date.month == 2 ? 'February' : date.month == 3 ? 'March' : date.month == 4 ? 'April' : date.month == 5 ? 'May' : date.month == 6 ? 'June' : date.month == 7 ? 'July' : date.month == 8 ? 'August' : date.month == 9 ? 'September' : date.month == 10 ? 'October' : date.month == 11 ? 'November' : 'December'} ${date.year}',
        '$currency ${monthly.toStringAsFixed(2)}',
        '$currency ${balance.toStringAsFixed(2)}',
      ));
    }
    return result;
  }

  Widget _row(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 140, child: Text(label, style: const TextStyle(color: Color(0xFF888888), fontSize: 12))),
      Expanded(child: Text(value, style: const TextStyle(color: Color(0xFF1A1A1A), fontSize: 12, fontWeight: FontWeight.w500))),
    ]),
  );
}
