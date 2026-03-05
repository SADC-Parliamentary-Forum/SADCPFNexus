import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class ResolutionsOversightScreen extends StatefulWidget {
  const ResolutionsOversightScreen({super.key});
  @override
  State<ResolutionsOversightScreen> createState() => _ResolutionsOversightScreenState();
}

class _ResolutionsOversightScreenState extends State<ResolutionsOversightScreen> {
  final _milestones = [
    {'ref': 'SADC-PF/P3/R012/2025', 'title': 'Climate Resilience Fund', 'progress': 0.85, 'due': '30 Jun 2026', 'owner': 'Finance Dept', 'overdue': false},
    {'ref': 'SADC-PF/P3/R013/2025', 'title': 'Parliamentary Oversight Strengthening', 'progress': 0.45, 'due': '31 Dec 2025', 'owner': 'Secretariat', 'overdue': true},
    {'ref': 'SADC-PF/P2/R007/2025', 'title': 'Gender Mainstreaming Policy', 'progress': 1.0, 'due': '28 Feb 2026', 'owner': 'HR Division', 'overdue': false},
    {'ref': 'SADC-PF/P2/R009/2025', 'title': 'ICT Infrastructure Audit', 'progress': 0.6, 'due': '31 Mar 2026', 'owner': 'IT Dept', 'overdue': false},
    {'ref': 'SADC-PF/P1/R003/2024', 'title': 'Staff Training Framework', 'progress': 0.25, 'due': '15 Jan 2026', 'owner': 'HR Division', 'overdue': true},
  ];

  @override
  Widget build(BuildContext context) {
    final overdue = _milestones.where((m) => m['overdue'] as bool).length;
    final completed = _milestones.where((m) => (m['progress'] as double) >= 1.0).length;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Resolutions Oversight', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Health summary
          Row(children: [
            _healthCard('Tracking', '${_milestones.length}', AppColors.primary),
            const SizedBox(width: 10),
            _healthCard('Completed', '$completed', AppColors.success),
            const SizedBox(width: 10),
            _healthCard('Overdue', '$overdue', AppColors.danger),
          ]),
          const SizedBox(height: 20),
          if (overdue > 0) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.danger.withValues(alpha: 0.25))),
              child: Row(children: [
                const Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 18),
                const SizedBox(width: 10),
                Text('$overdue resolution(s) are overdue and require immediate action.',
                  style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600)),
              ]),
            ),
            const SizedBox(height: 16),
          ],
          const Text('IMPLEMENTATION TRACKER', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          ..._milestones.map((m) => _milestoneCard(context, m)),
        ],
      ),
    );
  }

  Widget _healthCard(String label, String val, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Column(children: [
        Text(val, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.w800)),
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ]),
    ),
  );

  Widget _milestoneCard(BuildContext context, Map<String, dynamic> m) {
    final progress = m['progress'] as double;
    final overdue = m['overdue'] as bool;
    final isComplete = progress >= 1.0;
    final progressColor = isComplete ? AppColors.success : (overdue ? AppColors.danger : AppColors.primary);
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/governance/resolutions/details'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: overdue && !isComplete ? AppColors.danger.withValues(alpha: 0.4) : AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m['ref'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
              const SizedBox(height: 2),
              Text(m['title'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            ])),
            if (overdue && !isComplete) Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
              child: const Text('OVERDUE', style: TextStyle(color: AppColors.danger, fontSize: 10, fontWeight: FontWeight.w700))),
            if (isComplete) const Icon(Icons.check_circle, color: AppColors.success, size: 20),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: progress, minHeight: 6,
                backgroundColor: AppColors.bgDark, valueColor: AlwaysStoppedAnimation(progressColor)),
            )),
            const SizedBox(width: 10),
            Text('${(progress * 100).round()}%', style: TextStyle(color: progressColor, fontSize: 12, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.person_outline, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 4),
            Text(m['owner'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            const Spacer(),
            const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 4),
            Text('Due: ${m['due']}', style: TextStyle(color: overdue && !isComplete ? AppColors.danger : AppColors.textMuted, fontSize: 11)),
          ]),
        ]),
      ),
    );
  }
}
