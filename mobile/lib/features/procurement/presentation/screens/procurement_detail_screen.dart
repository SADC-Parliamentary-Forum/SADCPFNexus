import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class ProcurementDetailScreen extends StatelessWidget {
  const ProcurementDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Procurement Request', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
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
              gradient: LinearGradient(colors: [AppColors.info.withValues(alpha: 0.1), AppColors.bgSurface]),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.info.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.inventory_2_outlined, color: AppColors.info, size: 12),
                    SizedBox(width: 4),
                    Text('Quote Evaluation', style: TextStyle(color: AppColors.info, fontSize: 11, fontWeight: FontWeight.w700)),
                  ])),
                const Spacer(),
                const Text('PR-2026-0074', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ]),
              const SizedBox(height: 12),
              const Text('ICT Equipment — 5× Laptops & Accessories', style: TextStyle(color: AppColors.textPrimary, fontSize: 17, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Submitted 28 Feb 2026  ·  3 quotes received', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ]),
          ),
          const SizedBox(height: 16),

          // Requisition details
          _card(children: [
            _secHeader('Requisition Details', Icons.description_outlined, AppColors.primary),
            _row('Department', 'Information Technology'),
            _row('Category', 'ICT Equipment'),
            _row('Budget Line', 'GL-2026-ICT-EQUIPMENT'),
            _row('Estimated Value', 'N\$87,500.00'),
            _row('Procurement Route', 'Quotation (3 suppliers)'),
            _row('Required By', '31 Mar 2026'),
            const SizedBox(height: 4),
          ]),
          const SizedBox(height: 12),

          // Items list
          _card(children: [
            _secHeader('Items Requested', Icons.list_alt_outlined, AppColors.warning),
            _itemRow('Laptop (Core i7, 16GB RAM, 512GB SSD)', 5, 'N\$14,500.00', 'N\$72,500.00'),
            _itemRow('Laptop Bags', 5, 'N\$650.00', 'N\$3,250.00'),
            _itemRow('Wireless Mice & Keyboards', 5, 'N\$750.00', 'N\$3,750.00'),
            const Divider(color: AppColors.border, height: 20, indent: 14, endIndent: 14),
            const Padding(padding: EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(children: [
                Text('Total', style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                Spacer(),
                Text('N\$79,500.00', style: TextStyle(color: AppColors.primary, fontSize: 15, fontWeight: FontWeight.w800)),
              ])),
          ]),
          const SizedBox(height: 12),

          // Quote comparison
          _card(children: [
            _secHeader('Supplier Quotes', Icons.compare_outlined, AppColors.success),
            _quoteRow('TechHub Namibia', 'N\$79,500.00', true, 'Recommended'),
            _quoteRow('DigitalPro Solutions', 'N\$84,200.00', false, '2nd'),
            _quoteRow('CompuZone Africa', 'N\$91,750.00', false, '3rd'),
            const SizedBox(height: 4),
            Container(margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
              child: const Row(children: [
                Icon(Icons.check_circle, color: AppColors.success, size: 14),
                SizedBox(width: 6),
                Expanded(child: Text('TechHub Namibia selected — lowest compliant bid.',
                  style: TextStyle(color: AppColors.success, fontSize: 11))),
              ])),
          ]),
          const SizedBox(height: 12),

          // Approval chain
          _card(children: [
            _secHeader('Approval Chain', Icons.account_tree_outlined, AppColors.info),
            _approvalStep('Requester', 'John Kalanga', true, false),
            _approvalStep('HOD – ICT', 'Patricia Nkosi', true, false),
            _approvalStep('Procurement Officer', 'In evaluation', false, false),
            _approvalStep('Finance Director', 'Awaiting', false, true),
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
              label: const Text('Cancel PR', style: TextStyle(fontWeight: FontWeight.w700)),
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
              label: const Text('Download PR', style: TextStyle(fontWeight: FontWeight.w700)),
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
      SizedBox(width: 140, child: Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 12))),
      Expanded(child: Text(val, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500))),
    ]),
  );

  Widget _itemRow(String name, int qty, String unit, String total) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 6, 14, 2),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w500)),
      const SizedBox(height: 2),
      Row(children: [
        Text('Qty: $qty', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        const Text('  ×  ', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
        Text(unit, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
        const Spacer(),
        Text(total, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
      ]),
    ]),
  );

  Widget _quoteRow(String vendor, String amount, bool selected, String rank) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 8, 14, 2),
    child: Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: selected ? AppColors.success.withValues(alpha: 0.05) : AppColors.bgCard,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: selected ? AppColors.success.withValues(alpha: 0.3) : AppColors.border),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(vendor, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
          Text(rank, style: TextStyle(color: selected ? AppColors.success : AppColors.textMuted, fontSize: 10)),
        ])),
        Text(amount, style: TextStyle(
          color: selected ? AppColors.success : AppColors.textSecondary,
          fontSize: 13, fontWeight: FontWeight.w700)),
        if (selected) ...[
          const SizedBox(width: 6),
          const Icon(Icons.check_circle, color: AppColors.success, size: 16),
        ],
      ]),
    ),
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
