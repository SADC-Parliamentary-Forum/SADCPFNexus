import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class MyAssignedAssetsScreen extends ConsumerStatefulWidget {
  const MyAssignedAssetsScreen({super.key});
  @override
  ConsumerState<MyAssignedAssetsScreen> createState() => _MyAssignedAssetsScreenState();
}

class _MyAssignedAssetsScreenState extends ConsumerState<MyAssignedAssetsScreen> {
  String _filter = 'All';
  final _filters = ['All', 'IT', 'Fleet', 'Furniture', 'Equipment'];
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _assets = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>('/assets', queryParameters: {'assigned_to': 'me', 'per_page': 100});
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      setState(() {
        _assets = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load assets.'; _loading = false; });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'All') return List<Map<String, dynamic>>.from(_assets);
    final cat = _filter.toLowerCase();
    return _assets.where((a) => (a['category'] as String? ?? '').toLowerCase() == cat).toList();
  }

  Color _statusColor(String s) {
    if (s == 'Active') return AppColors.success;
    if (s == 'Service Due') return AppColors.warning;
    if (s == 'Loan Out') return AppColors.info;
    return AppColors.textSecondary;
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
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, style: const TextStyle(color: AppColors.danger)),
                            const SizedBox(height: 8),
                            TextButton(onPressed: _load, child: const Text('Retry')),
                          ],
                        ),
                      )
                    : ListView.separated(
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

  String _categoryLabel(String? c) {
    switch ((c ?? '').toLowerCase()) {
      case 'it': return 'IT';
      case 'fleet': return 'Fleet';
      case 'furniture': return 'Furniture';
      case 'equipment': return 'Equipment';
      default: return c ?? '—';
    }
  }

  Widget _assetTile(Map<String, dynamic> asset) {
    final status = asset['status'] as String? ?? 'active';
    final statusColor = _statusColor(_statusLabel(status));
    final issuedAt = asset['issued_at'] != null ? AppDateFormatter.short(asset['issued_at'] as String) : '—';
    final value = asset['value'] != null ? 'N\$${asset['value']}' : '—';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
                child: Icon(_categoryIcon(asset['category'] as String?), color: AppColors.textSecondary, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(asset['name'] as String? ?? '', style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text('ID: ${asset['asset_code'] ?? asset['id']}  ·  ${_categoryLabel(asset['category'] as String?)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                child: Text(_statusLabel(status), style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _infoChip(Icons.calendar_today_outlined, 'Issued', issuedAt)),
              const SizedBox(width: 8),
              Expanded(child: _infoChip(Icons.attach_money, 'Value', value)),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {},
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: const Text('Report', style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
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
