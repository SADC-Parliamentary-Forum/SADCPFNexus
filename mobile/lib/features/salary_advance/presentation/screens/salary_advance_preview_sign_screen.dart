import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class SalaryAdvancePreviewSignScreen extends StatefulWidget {
  const SalaryAdvancePreviewSignScreen({super.key});

  @override
  State<SalaryAdvancePreviewSignScreen> createState() =>
      _SalaryAdvancePreviewSignScreenState();
}

class _SalaryAdvancePreviewSignScreenState
    extends State<SalaryAdvancePreviewSignScreen> {
  bool _acknowledged = false;
  bool _signed = false;

  static const _schedule = [
    _DeductionRow(month: 'November 2023', deduction: '\$1,200.00', balance: '\$2,400.00'),
    _DeductionRow(month: 'December 2023', deduction: '\$1,200.00', balance: '\$1,200.00'),
    _DeductionRow(month: 'January 2024',  deduction: '\$1,200.00', balance: '\$0.00'),
  ];

  void _onTapSign() {
    setState(() => _signed = true);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Biometric authentication successful'),
        backgroundColor: Color(0xFF13EC80),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _acknowledged && _signed;
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Salary Advance Request',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text(
              'Cancel',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFFEF4444),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
        children: [
          // ── Step indicator ────────────────────────────────────────────
          Row(
            children: List.generate(3, (i) {
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: i < 2 ? 4 : 0),
                  decoration: BoxDecoration(
                    color: i < 2
                        ? const Color(0xFF13EC80)
                        : const Color(0xFFE0E0E0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 20),

          // ── Heading ───────────────────────────────────────────────────
          const Text(
            'Deduction Preview & Sign',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Review the schedule below before signing electronically. This action is binding.',
            style: TextStyle(fontSize: 13, color: Color(0xFF666666), height: 1.5),
          ),
          const SizedBox(height: 20),

          // ── Compliance Summary ────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF0FFF6),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF13EC80).withValues(alpha: 0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF13EC80).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'COMPLIANCE SUMMARY',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0BAE5E),
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFD0F5E4)),
                const _ComplianceRow(
                  title: 'Single Active Advance',
                  description: 'No other outstanding advances on record.',
                ),
                const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFE8F9EF)),
                const _ComplianceRow(
                  title: 'Within 50% Cap',
                  description: 'Request is 30% of net monthly salary.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Deduction Schedule ────────────────────────────────────────
          const Row(
            children: [
              Icon(Icons.calendar_today, size: 14, color: Color(0xFF888888)),
              SizedBox(width: 6),
              Text(
                'Deduction Schedule · 3 Months Term',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF333333),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE0E0E0)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                // Header
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
                  ),
                  child: const _TableHeaderRow(),
                ),
                const Divider(height: 1, color: Color(0xFFE0E0E0)),
                ..._schedule.asMap().entries.map((entry) {
                  final i = entry.key;
                  final row = entry.value;
                  return Column(
                    children: [
                      _TableDataRow(
                        month: row.month,
                        deduction: row.deduction,
                        balance: row.balance,
                        isLast: i == _schedule.length - 1,
                      ),
                      if (i < _schedule.length - 1)
                        const Divider(height: 1, color: Color(0xFFEEEEEE)),
                    ],
                  );
                }),
                const Divider(height: 1, color: Color(0xFFE0E0E0)),
                // Footer
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF0FFF6),
                    borderRadius: BorderRadius.vertical(bottom: Radius.circular(11)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Repayment:',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1A1A1A),
                        ),
                      ),
                      Text(
                        '\$3,600.00',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0BAE5E),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Digital Signature ─────────────────────────────────────────
          GestureDetector(
            onTap: _onTapSign,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(
                  color: _signed
                      ? const Color(0xFF13EC80)
                      : const Color(0xFFDDDDDD),
                  width: _signed ? 1.5 : 1,
                ),
                borderRadius: BorderRadius.circular(14),
                color: _signed
                    ? const Color(0xFFF0FFF6)
                    : const Color(0xFFFAFAFA),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(
                    Icons.fingerprint,
                    size: 48,
                    color: _signed
                        ? const Color(0xFF13EC80)
                        : const Color(0xFF999999),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _signed ? 'Signed Successfully' : 'Tap to Sign with Biometrics',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: _signed
                          ? const Color(0xFF0BAE5E)
                          : const Color(0xFF333333),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'This action is authenticated by SADC SecureID',
                    style: TextStyle(fontSize: 11, color: Color(0xFF888888)),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: Color(0xFFEEEEEE)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.access_time, size: 12, color: Color(0xFFAAAAAA)),
                      const SizedBox(width: 4),
                      Text(
                        _signed
                            ? 'Signed at ${TimeOfDay.now().format(context)}'
                            : 'Awaiting signature',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFFAAAAAA),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ── Acknowledgement Checkbox ──────────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                    'I acknowledge that deductions will be made automatically from my salary.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF444444), height: 1.4),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFEEEEEE))),
        ),
        child: ElevatedButton.icon(
          onPressed: canSubmit ? () {} : null,
          icon: const Icon(Icons.send, size: 18),
          label: const Text('Submit Request'),
          style: ElevatedButton.styleFrom(
            backgroundColor:
                canSubmit ? const Color(0xFF13EC80) : const Color(0xFFCCCCCC),
            foregroundColor:
                canSubmit ? const Color(0xFF102219) : const Color(0xFF888888),
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 0,
            textStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Data helpers ──────────────────────────────────────────────────────────────
class _DeductionRow {
  final String month;
  final String deduction;
  final String balance;
  const _DeductionRow({
    required this.month,
    required this.deduction,
    required this.balance,
  });
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _ComplianceRow extends StatelessWidget {
  final String title;
  final String description;

  const _ComplianceRow({
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: const BoxDecoration(
              color: Color(0xFF13EC80),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check, size: 14, color: Color(0xFF102219)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF666666)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TableHeaderRow extends StatelessWidget {
  const _TableHeaderRow();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              'Month',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF888888),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              'Deduction',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF888888),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              'Balance',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF888888),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TableDataRow extends StatelessWidget {
  final String month;
  final String deduction;
  final String balance;
  final bool isLast;

  const _TableDataRow({
    required this.month,
    required this.deduction,
    required this.balance,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              month,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF333333),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              deduction,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1A1A1A),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              balance,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isLast
                    ? const Color(0xFF13EC80)
                    : const Color(0xFF1A1A1A),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
