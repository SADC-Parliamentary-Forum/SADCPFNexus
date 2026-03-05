import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class PlenaryResolutionDashboardScreen extends StatelessWidget {
  const PlenaryResolutionDashboardScreen({super.key});

  final _resolutions = const [
    {'ref': 'SADC-PF/P4/R001/2026', 'title': 'Regional Digital Infrastructure Framework', 'session': '4th Plenary', 'date': '28 Feb 2026', 'status': 'Adopted', 'votes': '36/42', 'category': 'Technology'},
    {'ref': 'SADC-PF/P4/R002/2026', 'title': 'Cross-Border Trade Harmonisation Protocol', 'session': '4th Plenary', 'date': '28 Feb 2026', 'status': 'Adopted', 'votes': '40/42', 'category': 'Trade'},
    {'ref': 'SADC-PF/P4/R003/2026', 'title': 'Youth Employment Initiative 2026–2030', 'session': '4th Plenary', 'date': '28 Feb 2026', 'status': 'Deferred', 'votes': '—', 'category': 'Social'},
    {'ref': 'SADC-PF/P3/R012/2025', 'title': 'Climate Resilience Fund Establishment', 'session': '3rd Plenary', 'date': '10 Oct 2025', 'status': 'Implemented', 'votes': '38/40', 'category': 'Environment'},
    {'ref': 'SADC-PF/P3/R013/2025', 'title': 'Strengthening Parliamentary Oversight', 'session': '3rd Plenary', 'date': '10 Oct 2025', 'status': 'In Progress', 'votes': '35/40', 'category': 'Governance'},
  ];

  Color _statusColor(String s) {
    if (s == 'Adopted' || s == 'Implemented') return AppColors.success;
    if (s == 'In Progress') return AppColors.primary;
    if (s == 'Deferred') return AppColors.warning;
    return AppColors.danger;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Plenary Resolutions', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.filter_list, color: AppColors.textSecondary), onPressed: () {}),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Stats banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.bgSurface]),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('4th Plenary Session — Feb 2026', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
              const Text('Windhoek, Namibia', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              const SizedBox(height: 14),
              Row(children: [
                _kpiPill('Total', '${_resolutions.length}', AppColors.textPrimary),
                const SizedBox(width: 8),
                _kpiPill('Adopted', '${_resolutions.where((r) => r['status'] == 'Adopted').length}', AppColors.success),
                const SizedBox(width: 8),
                _kpiPill('In Progress', '${_resolutions.where((r) => r['status'] == 'In Progress').length}', AppColors.primary),
                const SizedBox(width: 8),
                _kpiPill('Deferred', '${_resolutions.where((r) => r['status'] == 'Deferred').length}', AppColors.warning),
              ]),
            ]),
          ),
          const SizedBox(height: 20),
          const Text('ALL RESOLUTIONS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          ..._resolutions.map((r) => _resolutionCard(context, r)),
        ],
      ),
    );
  }

  Widget _kpiPill(String label, String val, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
    child: Column(children: [
      Text(val, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800)),
      Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
    ]),
  );

  Widget _resolutionCard(BuildContext context, Map<String, dynamic> r) {
    final statusColor = _statusColor(r['status'] as String);
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/governance/resolutions/details'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(r['ref'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w600))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(r['status'] as String, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700))),
          ]),
          const SizedBox(height: 6),
          Text(r['title'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(4)),
              child: Text(r['category'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 10))),
            const SizedBox(width: 8),
            const Icon(Icons.event_outlined, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 4),
            Text('${r['session']}  ·  ${r['date']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            const Spacer(),
            if (r['votes'] != '—') ...[
              const Icon(Icons.how_to_vote_outlined, color: AppColors.textMuted, size: 12),
              const SizedBox(width: 4),
              Text(r['votes'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            ],
          ]),
        ]),
      ),
    );
  }
}
