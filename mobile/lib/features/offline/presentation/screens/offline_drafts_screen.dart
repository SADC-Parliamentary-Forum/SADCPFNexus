import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class OfflineDraftsScreen extends StatefulWidget {
  const OfflineDraftsScreen({super.key});
  @override
  State<OfflineDraftsScreen> createState() => _OfflineDraftsScreenState();
}

class _OfflineDraftsScreenState extends State<OfflineDraftsScreen> {
  bool _syncing = false;

  final _drafts = [
    {'title': 'Mission to Lusaka – Mar 2026', 'type': 'Travel Request', 'step': 'Step 2 of 4', 'saved': '2 hours ago', 'size': '14 KB', 'icon': Icons.flight_takeoff, 'color': 0xFF13EC80},
    {'title': 'Annual Leave – Easter', 'type': 'Leave Request', 'step': 'Step 1 of 2', 'saved': 'Yesterday', 'size': '6 KB', 'icon': Icons.beach_access, 'color': 0xFF3B82F6},
    {'title': 'Q1 Imprest Retirement', 'type': 'Imprest', 'step': 'Step 2 of 2', 'saved': '2 days ago', 'size': '32 KB', 'icon': Icons.account_balance_wallet_outlined, 'color': 0xFFD4AF37},
    {'title': 'IT Equipment Procurement', 'type': 'Procurement', 'step': 'Step 3 of 3', 'saved': '3 days ago', 'size': '18 KB', 'icon': Icons.inventory_2_outlined, 'color': 0xFFEF4444},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Offline Drafts', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: _syncing ? null : () async {
              setState(() => _syncing = true);
              await Future.delayed(const Duration(seconds: 2));
              if (mounted) {
                setState(() => _syncing = false);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('All drafts synced successfully'), backgroundColor: AppColors.success));
              }
            },
            icon: _syncing
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                : const Icon(Icons.sync, color: AppColors.primary, size: 16),
            label: Text(_syncing ? 'Syncing...' : 'Sync All', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Offline notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.warning.withValues(alpha: 0.3))),
            child: const Row(children: [
              Icon(Icons.wifi_off, color: AppColors.warning, size: 18),
              SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Working Offline', style: TextStyle(color: AppColors.warning, fontSize: 12, fontWeight: FontWeight.w700)),
                Text('Drafts are saved locally. Sync when connected.', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ])),
            ]),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _statCard('Drafts', '${_drafts.length}', AppColors.primary)),
            const SizedBox(width: 10),
            Expanded(child: _statCard('Total Size', '70 KB', AppColors.info)),
            const SizedBox(width: 10),
            Expanded(child: _statCard('Last Sync', '2h ago', AppColors.success)),
          ]),
          const SizedBox(height: 20),
          const Text('SAVED DRAFTS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
          const SizedBox(height: 10),
          ..._drafts.map((d) => _draftTile(d)),
        ],
      ),
    );
  }

  Widget _statCard(String label, String val, Color color) => Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
    child: Column(children: [
      Text(val, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
      Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
    ]),
  );

  Widget _draftTile(Map<String, dynamic> d) {
    final color = Color(d['color'] as int);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Container(width: 44, height: 44,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
          child: Icon(d['icon'] as IconData, color: color, size: 22)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(d['title'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(d['type'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 4),
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(4)),
              child: Text(d['step'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 10))),
            const SizedBox(width: 8),
            const Icon(Icons.access_time, color: AppColors.textMuted, size: 10),
            const SizedBox(width: 3),
            Text(d['saved'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
          ]),
        ])),
        PopupMenuButton<String>(
          color: AppColors.bgSurface,
          icon: const Icon(Icons.more_vert, color: AppColors.textMuted, size: 20),
          onSelected: (val) {
            if (val == 'delete') {
              setState(() => _drafts.remove(d));
            }
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'continue', child: Text('Continue Editing', style: TextStyle(color: AppColors.textPrimary, fontSize: 13))),
            const PopupMenuItem(value: 'delete', child: Text('Delete Draft', style: TextStyle(color: AppColors.danger, fontSize: 13))),
          ],
        ),
      ]),
    );
  }
}
