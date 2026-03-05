import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class ExpenseRetirementScreen extends StatefulWidget {
  const ExpenseRetirementScreen({super.key});
  @override
  State<ExpenseRetirementScreen> createState() => _ExpenseRetirementScreenState();
}

class _ExpenseRetirementScreenState extends State<ExpenseRetirementScreen> {
  final _items = [
    {'label': 'Air Travel', 'date': 'Oct 24 · Receipt', 'amount': 850.0, 'icon': Icons.flight},
    {'label': 'Accommodation', 'date': '3 Nights', 'amount': 400.0, 'icon': Icons.hotel},
    {'label': 'Meals & Per Diem', 'date': '5 Days 30...', 'amount': 100.0, 'icon': Icons.restaurant},
  ];
  double get _total => _items.fold(0, (s, i) => s + (i['amount'] as double));
  double get _variance => 1500.0 - _total;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Expense Retirement', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [TextButton(onPressed: () {}, child: const Text('HELP', style: TextStyle(color: AppColors.info, fontWeight: FontWeight.w700)))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Step 2 of 2: Retire Imprest', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text('Reconcile Expenses', style: TextStyle(color: AppColors.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          // Summary bar
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Initial Issued', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                const Text('N\$1,500.00', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w800)),
              ])),
              Container(width: 1, height: 36, color: AppColors.border),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                const Text('Total Spent', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                Text('N\$${_total.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.w800)),
              ])),
            ]),
          ),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Line Items', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
            GestureDetector(onTap: () {}, child: const Text('+ Addition', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600))),
          ]),
          const SizedBox(height: 10),
          ...(_items.map((item) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                child: Icon(item['icon'] as IconData, color: AppColors.primary, size: 18)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item['label'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
                Text(item['date'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ])),
              Text('N\$${(item['amount'] as double).toStringAsFixed(2)}', style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            ]),
          ))),
          // Receipt scan
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border, style: BorderStyle.solid)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Receipts & Evidence', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Container(
                height: 80,
                decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                child: const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.camera_alt_outlined, color: AppColors.primary, size: 28),
                  SizedBox(height: 6),
                  Text('Scan Receipt with OCR', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  Text('Camera will auto-detect receipts and claims', style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                ])),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          // Variance
          if (_variance != 0) Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _variance > 0 ? AppColors.success.withValues(alpha: 0.1) : AppColors.danger.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: (_variance > 0 ? AppColors.success : AppColors.danger).withValues(alpha: 0.3)),
            ),
            child: Row(children: [
              Icon(_variance > 0 ? Icons.arrow_upward : Icons.arrow_downward, color: _variance > 0 ? AppColors.success : AppColors.danger, size: 18),
              const SizedBox(width: 10),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${_variance > 0 ? '+' : ''}N\$${_variance.abs().toStringAsFixed(2)} ${_variance > 0 ? 'Refund Due to Forum' : 'Overspent'}',
                  style: TextStyle(color: _variance > 0 ? AppColors.success : AppColors.danger, fontSize: 13, fontWeight: FontWeight.w700)),
                Text(_variance > 0 ? 'You have spent less than the initial imprest.' : 'Amount exceeds issued imprest.',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ]),
            ]),
          ),
          const SizedBox(height: 12),
          // Digital signature
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Authorization', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.verified, color: AppColors.primary, size: 16),
                const SizedBox(width: 8),
                const Text('DIGITAL SIGNATURE · Biometric Verified', style: TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ]),
          ),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, height: 50,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              child: const Text('Submit for Approval →', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
