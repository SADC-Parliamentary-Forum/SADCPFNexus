import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class ExecutiveCockpitScreen extends StatelessWidget {
  const ExecutiveCockpitScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Executive Cockpit', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: AppColors.textSecondary), onPressed: () {}),
          Container(margin: const EdgeInsets.only(right: 12), width: 32, height: 32,
            decoration: const BoxDecoration(color: AppColors.gold, shape: BoxShape.circle),
            child: const Center(child: Text('SG', style: TextStyle(color: Color(0xFF102219), fontSize: 11, fontWeight: FontWeight.w800)))),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Welcome
          const Text('Good afternoon, Secretary General', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 2),
          const Text('Institutional Overview', style: TextStyle(color: AppColors.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Wednesday, 04 March 2026', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 20),
          // Alert banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.danger.withValues(alpha: 0.25))),
            child: Row(children: [
              const Icon(Icons.priority_high, color: AppColors.danger, size: 18),
              const SizedBox(width: 10),
              const Expanded(child: Text('3 items require your immediate approval today.', style: TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600))),
              TextButton(onPressed: () {}, child: const Text('Review', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 12))),
            ]),
          ),
          const SizedBox(height: 20),
          // KPI Grid
          const Text('KEY PERFORMANCE INDICATORS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          GridView.count(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10,
            childAspectRatio: 1.4,
            children: [
              _kpiCard('Budget Utilisation', '74%', AppColors.primary, Icons.account_balance, '+2.1%', true),
              _kpiCard('Pending Approvals', '12', AppColors.warning, Icons.pending_actions, '3 urgent', false),
              _kpiCard('Staff Compliance', '96%', AppColors.success, Icons.verified_user, '+0.5%', true),
              _kpiCard('Open Procurements', '8', AppColors.info, Icons.inventory_2_outlined, '2 urgent', false),
            ],
          ),
          const SizedBox(height: 20),
          // Quick actions
          const Text('PENDING SIGN-OFF', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          _approvalCard('Mission Approval – Harare Summit', 'James K. · Travel · N\$18,500', AppColors.primary, Icons.flight_takeoff),
          _approvalCard('Q1 Budget Reallocation', 'Finance Dept · N\$250,000', AppColors.warning, Icons.account_balance_wallet_outlined),
          _approvalCard('Staff Salary Advance', 'Sarah M. · HR · N\$8,000', AppColors.info, Icons.savings_outlined),
          const SizedBox(height: 20),
          // Module health
          const Text('MODULE HEALTH', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          _healthRow('Finance & Budget', 0.92, AppColors.success),
          _healthRow('HR & Payroll', 0.88, AppColors.success),
          _healthRow('Procurement', 0.71, AppColors.warning),
          _healthRow('Governance', 0.95, AppColors.success),
          _healthRow('Asset Management', 0.64, AppColors.warning),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _kpiCard(String label, String value, Color color, IconData icon, String trend, bool positive) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Container(width: 28, height: 28,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, color: color, size: 14)),
        const Spacer(),
        Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: (positive ? AppColors.success : AppColors.danger).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
          child: Text(trend, style: TextStyle(color: positive ? AppColors.success : AppColors.danger, fontSize: 9, fontWeight: FontWeight.w700))),
      ]),
      const Spacer(),
      Text(value, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w900)),
      Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10), overflow: TextOverflow.ellipsis),
    ]),
  );

  Widget _approvalCard(String title, String sub, Color color, IconData icon) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Container(width: 40, height: 40,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: color, size: 20)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
        Text(sub, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
      ])),
      const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
    ]),
  );

  Widget _healthRow(String module, double score, Color color) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Expanded(child: Text(module, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
      const SizedBox(width: 10),
      Expanded(flex: 2, child: ClipRRect(borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(value: score, minHeight: 6,
          backgroundColor: AppColors.bgSurface, valueColor: AlwaysStoppedAnimation(color)))),
      const SizedBox(width: 10),
      Text('${(score * 100).round()}%', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
    ]),
  );
}
