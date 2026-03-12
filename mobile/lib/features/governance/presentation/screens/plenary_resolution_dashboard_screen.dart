import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class PlenaryResolutionDashboardScreen extends ConsumerStatefulWidget {
  const PlenaryResolutionDashboardScreen({super.key});

  @override
  ConsumerState<PlenaryResolutionDashboardScreen> createState() => _PlenaryResolutionDashboardScreenState();
}

class _PlenaryResolutionDashboardScreenState extends ConsumerState<PlenaryResolutionDashboardScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _resolutions = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/governance/resolutions',
        queryParameters: {'per_page': 100},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      setState(() {
        _resolutions = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load resolutions.'; _loading = false; });
    }
  }

  static String _normalizeStatus(String? s) {
    switch ((s ?? '').toLowerCase().replaceAll(' ', '_')) {
      case 'adopted': return 'Adopted';
      case 'implemented': return 'Implemented';
      case 'in_progress': return 'In Progress';
      case 'deferred': return 'Deferred';
      default: return s ?? '—';
    }
  }

  Color _statusColor(String s) {
    if (s == 'Adopted' || s == 'Implemented') return AppColors.success;
    if (s == 'In Progress') return AppColors.primary;
    if (s == 'Deferred') return AppColors.warning;
    return AppColors.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    final adoptedCount = _resolutions.where((r) => _normalizeStatus(r['status'] as String?) == 'Adopted' || _normalizeStatus(r['status'] as String?) == 'Implemented').length;
    final inProgressCount = _resolutions.where((r) => _normalizeStatus(r['status'] as String?) == 'In Progress').length;
    final deferredCount = _resolutions.where((r) => _normalizeStatus(r['status'] as String?) == 'Deferred').length;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Plenary Resolutions', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: AppColors.textSecondary), onPressed: _loading ? null : _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.danger)),
                      const SizedBox(height: 12),
                      TextButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.15), AppColors.bgSurface]),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Resolutions', style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                          const Text('SADC PF Governance', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              _kpiPill('Total', '${_resolutions.length}', AppColors.textPrimary),
                              const SizedBox(width: 8),
                              _kpiPill('Adopted', '$adoptedCount', AppColors.success),
                              const SizedBox(width: 8),
                              _kpiPill('In Progress', '$inProgressCount', AppColors.primary),
                              const SizedBox(width: 8),
                              _kpiPill('Deferred', '$deferredCount', AppColors.warning),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text('ALL RESOLUTIONS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                    const SizedBox(height: 10),
                    if (_resolutions.isEmpty)
                      const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No resolutions yet.', style: TextStyle(color: AppColors.textMuted))))
                    else
                      ..._resolutions.map((r) => _resolutionCard(context, r)),
                  ],
                ),
    );
  }

  Widget _kpiPill(String label, String val, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
    child: Column(children: [
      Text(val, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w800)),
      Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
    ]),
  );

  Widget _resolutionCard(BuildContext context, Map<String, dynamic> r) {
    final ref = r['reference_number'] ?? r['ref'] ?? '—';
    final title = r['title'] as String? ?? '—';
    final status = _normalizeStatus(r['status'] as String?);
    final statusColor = _statusColor(status);
    final adoptedAt = r['adopted_at'] as String?;
    final dateStr = adoptedAt != null ? AppDateFormatter.short(adoptedAt) : '—';
    return GestureDetector(
      onTap: () => context.push('/governance/resolutions/details', extra: r),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(ref, style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w600))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                  child: Text(status, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.event_outlined, color: AppColors.textMuted, size: 12),
                const SizedBox(width: 4),
                Text('Adopted: $dateStr', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
