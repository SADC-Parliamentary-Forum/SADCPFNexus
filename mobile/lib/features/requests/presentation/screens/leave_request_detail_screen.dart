import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class LeaveRequestDetailScreen extends StatelessWidget {
  const LeaveRequestDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Leave Request', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.download_outlined, color: AppColors.textSecondary), onPressed: () {}),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.success.withValues(alpha: 0.1), AppColors.bgSurface]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.check_circle_outline, color: AppColors.success, size: 12),
                    SizedBox(width: 4),
                    Text('Approved', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w700)),
                  ])),
                const Spacer(),
                const Text('REF: SADC-LV-2026-0018', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ]),
              const SizedBox(height: 12),
              const Text('Annual Leave — Personal', style: TextStyle(color: AppColors.textPrimary, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Submitted 28 Feb 2026  ·  Approved 01 Mar 2026', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ),
          const SizedBox(height: 16),

          // Leave details
          _card(children: [
            _secHeader('Leave Details', Icons.event_available_outlined, AppColors.success),
            _row('Leave Type', 'Annual Leave'),
            _row('Dates', '10 Mar – 14 Mar 2026'),
            _row('Duration', '5 working days'),
            _row('Half Day', 'No'),
            _row('Reason', 'Personal / Family commitment'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),

          // Acting officer
          _card(children: [
            _secHeader('Acting Officer', Icons.swap_horiz_outlined, AppColors.info),
            _row('Name', 'Grace Mutumba'),
            _row('Position', 'Senior Finance Analyst'),
            _row('Contact', '+264 81 234 5678'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),

          // Leave balance impact
          _card(children: [
            _secHeader('Balance Impact', Icons.account_balance_outlined, AppColors.warning),
            _row('Balance Before', '18 days available'),
            _row('Days Requested', '5 days'),
            _row('Balance After', '13 days available'),
            const SizedBox(height: 8),
            Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 4),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: const LinearProgressIndicator(
                  value: 13 / 21,
                  minHeight: 6,
                  backgroundColor: AppColors.bgCard,
                  valueColor: AlwaysStoppedAnimation(AppColors.success),
                ),
              )),
            const Padding(padding: EdgeInsets.fromLTRB(14, 4, 14, 12),
              child: Text('13 of 21 days remaining', style: TextStyle(color: AppColors.textMuted, fontSize: 10))),
          ]),
          const SizedBox(height: 12),

          // Approval chain
          _card(children: [
            _secHeader('Approval Chain', Icons.account_tree_outlined, AppColors.primary),
            _approvalStep('Supervisor', 'James Mwape', true, 'Approved 28 Feb', false),
            _approvalStep('HR Officer', 'Amelia Dos Santos', true, 'Approved 01 Mar', true),
          ]),
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
              label: const Text('Cancel Leave', style: TextStyle(fontWeight: FontWeight.w700)),
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
              icon: const Icon(Icons.picture_as_pdf_outlined, size: 16),
              label: const Text('Download PDF', style: TextStyle(fontWeight: FontWeight.w700)),
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

  Widget _approvalStep(String role, String name, bool done, String note, bool isLast) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
    child: Row(children: [
      Column(children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(
          color: done ? AppColors.success.withValues(alpha: 0.1) : AppColors.bgCard,
          shape: BoxShape.circle,
          border: Border.all(color: done ? AppColors.success : AppColors.border)),
          child: Icon(done ? Icons.check : Icons.hourglass_empty, color: done ? AppColors.success : AppColors.textMuted, size: 14)),
        if (!isLast) Container(width: 1, height: 24, color: AppColors.border),
      ]),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        Text(role, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        Text(note, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ])),
      if (done) const Text('Approved', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w600)),
    ]),
  );
}
