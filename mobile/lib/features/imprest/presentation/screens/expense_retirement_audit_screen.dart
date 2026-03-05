import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class ExpenseRetirementAuditScreen extends StatelessWidget {
  const ExpenseRetirementAuditScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Audit Summary', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [IconButton(icon: const Icon(Icons.more_vert, color: AppColors.textSecondary), onPressed: () {})],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [
            const Text('SETTLEMENT SUMMARY', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
            const Spacer(),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
              child: const Text('Overpaid', style: TextStyle(color: AppColors.warning, fontSize: 10, fontWeight: FontWeight.w700))),
          ]),
          const SizedBox(height: 8),
          const Text('Regional Summit 2023', style: TextStyle(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
          const Text('Ref: SADC-PT-23-089', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 12),
          const Text('-N\$1,240.00', style: TextStyle(color: AppColors.danger, fontSize: 28, fontWeight: FontWeight.w900)),
          const Text('Final Budget Variance', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.success.withValues(alpha: 0.3))),
            child: const Row(children: [
              Icon(Icons.link, color: AppColors.success, size: 16),
              SizedBox(width: 8),
              Text('Audit Trail: Verified', style: TextStyle(color: AppColors.success, fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
          ),
          const SizedBox(height: 16),
          _card(children: [
            const _SecHeader('Actual vs. Imprest'),
            _lineItem('Air Travel', 'N\$2,450.00', 'N\$2,150.00', AppColors.success),
            _lineItem('Accommodation', 'N\$1,300.00', 'N\$1,800.00', AppColors.danger),
            _lineItem('Per Diem', 'N\$500.00', 'N\$600.00', AppColors.danger),
            Padding(padding: const EdgeInsets.fromLTRB(14,8,14,8),
              child: GestureDetector(onTap: () {}, child: const Text('View Full Breakdown', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)))),
          ]),
          const SizedBox(height: 12),
          _card(children: [
            const _SecHeader('Evidence Vault'),
            Padding(padding: const EdgeInsets.fromLTRB(14,8,14,14),
              child: Row(children: [
                ...List.generate(3, (i) => Container(
                  margin: const EdgeInsets.only(right: 8),
                  width: 56, height: 56,
                  decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
                  child: const Icon(Icons.image, color: AppColors.textMuted, size: 24),
                )),
                Container(width: 56, height: 56,
                  decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
                  child: const Center(child: Text('+5\nMore', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.w700)))),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          _card(children: [
            const _SecHeader('Final Sign-off'),
            Padding(padding: const EdgeInsets.all(14), child: Row(children: [
              Expanded(child: Column(children: [
                const Text('EMPLOYEE', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Container(height: 40, decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(8))),
                const SizedBox(height: 6),
                const Icon(Icons.check_circle, color: AppColors.success, size: 16),
              ])),
              const SizedBox(width: 16),
              Expanded(child: Column(children: [
                const Text('FINANCE OFFICER', style: TextStyle(color: AppColors.textMuted, fontSize: 9, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Container(height: 40, decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(8))),
                const SizedBox(height: 6),
                const Icon(Icons.check_circle, color: AppColors.success, size: 16),
              ])),
            ])),
            const Padding(padding: EdgeInsets.fromLTRB(14,0,14,14),
              child: Text('Signed Oct 26, 2023', style: TextStyle(color: AppColors.textMuted, fontSize: 10))),
          ]),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, height: 50,
            child: ElevatedButton.icon(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              icon: const Icon(Icons.archive_outlined, size: 18),
              label: const Text('Archive to WORM Storage', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 8),
          const Center(child: Text('WORM Archive ensures your financial record cannot be modified.', style: TextStyle(color: AppColors.textMuted, fontSize: 10), textAlign: TextAlign.center)),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) => Container(
    margin: const EdgeInsets.only(bottom: 2),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _lineItem(String label, String imprest, String actual, Color actualColor) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
      Text(imprest, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
      const SizedBox(width: 16),
      Text(actual, style: TextStyle(color: actualColor, fontSize: 12, fontWeight: FontWeight.w600)),
    ]),
  );
}

class _SecHeader extends StatelessWidget {
  final String title;
  const _SecHeader(this.title);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
    child: Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
  );
}
