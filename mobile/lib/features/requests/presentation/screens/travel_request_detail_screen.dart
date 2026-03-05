import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class TravelRequestDetailScreen extends StatelessWidget {
  const TravelRequestDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Travel Request', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
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
                    Text('Pending Approval', style: TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.w700)),
                  ])),
                const Spacer(),
                const Text('REF: SADC-TR-2026-0041', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ]),
              const SizedBox(height: 12),
              const Text('Mission to Lusaka — SADC Finance Workshop', style: TextStyle(color: AppColors.textPrimary, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Submitted 04 Mar 2026  ·  Step 2 of 3 approvals', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ),
          const SizedBox(height: 16),
          // Details
          _card(children: [
            _secHeader('Mission Details', Icons.flight_takeoff_outlined, AppColors.primary),
            _row('Destination', 'Lusaka, Zambia'),
            _row('Departure', '15 Mar 2026  →  18 Mar 2026'),
            _row('Duration', '4 nights / 5 days'),
            _row('Purpose', 'SADC Finance Ministers Workshop'),
            _row('Mission Type', 'Regional Meeting'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),
          _card(children: [
            _secHeader('Budget & Costs', Icons.account_balance_wallet_outlined, AppColors.gold),
            _row('Budget Line', 'GL-2026-REGIONAL-TRAVEL'),
            _row('Estimated DSA', 'N\$2,800.00 (4 nights × USD 140)'),
            _row('Air Travel', 'N\$3,200.00'),
            _row('Ground Transport', 'N\$450.00'),
            const Divider(color: AppColors.border, height: 20, indent: 14, endIndent: 14),
            const Padding(padding: EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Row(children: [
                Text('Total Estimated Cost', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                Spacer(),
                Text('N\$6,450.00', style: TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.w800)),
              ])),
          ]),
          const SizedBox(height: 12),
          // Approval chain
          _card(children: [
            _secHeader('Approval Chain', Icons.account_tree_outlined, AppColors.info),
            _approvalStep('Supervisor', 'James Mwape', true, false),
            _approvalStep('Finance Officer', 'Amelia Dos Santos', false, false),
            _approvalStep('Secretary General', 'Dr. N. Ndlovhu', false, true),
          ]),
          const SizedBox(height: 12),
          // Itinerary
          _card(children: [
            _secHeader('Itinerary', Icons.map_outlined, AppColors.success),
            _itRow('Sun 15 Mar', 'Depart Windhoek (WDH) 08:00 → Arrive Lusaka (LUN) 14:30'),
            _itRow('Mon–Wed', 'SADC Finance Ministers Workshop sessions'),
            _itRow('Thu 18 Mar', 'Depart Lusaka (LUN) 16:00 → Arrive Windhoek (WDH) 21:15'),
            const SizedBox(height: 8),
          ]),
          const SizedBox(height: 20),
          // Actions
          Row(children: [
            Expanded(child: OutlinedButton.icon(
              onPressed: () {},
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), padding: const EdgeInsets.symmetric(vertical: 14)),
              icon: const Icon(Icons.cancel_outlined, size: 16),
              label: const Text('Withdraw', style: TextStyle(fontWeight: FontWeight.w700)),
            )),
            const SizedBox(width: 12),
            Expanded(child: ElevatedButton.icon(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), padding: const EdgeInsets.symmetric(vertical: 14)),
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
              label: const Text('Print Auth Letter', style: TextStyle(fontWeight: FontWeight.w700)),
            )),
          ]),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) => Container(
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
      SizedBox(width: 130, child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
      Expanded(child: Text(val, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500))),
    ]),
  );

  Widget _approvalStep(String role, String name, bool done, bool isLast) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
    child: Row(children: [
      Column(children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(
          color: done ? AppColors.success.withValues(alpha: 0.1) : AppColors.bgCard,
          shape: BoxShape.circle, border: Border.all(color: done ? AppColors.success : AppColors.border)),
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

  Widget _itRow(String date, String desc) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 80, child: Text(date, style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600))),
      Expanded(child: Text(desc, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
    ]),
  );
}
