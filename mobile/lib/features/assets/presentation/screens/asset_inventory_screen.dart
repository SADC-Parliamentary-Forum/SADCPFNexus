import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class AssetInventoryScreen extends ConsumerStatefulWidget {
  const AssetInventoryScreen({super.key});

  @override
  ConsumerState<AssetInventoryScreen> createState() => _AssetInventoryScreenState();
}

class _AssetInventoryScreenState extends ConsumerState<AssetInventoryScreen> {
  bool _loadingAssigned = true;
  bool _loadingAll = true;
  String? _errorAssigned;
  String? _errorAll;
  List<Map<String, dynamic>> _assignedAssets = [];
  List<Map<String, dynamic>> _allAssets = [];

  @override
  void initState() {
    super.initState();
    _loadAssigned();
    _loadAll();
  }

  Future<void> _loadAssigned() async {
    setState(() { _loadingAssigned = true; _errorAssigned = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/assets',
        queryParameters: {'assigned_to': 'me', 'per_page': 50},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      setState(() {
        _assignedAssets = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loadingAssigned = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _errorAssigned = 'Failed to load assigned assets.'; _loadingAssigned = false; });
    }
  }

  Future<void> _loadAll() async {
    setState(() { _loadingAll = true; _errorAll = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/assets',
        queryParameters: {'per_page': 50},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      setState(() {
        _allAssets = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loadingAll = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _errorAll = 'Failed to load inventory.'; _loadingAll = false; });
    }
  }

  IconData _categoryIcon(String? cat) {
    switch ((cat ?? '').toLowerCase()) {
      case 'fleet': return Icons.directions_car;
      case 'furniture': return Icons.chair;
      case 'equipment': return Icons.video_camera_back;
      default: return Icons.laptop_mac;
    }
  }

  String _statusLabel(String? s) {
    switch ((s ?? '').toLowerCase()) {
      case 'service_due': return 'Service Due';
      case 'loan_out': return 'Loan Out';
      case 'retired': return 'Retired';
      default: return 'Active';
    }
  }

  Color _statusColor(String label) {
    if (label == 'Active') return AppColors.success;
    if (label == 'Service Due') return AppColors.warning;
    if (label == 'Loan Out') return AppColors.info;
    return AppColors.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Asset & Inventory', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/assets/request'),
            icon: const Icon(Icons.add_circle_outline, size: 18, color: AppColors.primary),
            label: const Text('Request', style: TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600)),
          ),
          IconButton(icon: const Icon(Icons.notifications_none, color: AppColors.textSecondary), onPressed: () {}),
          Container(
            margin: const EdgeInsets.only(right: 12),
            width: 32,
            height: 32,
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: const Center(child: Text('SM', style: TextStyle(color: Color(0xFF102219), fontSize: 11, fontWeight: FontWeight.w800))),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _loadAssigned();
          await _loadAll();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _sectionHeader('My Assigned Assets', 'View All', onAction: () => context.push('/assets/assigned')),
            const SizedBox(height: 10),
            if (_loadingAssigned)
              const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
            else if (_errorAssigned != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text(_errorAssigned!, style: const TextStyle(color: AppColors.danger)),
                    TextButton(onPressed: _loadAssigned, child: const Text('Retry')),
                  ],
                ),
              )
            else if (_assignedAssets.isEmpty)
              const Padding(padding: EdgeInsets.all(16), child: Text('No assigned assets.', style: TextStyle(color: AppColors.textMuted)))
            else
              ..._assignedAssets.take(5).map((a) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _assetCardFromMap(a),
              )),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.inventory_2_outlined, color: AppColors.primary, size: 16),
                ),
                const SizedBox(width: 8),
                const Text('Storekeeper Dashboard', style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 6),
            const Text('LOW STOCK REORDER TRIGGERS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
            const SizedBox(height: 8),
            _stockRow('Printer Toner (BK)', '3 units remaining', Icons.print),
            const SizedBox(height: 8),
            _stockRow('A4 Paper Reams', '12 units remaining', Icons.description),
            const SizedBox(height: 20),
            _sectionHeader('All Assets', ''),
            const SizedBox(height: 10),
            if (_loadingAll)
              const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: AppColors.primary)))
            else if (_errorAll != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text(_errorAll!, style: const TextStyle(color: AppColors.danger)),
                    TextButton(onPressed: _loadAll, child: const Text('Retry')),
                  ],
                ),
              )
            else if (_allAssets.isEmpty)
              const Padding(padding: EdgeInsets.all(16), child: Text('No assets in inventory.', style: TextStyle(color: AppColors.textMuted)))
            else
              ..._allAssets.take(10).map((a) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _assetCardFromMap(a),
              )),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, String action, {VoidCallback? onAction}) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
      if (action.isNotEmpty)
        GestureDetector(
          onTap: onAction ?? () {},
          child: Text(action, style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
    ],
  );

  Widget _assetCardFromMap(Map<String, dynamic> asset) {
    final name = asset['name'] as String? ?? '—';
    final id = asset['asset_code'] ?? asset['id'] ?? '—';
    final statusRaw = asset['status'] as String? ?? 'active';
    final statusLabel = _statusLabel(statusRaw);
    final statusColor = _statusColor(statusLabel);
    final issuedAt = asset['issued_at'] != null ? AppDateFormatter.short(asset['issued_at'] as String) : 'Issued: —';
    final icon = _categoryIcon(asset['category'] as String?);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.bgDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Icon(icon, color: AppColors.textSecondary, size: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text('ID: $id', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                const SizedBox(height: 4),
                Text(issuedAt, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stockRow(String name, String qty, IconData icon) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.bgSurface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.border),
    ),
    child: Row(
      children: [
        Icon(icon, color: AppColors.textSecondary, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
              Text(qty, style: const TextStyle(color: AppColors.warning, fontSize: 11)),
            ],
          ),
        ),
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.danger,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            minimumSize: Size.zero,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: const Text('Reorder', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ),
      ],
    ),
  );
}
