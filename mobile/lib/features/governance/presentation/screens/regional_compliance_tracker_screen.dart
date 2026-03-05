import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class RegionalComplianceTrackerScreen extends StatefulWidget {
  const RegionalComplianceTrackerScreen({super.key});
  @override
  State<RegionalComplianceTrackerScreen> createState() => _RegionalComplianceTrackerScreenState();
}

class _RegionalComplianceTrackerScreenState extends State<RegionalComplianceTrackerScreen> {
  String _view = 'Countries';
  final _views = ['Countries', 'Instruments', 'Audit'];

  final _countries = [
    {'name': 'Botswana', 'code': 'BW', 'score': 0.92, 'status': 'Compliant', 'reports': 8, 'outstanding': 0},
    {'name': 'Namibia', 'code': 'NA', 'score': 0.87, 'status': 'Compliant', 'reports': 7, 'outstanding': 1},
    {'name': 'Zimbabwe', 'code': 'ZW', 'score': 0.71, 'status': 'Partial', 'reports': 5, 'outstanding': 3},
    {'name': 'Zambia', 'code': 'ZM', 'score': 0.65, 'status': 'Partial', 'reports': 4, 'outstanding': 4},
    {'name': 'Tanzania', 'code': 'TZ', 'score': 0.55, 'status': 'At Risk', 'reports': 3, 'outstanding': 5},
    {'name': 'Mozambique', 'code': 'MZ', 'score': 0.48, 'status': 'Non-Compliant', 'reports': 2, 'outstanding': 6},
  ];

  final _instruments = [
    {'name': 'SADC Treaty Protocol', 'adherence': 0.88, 'signatories': '16/16'},
    {'name': 'Climate Resilience Framework', 'adherence': 0.72, 'signatories': '12/16'},
    {'name': 'Digital Economy Charter', 'adherence': 0.54, 'signatories': '9/16'},
    {'name': 'Gender Equality Compact', 'adherence': 0.81, 'signatories': '14/16'},
  ];

  Color _statusColor(String s) {
    if (s == 'Compliant') return AppColors.success;
    if (s == 'Partial') return AppColors.warning;
    if (s == 'At Risk') return AppColors.info;
    return AppColors.danger;
  }

  Color _scoreColor(double s) {
    if (s >= 0.80) return AppColors.success;
    if (s >= 0.60) return AppColors.warning;
    return AppColors.danger;
  }

  @override
  Widget build(BuildContext context) {
    final avg = _countries.fold(0.0, (s, c) => s + (c['score'] as double)) / _countries.length;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Regional Compliance', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [IconButton(icon: const Icon(Icons.download_outlined, color: AppColors.textSecondary), onPressed: () {})],
      ),
      body: Column(
        children: [
          // Overall score
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [_scoreColor(avg).withValues(alpha: 0.15), AppColors.bgSurface]),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _scoreColor(avg).withValues(alpha: 0.3)),
              ),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Regional Compliance Score', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                  const SizedBox(height: 4),
                  Text('${(avg * 100).round()}%', style: TextStyle(color: _scoreColor(avg), fontSize: 32, fontWeight: FontWeight.w900)),
                  Text('Based on ${_countries.length} member states', style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                ])),
                SizedBox(
                  width: 64, height: 64,
                  child: Stack(alignment: Alignment.center, children: [
                    CircularProgressIndicator(value: avg, strokeWidth: 6,
                      backgroundColor: AppColors.bgDark, valueColor: AlwaysStoppedAnimation(_scoreColor(avg))),
                    Text('${(avg * 100).round()}', style: TextStyle(color: _scoreColor(avg), fontSize: 14, fontWeight: FontWeight.w800)),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          // View tabs
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemCount: _views.length,
              itemBuilder: (_, i) {
                final active = _view == _views[i];
                return GestureDetector(
                  onTap: () => setState(() => _view = _views[i]),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : AppColors.bgSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? AppColors.primary : AppColors.border),
                    ),
                    child: Text(_views[i], style: TextStyle(
                      color: active ? AppColors.bgDark : AppColors.textSecondary,
                      fontSize: 12, fontWeight: FontWeight.w600,
                    )),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          Expanded(child: _view == 'Countries' ? _countriesView() : (_view == 'Instruments' ? _instrumentsView() : _auditView())),
        ],
      ),
    );
  }

  Widget _countriesView() => ListView.separated(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    separatorBuilder: (_, __) => const SizedBox(height: 8),
    itemCount: _countries.length,
    itemBuilder: (_, i) {
      final c = _countries[i];
      final score = c['score'] as double;
      final statusColor = _statusColor(c['status'] as String);
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(width: 38, height: 38,
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Center(child: Text(c['code'] as String, style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800, fontSize: 12)))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(c['name'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            ClipRRect(borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(value: score, minHeight: 4,
                backgroundColor: AppColors.bgDark, valueColor: AlwaysStoppedAnimation(_scoreColor(score)))),
            const SizedBox(height: 4),
            Text('${c['reports']} reports submitted  ·  ${c['outstanding']} outstanding',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
          ])),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${(score * 100).round()}%', style: TextStyle(color: _scoreColor(score), fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
              child: Text(c['status'] as String, style: TextStyle(color: statusColor, fontSize: 9, fontWeight: FontWeight.w700))),
          ]),
        ]),
      );
    },
  );

  Widget _instrumentsView() => ListView.separated(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    separatorBuilder: (_, __) => const SizedBox(height: 8),
    itemCount: _instruments.length,
    itemBuilder: (_, i) {
      final inst = _instruments[i];
      final adherence = inst['adherence'] as double;
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(inst['name'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700))),
            Text('${(adherence * 100).round()}%', style: TextStyle(color: _scoreColor(adherence), fontSize: 16, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 8),
          ClipRRect(borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: adherence, minHeight: 6,
              backgroundColor: AppColors.bgDark, valueColor: AlwaysStoppedAnimation(_scoreColor(adherence)))),
          const SizedBox(height: 8),
          Text('Signatories: ${inst['signatories']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        ]),
      );
    },
  );

  Widget _auditView() => ListView(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    children: [
      _auditRow('Annual Compliance Report submitted', true, 'Mar 2026'),
      _auditRow('Member state data validated', true, 'Feb 2026'),
      _auditRow('Third-party audit initiated', false, 'Pending'),
      _auditRow('UN SDG alignment check', false, 'Q2 2026'),
    ],
  );

  Widget _auditRow(String label, bool done, String date) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Icon(done ? Icons.check_circle : Icons.radio_button_unchecked, color: done ? AppColors.success : AppColors.border, size: 18),
      const SizedBox(width: 12),
      Expanded(child: Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13))),
      Text(date, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
    ]),
  );
}
