import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class PayslipScreen extends StatefulWidget {
  const PayslipScreen({super.key});

  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

class _PayslipScreenState extends State<PayslipScreen> {
  int _selectedMonth = 1; // 0 = Mar, 1 = Feb, 2 = Jan

  final _months = ['March 2026', 'February 2026', 'January 2026'];

  final _earnings = [
    {'label': 'Basic Salary',         'amount': 28500.00},
    {'label': 'Housing Allowance',    'amount': 4200.00},
    {'label': 'Transport Allowance',  'amount': 1800.00},
    {'label': 'Medical Allowance',    'amount': 1200.00},
    {'label': 'Overtime (10 hrs)',    'amount': 890.00},
  ];

  final _deductions = [
    {'label': 'PAYE Tax',             'amount': 7240.00},
    {'label': 'SSCOM Pension (7.5%)', 'amount': 2137.50},
    {'label': 'Medical Aid (PSEMAS)', 'amount': 1100.00},
    {'label': 'Staff Loan Repayment', 'amount': 800.00},
  ];

  double get _grossPay => _earnings.fold(0.0, (s, e) => s + (e['amount'] as double));
  double get _totalDeductions => _deductions.fold(0.0, (s, d) => s + (d['amount'] as double));
  double get _netPay => _grossPay - _totalDeductions;

  String _fmt(double v) => 'N\$${v.toStringAsFixed(2).replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+\.)'), (m) => '${m[1]},')}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Payslip', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.download_outlined, color: AppColors.primary, size: 16),
            label: const Text('PDF', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Period selector
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(children: List.generate(_months.length, (i) => Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _selectedMonth = i),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: _selectedMonth == i ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Text(_months[i].split(' ')[0],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _selectedMonth == i ? Colors.white : AppColors.textMuted,
                      fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ),
            ))),
          ),
          const SizedBox(height: 16),

          // Pay summary hero
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.bgCard]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Column(children: [
              Text(_months[_selectedMonth], style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              const SizedBox(height: 8),
              Text(_fmt(_netPay), style: const TextStyle(color: AppColors.primary, fontSize: 30, fontWeight: FontWeight.w900)),
              const Text('Net Pay', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 16),
              Row(children: [
                _heroPill('Gross', _fmt(_grossPay), AppColors.success),
                Container(width: 1, height: 40, color: AppColors.border),
                _heroPill('Deductions', _fmt(_totalDeductions), AppColors.danger),
              ]),
            ]),
          ),
          const SizedBox(height: 16),

          // Earnings
          _section(
            title: 'Earnings',
            icon: Icons.trending_up,
            color: AppColors.success,
            items: _earnings,
            total: _grossPay,
            totalLabel: 'Gross Pay',
          ),
          const SizedBox(height: 12),

          // Deductions
          _section(
            title: 'Deductions',
            icon: Icons.trending_down,
            color: AppColors.danger,
            items: _deductions,
            total: _totalDeductions,
            totalLabel: 'Total Deductions',
          ),
          const SizedBox(height: 12),

          // YTD summary
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [
                Icon(Icons.calendar_today_outlined, color: AppColors.info, size: 14),
                SizedBox(width: 8),
                Text('Year-to-Date Summary', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 12),
              _ytdRow('YTD Gross', 'N\$108,590.00'),
              _ytdRow('YTD Tax Paid', 'N\$21,720.00'),
              _ytdRow('YTD Pension', 'N\$6,412.50'),
              _ytdRow('YTD Net', 'N\$65,127.50'),
            ]),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _heroPill(String label, String val, Color color) => Expanded(
    child: Column(children: [
      Text(val, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w800)),
      Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
    ]),
  );

  Widget _section({required String title, required IconData icon, required Color color,
      required List<Map<String, dynamic>> items, required double total, required String totalLabel}) =>
    Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 14)),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 10),
        ...items.map((e) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Expanded(child: Text(e['label'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
            Text(_fmt(e['amount'] as double), style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
          ]),
        )),
        const Divider(color: AppColors.border, height: 20),
        Row(children: [
          Text(totalLabel, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          const Spacer(),
          Text(_fmt(total), style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w800)),
        ]),
      ]),
    );

  Widget _ytdRow(String label, String val) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      const Spacer(),
      Text(val, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
    ]),
  );
}
