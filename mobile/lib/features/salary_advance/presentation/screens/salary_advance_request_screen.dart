import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class SalaryAdvanceRequestScreen extends StatefulWidget {
  const SalaryAdvanceRequestScreen({super.key});

  @override
  State<SalaryAdvanceRequestScreen> createState() =>
      _SalaryAdvanceRequestScreenState();
}

class _SalaryAdvanceRequestScreenState
    extends State<SalaryAdvanceRequestScreen> {
  final _amountController = TextEditingController(text: '2500');
  String _purpose = 'Personal Emergency';
  int _recoveryMonths = 3;
  bool _hasError = false;

  static const double _netSalary = 4500.0;
  static const double _activeAdvances = 0.0;
  static const double _capPercent = 0.5;

  final List<String> _purposes = [
    'Personal Emergency',
    'Medical Expenses',
    'Education',
    'Home Repair',
    'Other',
  ];

  double get _cap => _netSalary * _capPercent;

  double get _requestedAmount {
    return double.tryParse(_amountController.text.replaceAll(',', '')) ?? 0.0;
  }

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_validate);
    _validate();
  }

  void _validate() {
    setState(() {
      _hasError = _requestedAmount > _cap;
    });
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  String _fmt(double v) =>
      '\$${v.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

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
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Column(
          children: [
            Text(
              'Request Advance',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1A1A1A),
              ),
            ),
          ],
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline, size: 20, color: Color(0xFF666666)),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(28),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF13EC80),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'STEP 1 OF 3 · Eligibility & Amount',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF13EC80),
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 100),
        children: [
          // ── Heading ──────────────────────────────────────────────────
          const Text(
            'Check Eligibility',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Review your salary context and specify the advance details. Max allowed is 50% of net salary.',
            style: TextStyle(fontSize: 13, color: Color(0xFF666666), height: 1.5),
          ),
          const SizedBox(height: 20),

          // ── Salary Context Card ───────────────────────────────────────
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
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF13EC80).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'SALARY CONTEXT',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0BAE5E),
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFD0F5E4)),
                IntrinsicHeight(
                  child: Row(
                    children: [
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Monthly Net Salary',
                                style: TextStyle(fontSize: 11, color: Color(0xFF666666)),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _fmt(_netSalary),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1A1A1A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      VerticalDivider(
                        width: 1,
                        color: const Color(0xFF13EC80).withValues(alpha: 0.3),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Active Advances',
                                style: TextStyle(fontSize: 11, color: Color(0xFF666666)),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _fmt(_activeAdvances),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1A1A1A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Requested Amount ──────────────────────────────────────────
          const Text(
            'Requested Amount',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF333333),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: _hasError
                    ? const Color(0xFFEF4444)
                    : const Color(0xFFDDDDDD),
                width: _hasError ? 1.5 : 1,
              ),
              borderRadius: BorderRadius.circular(12),
              color: Colors.white,
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(11),
                      bottomLeft: Radius.circular(11),
                    ),
                  ),
                  child: const Text(
                    '\$',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF666666),
                    ),
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _amountController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A1A),
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Error Banner ──────────────────────────────────────────────
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 200),
            crossFadeState:
                _hasError ? CrossFadeState.showFirst : CrossFadeState.showSecond,
            firstChild: Container(
              margin: const EdgeInsets.only(top: 10),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Amount exceeds 50% cap (${_fmt(_cap)}). Please reduce the amount.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFFEF4444),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            secondChild: const SizedBox.shrink(),
          ),
          const SizedBox(height: 20),

          // ── Purpose Dropdown ──────────────────────────────────────────
          const Text(
            'Purpose of Advance',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF333333),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFDDDDDD)),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _purpose,
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF888888)),
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF1A1A1A),
                  fontFamily: 'PublicSans',
                ),
                items: _purposes.map((p) {
                  return DropdownMenuItem(value: p, child: Text(p));
                }).toList(),
                onChanged: (v) => setState(() => _purpose = v!),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // ── Recovery Period Slider ────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Recovery Period',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF333333),
                ),
              ),
              Text(
                '$_recoveryMonths Months',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF13EC80),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: const Color(0xFF13EC80),
              inactiveTrackColor: const Color(0xFFE0E0E0),
              thumbColor: const Color(0xFF13EC80),
              overlayColor: const Color(0xFF13EC80).withValues(alpha: 0.1),
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
            ),
            child: Slider(
              value: _recoveryMonths.toDouble(),
              min: 1,
              max: 6,
              divisions: 5,
              onChanged: (v) => setState(() => _recoveryMonths = v.round()),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (i) {
              final m = i + 1;
              final isSelected = m == _recoveryMonths;
              return Text(
                '${m}Mo',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                  color: isSelected
                      ? const Color(0xFF13EC80)
                      : const Color(0xFF999999),
                ),
              );
            }),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Color(0xFF888888)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Payments will be deducted automatically starting from next month\'s salary.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF888888), height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFEEEEEE))),
        ),
        child: ElevatedButton.icon(
          onPressed: _hasError ? null : () {},
          icon: const Icon(Icons.arrow_forward, size: 18),
          label: const Text('Next Step'),
          style: ElevatedButton.styleFrom(
            backgroundColor:
                _hasError ? const Color(0xFFCCCCCC) : const Color(0xFF13EC80),
            foregroundColor:
                _hasError ? const Color(0xFF888888) : const Color(0xFF102219),
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 0,
            textStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              fontFamily: 'PublicSans',
            ),
          ),
        ),
      ),
    );
  }
}
