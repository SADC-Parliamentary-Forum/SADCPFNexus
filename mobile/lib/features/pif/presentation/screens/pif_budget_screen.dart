import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class PifBudgetScreen extends StatefulWidget {
  const PifBudgetScreen({super.key});

  @override
  State<PifBudgetScreen> createState() => _PifBudgetScreenState();
}

class _PifBudgetScreenState extends State<PifBudgetScreen> {
  String? _selectedLine;
  final _amountCtrl = TextEditingController();
  final _justCtrl = TextEditingController();
  bool _submitting = false;

  final _budgetLines = [
    {'code': 'GL-2026-PROG-MEETINGS',   'label': 'Programme – Meetings & Conferences',  'available': 'N\$142,000.00'},
    {'code': 'GL-2026-PROG-WORKSHOPS',  'label': 'Programme – Workshops & Training',     'available': 'N\$67,500.00'},
    {'code': 'GL-2026-OPS-ADMIN',       'label': 'Operations – General Administration',  'available': 'N\$38,200.00'},
    {'code': 'GL-2026-ICT-EQUIPMENT',   'label': 'ICT – Equipment & Licensing',          'available': 'N\$29,750.00'},
    {'code': 'GL-2026-REGIONAL-TRAVEL', 'label': 'Regional – Travel & Per Diem',         'available': 'N\$215,000.00'},
  ];

  bool get _valid => _selectedLine != null && _amountCtrl.text.trim().isNotEmpty && _justCtrl.text.trim().length >= 20;

  void _submit() {
    if (!_valid) return;
    setState(() => _submitting = true);
    Future.delayed(const Duration(milliseconds: 1000), () {
      if (!mounted) return;
      setState(() => _submitting = false);
      showDialog(context: context, builder: (_) => AlertDialog(
        backgroundColor: AppColors.bgSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 56, height: 56,
            decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle, color: AppColors.success, size: 28)),
          const SizedBox(height: 12),
          const Text('Budget Line Assigned', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text('The budget commitment has been linked to your PIF.', textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        ]),
        actions: [
          TextButton(
            onPressed: () { Navigator.pop(context); Navigator.pop(context); },
            child: const Text('Done', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ));
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _justCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('PIF Budget Commitment', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Context card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.12), AppColors.bgCard]),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: const Row(children: [
              Icon(Icons.account_balance_outlined, color: AppColors.primary, size: 20),
              SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('PIF: SADC-PIF-2026-0012', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                Text('Regional Governance Workshop — Harare', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ])),
            ]),
          ),
          const SizedBox(height: 20),

          const Text('SELECT BUDGET LINE', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          // Budget line selector
          ..._budgetLines.map((line) {
            final isSelected = _selectedLine == line['code'];
            return GestureDetector(
              onTap: () => setState(() => _selectedLine = line['code']),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary.withValues(alpha: 0.08) : AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: isSelected ? AppColors.primary.withValues(alpha: 0.4) : AppColors.border, width: isSelected ? 1.5 : 1),
                ),
                child: Row(children: [
                  Container(width: 20, height: 20, decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected ? AppColors.primary : Colors.transparent,
                    border: Border.all(color: isSelected ? AppColors.primary : AppColors.border, width: 1.5)),
                    child: isSelected ? const Icon(Icons.check, color: Colors.white, size: 12) : null),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(line['label']!, style: TextStyle(color: isSelected ? AppColors.primary : AppColors.textPrimary,
                      fontSize: 12, fontWeight: FontWeight.w600)),
                    Text('${line['code']}  ·  Available: ${line['available']}',
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                  ])),
                ]),
              ),
            );
          }),

          const SizedBox(height: 20),
          const Text('COMMITTED AMOUNT', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: InputDecoration(
              prefixText: 'N\$  ',
              prefixStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
              hintText: '0.00',
              hintStyle: const TextStyle(color: AppColors.textMuted),
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 20),

          const Text('JUSTIFICATION', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),

          TextField(
            controller: _justCtrl,
            maxLines: 4,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Explain why this budget line applies and how funds will be used...',
              hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 12),
              filled: true,
              fillColor: AppColors.bgSurface,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 1.5)),
              contentPadding: const EdgeInsets.all(14),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 30),

          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: (_valid && !_submitting) ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.bgCard,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: _submitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.link_outlined, size: 18),
              label: Text(_submitting ? 'Committing...' : 'Commit Budget',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
