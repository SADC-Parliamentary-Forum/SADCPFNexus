import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class GlobalExecutiveSummaryScreen extends StatefulWidget {
  const GlobalExecutiveSummaryScreen({super.key});
  @override
  State<GlobalExecutiveSummaryScreen> createState() => _GlobalExecutiveSummaryScreenState();
}

class _GlobalExecutiveSummaryScreenState extends State<GlobalExecutiveSummaryScreen> {
  String _period = 'Q1 2026';
  final _periods = ['Q1 2026', 'Q4 2025', 'Q3 2025', 'FY 2025'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Global Summary', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          PopupMenuButton<String>(
            color: AppColors.bgSurface,
            onSelected: (v) => setState(() => _period = v),
            child: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(_period, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_drop_down, color: AppColors.textMuted, size: 16),
              ]),
            ),
            itemBuilder: (_) => _periods.map((p) => PopupMenuItem(value: p, child: Text(p, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13)))).toList(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header summary card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.bgCard]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(width: 32, height: 32,
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.analytics_outlined, color: AppColors.primary, size: 18)),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Executive Intelligence', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700)),
                  Text(_period, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                ]),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: _heroStat('Total Expenditure', 'N\$4.2M', AppColors.primary)),
                Container(width: 1, height: 48, color: AppColors.border),
                Expanded(child: _heroStat('Budget Remaining', 'N\$1.8M', AppColors.success)),
                Container(width: 1, height: 48, color: AppColors.border),
                Expanded(child: _heroStat('Utilisation', '70%', AppColors.gold)),
              ]),
            ]),
          ),
          const SizedBox(height: 20),
          // Section: Financial
          _sectionHeader('Financial Overview', Icons.account_balance_outlined, AppColors.primary),
          const SizedBox(height: 10),
          _barChartCard([
            _BarData('Jan', 0.55, AppColors.primary),
            _BarData('Feb', 0.72, AppColors.primary),
            _BarData('Mar', 0.48, AppColors.primary),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _metricCard('Travel', 'N\$820K', '32%', AppColors.info)),
            const SizedBox(width: 8),
            Expanded(child: _metricCard('Procurement', 'N\$1.2M', '46%', AppColors.gold)),
            const SizedBox(width: 8),
            Expanded(child: _metricCard('HR & Payroll', 'N\$2.1M', '22% over', AppColors.danger)),
          ]),
          const SizedBox(height: 20),
          // Section: HR
          _sectionHeader('Human Resources', Icons.people_outline, AppColors.success),
          const SizedBox(height: 10),
          _summaryRow('Total Staff', '142', null),
          _summaryRow('Leave Taken', '38 days avg', null),
          _summaryRow('Overtime Hours', '1,240 hrs', AppColors.warning),
          _summaryRow('Compliance Score', '96%', AppColors.success),
          const SizedBox(height: 20),
          // Section: Governance
          _sectionHeader('Governance', Icons.gavel_outlined, AppColors.gold),
          const SizedBox(height: 10),
          _summaryRow('Resolutions Adopted', '14', AppColors.success),
          _summaryRow('In Progress', '6', AppColors.primary),
          _summaryRow('Overdue', '2', AppColors.danger),
          _summaryRow('Meetings Held', '9', null),
          const SizedBox(height: 20),
          // Export
          SizedBox(width: double.infinity, height: 50,
            child: ElevatedButton.icon(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
              label: const Text('Export PDF Report', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _heroStat(String label, String val, Color color) => Column(children: [
    Text(val, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9), textAlign: TextAlign.center),
  ]);

  Widget _sectionHeader(String title, IconData icon, Color color) => Row(children: [
    Container(padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
      child: Icon(icon, color: color, size: 16)),
    const SizedBox(width: 8),
    Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
  ]);

  Widget _barChartCard(List<_BarData> bars) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Monthly Spend', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
      const SizedBox(height: 16),
      Row(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.spaceAround, children: bars.map((b) => Column(children: [
        Container(width: 36, height: 80 * b.value,
          decoration: BoxDecoration(color: b.color.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(6))),
        const SizedBox(height: 6),
        Text(b.label, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
      ])).toList()),
    ]),
  );

  Widget _metricCard(String label, String val, String sub, Color color) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(val, style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w800)),
      Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 10, fontWeight: FontWeight.w600)),
      Text(sub, style: TextStyle(color: color, fontSize: 9)),
    ]),
  );

  Widget _summaryRow(String label, String val, Color? color) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(children: [
      Expanded(child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
      Text(val, style: TextStyle(color: color ?? AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
    ]),
  );
}

class _BarData {
  final String label;
  final double value;
  final Color color;
  const _BarData(this.label, this.value, this.color);
}
