import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class ImprestDetailScreen extends StatelessWidget {
  const ImprestDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Imprest Request', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined, color: AppColors.textSecondary), onPressed: () {}),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.warning.withValues(alpha: 0.1), AppColors.bgSurface]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.access_time, color: AppColors.warning, size: 12),
                    SizedBox(width: 4),
                    Text('Pending Retirement', style: TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.w700)),
                  ])),
                const Spacer(),
                const Text('REF: SADC-IMP-2026-0033', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ]),
              const SizedBox(height: 12),
              const Text('Workshop Facilitation Costs', style: TextStyle(color: AppColors.textPrimary, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Approved 01 Mar 2026  ·  Retire by 15 Apr 2026', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ),
          const SizedBox(height: 16),

          // Imprest details
          _card(children: [
            _secHeader('Imprest Details', Icons.account_balance_wallet_outlined, AppColors.warning),
            _row('Purpose', 'Workshop Facilitation Costs'),
            _row('Budget Line', 'GL-2026-PROG-WORKSHOPS'),
            _row('Advance Period', '05 Mar – 07 Mar 2026'),
            _row('Requested', 'N\$4,500.00'),
            _row('Disbursed', 'N\$4,500.00'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),

          // Liquidation progress
          _card(children: [
            _secHeader('Retirement Progress', Icons.pie_chart_outline, AppColors.primary),
            const SizedBox(height: 4),
            const Padding(padding: EdgeInsets.symmetric(horizontal: 14),
              child: Row(children: [
                Text('Retired', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                Spacer(),
                Text('N\$2,100.00 / N\$4,500.00', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w700)),
              ])),
            const SizedBox(height: 8),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 14),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: const LinearProgressIndicator(
                  value: 2100 / 4500,
                  minHeight: 8,
                  backgroundColor: AppColors.bgCard,
                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                ),
              )),
            const SizedBox(height: 8),
            Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(children: [
                _badge('Retired: N\$2,100', AppColors.success),
                const SizedBox(width: 8),
                _badge('Pending: N\$2,400', AppColors.warning),
              ])),
          ]),
          const SizedBox(height: 12),

          // Expense breakdown
          _card(children: [
            _secHeader('Expense Breakdown', Icons.receipt_long_outlined, AppColors.gold),
            _expRow('Venue Hire', 'N\$1,200.00', true),
            _expRow('Catering (Day 1)', 'N\$450.00', true),
            _expRow('Catering (Day 2)', 'N\$450.00', true),
            _expRow('Stationery & Printing', 'N\$320.00', false),
            _expRow('Ground Transport', 'N\$680.00', false),
            const Divider(color: AppColors.border, height: 20, indent: 14, endIndent: 14),
            const Padding(padding: EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(children: [
                Text('Total Spent', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                Spacer(),
                Text('N\$3,100.00', style: TextStyle(color: AppColors.primary, fontSize: 15, fontWeight: FontWeight.w800)),
              ])),
          ]),
          const SizedBox(height: 12),

          // Approval chain
          _card(children: [
            _secHeader('Approval Chain', Icons.account_tree_outlined, AppColors.info),
            _approvalStep('Supervisor', 'James Mwape', true, false),
            _approvalStep('Finance Officer', 'Amelia Dos Santos', true, false),
            _approvalStep('Finance Retirement', 'Pending submission', false, true),
          ]),
          const SizedBox(height: 20),

          // Refund/balance notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
            ),
            child: const Row(children: [
              Icon(Icons.info_outline, color: AppColors.info, size: 16),
              SizedBox(width: 10),
              Expanded(child: Text('Estimated refund of N\$1,400.00 due on retirement.',
                style: TextStyle(color: AppColors.info, fontSize: 12))),
            ]),
          ),
          const SizedBox(height: 20),

          // Actions
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              onPressed: () {},
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.cancel_outlined, size: 16),
              label: const Text('Withdraw', style: TextStyle(fontWeight: FontWeight.w700)),
            )),
            const SizedBox(width: 12),
            Expanded(child: ElevatedButton.icon(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.receipt_long_outlined, size: 16),
              label: const Text('Submit Retirement', style: TextStyle(fontWeight: FontWeight.w700)),
            )),
          ]),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) => Container(
    margin: const EdgeInsets.only(bottom: 0),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _secHeader(String title, IconData icon, Color color) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
    child: Row(children: [
      Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: color, size: 14)),
      const SizedBox(width: 8),
      Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
    ]),
  );

  Widget _row(String label, String val) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 120, child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
      Expanded(child: Text(val, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500))),
    ]),
  );

  Widget _expRow(String item, String amount, bool retired) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 5, 14, 5),
    child: Row(children: [
      Container(width: 6, height: 6, decoration: BoxDecoration(
        color: retired ? AppColors.success : AppColors.textMuted,
        shape: BoxShape.circle)),
      const SizedBox(width: 10),
      Expanded(child: Text(item, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
      Text(amount, style: TextStyle(color: retired ? AppColors.success : AppColors.textMuted,
        fontSize: 12, fontWeight: FontWeight.w600)),
      const SizedBox(width: 6),
      Icon(retired ? Icons.check_circle : Icons.radio_button_unchecked,
        color: retired ? AppColors.success : AppColors.border, size: 14),
    ]),
  );

  Widget _badge(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
    child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)),
  );

  Widget _approvalStep(String role, String name, bool done, bool isLast) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
    child: Row(children: [
      Column(children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(
          color: done ? AppColors.success.withValues(alpha: 0.1) : AppColors.bgCard,
          shape: BoxShape.circle,
          border: Border.all(color: done ? AppColors.success : AppColors.border)),
          child: Icon(done ? Icons.check : Icons.hourglass_empty, color: done ? AppColors.success : AppColors.textMuted, size: 14)),
        if (!isLast) Container(width: 1, height: 20, color: AppColors.border),
      ]),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        Text(role, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
      ])),
      if (done) const Text('Approved', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w600)),
      if (!done && !isLast) const Text('Pending', style: TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.w600)),
      if (isLast) const Text('Awaiting', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
    ]),
  );
}
