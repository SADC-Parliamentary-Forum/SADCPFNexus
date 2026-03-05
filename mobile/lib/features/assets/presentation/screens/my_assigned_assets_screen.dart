import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class MyAssignedAssetsScreen extends StatefulWidget {
  const MyAssignedAssetsScreen({super.key});
  @override
  State<MyAssignedAssetsScreen> createState() => _MyAssignedAssetsScreenState();
}

class _MyAssignedAssetsScreenState extends State<MyAssignedAssetsScreen> {
  String _filter = 'All';
  final _filters = ['All', 'IT', 'Fleet', 'Furniture', 'Equipment'];

  final _assets = [
    {'name': 'MacBook Pro 16" M2', 'id': 'SADC-TT-2304', 'category': 'IT', 'status': 'Active', 'issued': '12 Oct 2023', 'value': 'N\$45,000', 'icon': Icons.laptop_mac, 'conditionOk': true},
    {'name': 'Toyota Land Cruiser 300', 'id': 'SADC-FL-055', 'category': 'Fleet', 'status': 'Service Due', 'issued': '05 Jan 2024', 'value': 'N\$850,000', 'icon': Icons.directions_car, 'conditionOk': false},
    {'name': 'Herman Miller Chair', 'id': 'SADC-FN-112', 'category': 'Furniture', 'status': 'Active', 'issued': '01 Mar 2022', 'value': 'N\$12,500', 'icon': Icons.chair, 'conditionOk': true},
    {'name': 'iPhone 15 Pro', 'id': 'SADC-TT-3301', 'category': 'IT', 'status': 'Active', 'issued': '20 Feb 2024', 'value': 'N\$18,000', 'icon': Icons.smartphone, 'conditionOk': true},
    {'name': 'Projector Epson EB-X', 'id': 'SADC-EQ-044', 'category': 'Equipment', 'status': 'Loan Out', 'issued': '10 Nov 2023', 'value': 'N\$9,800', 'icon': Icons.video_camera_back, 'conditionOk': false},
  ];

  List<Map<String, dynamic>> get _filtered => _filter == 'All'
      ? List<Map<String, dynamic>>.from(_assets)
      : _assets.where((a) => a['category'] == _filter).map((a) => Map<String, dynamic>.from(a)).toList();

  Color _statusColor(String s) {
    if (s == 'Active') return AppColors.success;
    if (s == 'Service Due') return AppColors.warning;
    return AppColors.info;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('My Assigned Assets', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.qr_code_scanner, color: AppColors.primary), onPressed: () {}),
        ],
      ),
      body: Column(
        children: [
          // Summary banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.primary.withValues(alpha: 0.05)]),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Row(children: [
              Expanded(child: _summaryItem('Total Assets', '${_assets.length}', AppColors.primary)),
              _divider(),
              Expanded(child: _summaryItem('Active', '${_assets.where((a) => a['status'] == 'Active').length}', AppColors.success)),
              _divider(),
              Expanded(child: _summaryItem('Attention', '${_assets.where((a) => a['status'] != 'Active').length}', AppColors.warning)),
            ]),
          ),
          const SizedBox(height: 12),
          // Filter chips
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemCount: _filters.length,
              itemBuilder: (_, i) {
                final active = _filter == _filters[i];
                return GestureDetector(
                  onTap: () => setState(() => _filter = _filters[i]),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? AppColors.primary : AppColors.bgSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: active ? AppColors.primary : AppColors.border),
                    ),
                    child: Text(_filters[i], style: TextStyle(
                      color: active ? AppColors.bgDark : AppColors.textSecondary,
                      fontSize: 12, fontWeight: FontWeight.w600,
                    )),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemCount: filtered.length,
              itemBuilder: (_, i) => _assetTile(filtered[i]),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.bgDark,
        icon: const Icon(Icons.report_problem_outlined, size: 18),
        label: const Text('Report Issue', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _summaryItem(String label, String value, Color color) => Column(children: [
    Text(value, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w800)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
  ]);

  Widget _divider() => Container(width: 1, height: 32, color: AppColors.border);

  Widget _assetTile(Map<String, dynamic> asset) {
    final statusColor = _statusColor(asset['status'] as String);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(children: [
        Row(children: [
          Container(width: 48, height: 48,
            decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
            child: Icon(asset['icon'] as IconData, color: AppColors.textSecondary, size: 24)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(asset['name'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text('ID: ${asset['id']}  ·  ${asset['category']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(asset['status'] as String, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: _infoChip(Icons.calendar_today_outlined, 'Issued', asset['issued'] as String)),
          const SizedBox(width: 8),
          Expanded(child: _infoChip(Icons.attach_money, 'Value', asset['value'] as String)),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () {},
            child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3))),
              child: const Text('Report', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700))),
          ),
        ]),
      ]),
    );
  }

  Widget _infoChip(IconData icon, String label, String value) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(8)),
    child: Row(children: [
      Icon(icon, color: AppColors.textMuted, size: 12),
      const SizedBox(width: 4),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
        Text(value, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
      ])),
    ]),
  );
}
