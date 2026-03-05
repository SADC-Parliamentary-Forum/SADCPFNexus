import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class LeaveBalanceScreen extends StatelessWidget {
  const LeaveBalanceScreen({super.key});

  final _balances = const [
    {'type': 'Annual Leave', 'total': 21, 'used': 8, 'pending': 2, 'color': Color(0xFF059669)},
    {'type': 'Sick Leave', 'total': 15, 'used': 3, 'pending': 0, 'color': Color(0xFFDC2626)},
    {'type': 'Study Leave', 'total': 10, 'used': 5, 'pending': 0, 'color': Color(0xFF7C3AED)},
    {'type': 'Maternity Leave', 'total': 90, 'used': 0, 'pending': 0, 'color': Color(0xFFD97706)},
    {'type': 'Compassionate', 'total': 5, 'used': 0, 'pending': 0, 'color': Color(0xFF0891B2)},
  ];

  final _lil = const [
    {'reason': 'Parliament Session – Weekend', 'hours': 16.0, 'earned': '15 Feb 2026', 'expires': '15 May 2026'},
    {'reason': 'Regional Conference – Harare', 'hours': 8.0, 'earned': '28 Feb 2026', 'expires': '28 May 2026'},
    {'reason': 'Budget Committee – Evening', 'hours': 3.5, 'earned': '02 Mar 2026', 'expires': '02 Jun 2026'},
  ];

  final _history = const [
    {'type': 'Annual Leave', 'dates': '10–14 Feb 2026', 'days': 5, 'status': 'Approved'},
    {'type': 'Sick Leave', 'dates': '20 Jan 2026', 'days': 1, 'status': 'Approved'},
    {'type': 'Annual Leave', 'dates': '23–27 Dec 2025', 'days': 3, 'status': 'Approved'},
    {'type': 'Study Leave', 'dates': '1–5 Dec 2025', 'days': 5, 'status': 'Approved'},
  ];

  @override
  Widget build(BuildContext context) {
    final totalLil = _lil.fold(0.0, (s, l) => s + (l['hours'] as double));
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Leave Balances', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.download_outlined, color: AppColors.primary, size: 16),
            label: const Text('Export', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.12), AppColors.bgCard]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Leave Year: 01 Jan – 31 Dec 2026', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              const SizedBox(height: 12),
              Row(children: [
                _heroStat('Available', '13', 'Annual days', AppColors.success),
                const SizedBox(width: 8),
                _heroStat('Used', '8', 'Days taken', AppColors.warning),
                const SizedBox(width: 8),
                _heroStat('LIL Hours', '${totalLil.toStringAsFixed(1)}h', 'In lieu', AppColors.primary),
              ]),
            ]),
          ),
          const SizedBox(height: 20),
          const Text('LEAVE ENTITLEMENTS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          ..._balances.map((b) => _balanceCard(b)),
          const SizedBox(height: 20),
          // LIL section
          Row(children: [
            Container(padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.more_time, color: AppColors.primary, size: 16)),
            const SizedBox(width: 8),
            const Text('Leave in Lieu (LIL) Accruals', style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 4),
          const Text('Hours earned for work outside normal office hours.', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 10),
          ..._lil.map((l) => _lilTile(l)),
          const SizedBox(height: 20),
          // History
          const Text('LEAVE HISTORY', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          ..._history.map((h) => _historyTile(h)),
          const SizedBox(height: 32),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pop(context),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('New Request', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _heroStat(String label, String val, String sub, Color color) => Expanded(
    child: Column(children: [
      Text(val, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w900)),
      Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.w600)),
      Text(sub, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
    ]),
  );

  Widget _balanceCard(Map<String, dynamic> b) {
    final total = b['total'] as int;
    final used = b['used'] as int;
    final pending = b['pending'] as int;
    final available = total - used - pending;
    final color = b['color'] as Color;
    final pct = total > 0 ? used / total : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(b['type'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          const Spacer(),
          Text('$available / $total days', style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: pct, minHeight: 6,
            backgroundColor: AppColors.bgCard, valueColor: AlwaysStoppedAnimation(color)),
        ),
        const SizedBox(height: 8),
        Row(children: [
          _tag('Used: $used', AppColors.textMuted),
          if (pending > 0) ...[const SizedBox(width: 8), _tag('Pending: $pending', AppColors.warning)],
          const Spacer(),
          _tag('Available: $available', AppColors.success),
        ]),
      ]),
    );
  }

  Widget _tag(String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
    child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
  );

  Widget _lilTile(Map<String, dynamic> l) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Container(width: 40, height: 40,
        decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
        child: const Icon(Icons.more_time, color: AppColors.primary, size: 20)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(l['reason'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text('Earned: ${l['earned']}  ·  Expires: ${l['expires']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ])),
      Text('${l['hours']}h', style: const TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.w800)),
    ]),
  );

  Widget _historyTile(Map<String, dynamic> h) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(h['type'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text('${h['dates']}  ·  ${h['days']} day${(h['days'] as int) == 1 ? '' : 's'}',
          style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
      ])),
      Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
        child: const Text('Approved', style: TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w700))),
    ]),
  );
}
