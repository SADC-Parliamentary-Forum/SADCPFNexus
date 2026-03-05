import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class AssetInventoryScreen extends StatelessWidget {
  const AssetInventoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Asset & Inventory', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_none, color: AppColors.textSecondary), onPressed: () {}),
          Container(margin: const EdgeInsets.only(right: 12), width: 32, height: 32,
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: const Center(child: Text('SM', style: TextStyle(color: Color(0xFF102219), fontSize: 11, fontWeight: FontWeight.w800)))),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('My Assigned Assets', 'View All'),
          const SizedBox(height: 10),
          _assetCard(context, 'MacBook Pro 16" M2', 'SADC-TT-2304', 'Active', AppColors.success, 'Issued: 12 Oct 2023', Icons.laptop_mac, true),
          const SizedBox(height: 10),
          _assetCard(context, 'Toyota Land Cruiser 300', 'SADC-FL-055', 'Service Due', AppColors.warning, 'Issued: 05 Jan 2024', Icons.directions_car, false),
          const SizedBox(height: 20),
          Row(children: [
            Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.inventory_2_outlined, color: AppColors.primary, size: 16)),
            const SizedBox(width: 8),
            const Text('Storekeeper Dashboard', style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 6),
          const Text('LOW STOCK REORDER TRIGGERS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 8),
          _stockRow('Printer Toner (BK)', '3 units remaining', Icons.print),
          const SizedBox(height: 8),
          _stockRow('A4 Paper Reams', '12 units remaining', Icons.description),
          const SizedBox(height: 20),
          _sectionHeader('Recent Issue Requests', 'View Queue'),
          const SizedBox(height: 10),
          _issueRow('Sarah M.', 'HDMI Adapter'),
          const SizedBox(height: 8),
          _issueRow('James K.', 'Ergonomic Chair'),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, String action) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
      GestureDetector(onTap: () {}, child: Text(action, style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600))),
    ],
  );

  Widget _assetCard(BuildContext ctx, String name, String id, String status, Color statusColor, String issued, IconData icon, bool showConfirm) =>
    Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Container(width: 52, height: 52, decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
          child: Icon(icon, color: AppColors.textSecondary, size: 28)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text('ID: $id', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 4),
          Text(issued, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
        ])),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(status, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700))),
          const SizedBox(height: 8),
          if (showConfirm) GestureDetector(onTap: () {},
            child: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6), border: Border.all(color: AppColors.primary.withValues(alpha: 0.3))),
              child: const Text('Confirm Condition', style: TextStyle(color: AppColors.primary, fontSize: 9, fontWeight: FontWeight.w700)))),
          if (!showConfirm) const Icon(Icons.verified, color: AppColors.success, size: 18),
        ]),
      ]),
    );

  Widget _stockRow(String name, String qty, IconData icon) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Icon(icon, color: AppColors.textSecondary, size: 20),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        Text(qty, style: const TextStyle(color: AppColors.warning, fontSize: 11)),
      ])),
      ElevatedButton(onPressed: () {},
        style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), minimumSize: Size.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
        child: const Text('Reorder', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
    ]),
  );

  Widget _issueRow(String name, String item) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Container(width: 34, height: 34, decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
        child: Center(child: Text(name[0], style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w800)))),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        Text('Request: $item', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
      ])),
      IconButton(onPressed: () {}, icon: const Icon(Icons.close, color: AppColors.danger, size: 18), visualDensity: VisualDensity.compact),
      IconButton(onPressed: () {}, icon: const Icon(Icons.check, color: AppColors.success, size: 18), visualDensity: VisualDensity.compact),
    ]),
  );
}
