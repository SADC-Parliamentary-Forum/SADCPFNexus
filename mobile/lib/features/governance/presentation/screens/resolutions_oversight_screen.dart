import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class ResolutionsOversightScreen extends ConsumerStatefulWidget {
  const ResolutionsOversightScreen({super.key});

  @override
  ConsumerState<ResolutionsOversightScreen> createState() => _ResolutionsOversightScreenState();
}

class _ResolutionsOversightScreenState extends ConsumerState<ResolutionsOversightScreen> {
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

  static double _progressFromStatus(String? s) {
    switch ((s ?? '').toLowerCase().replaceAll(' ', '_')) {
      case 'implemented':
      case 'adopted':
        return 1.0;
      case 'in_progress':
        return 0.5;
      case 'deferred':
        return 0.25;
      default:
        return 0.0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final milestones = _resolutions.map((r) {
      final status = r['status'] as String?;
      return <String, dynamic>{
        ...r,
        'ref': r['reference_number'] ?? r['ref'] ?? '—',
        'title': r['title'] as String? ?? '—',
        'progress': _progressFromStatus(status),
        'due': r['adopted_at'] != null ? AppDateFormatter.short(r['adopted_at'] as String) : '—',
        'owner': '—',
        'overdue': false,
      };
    }).toList();
    final completed = milestones.where((m) => (m['progress'] as double) >= 1.0).length;
    final overdue = milestones.where((m) => m['overdue'] as bool).length;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Resolutions Oversight', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
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
                    Row(
                      children: [
                        _healthCard('Tracking', '${milestones.length}', AppColors.primary),
                        const SizedBox(width: 10),
                        _healthCard('Completed', '$completed', AppColors.success),
                        const SizedBox(width: 10),
                        _healthCard('Overdue', '$overdue', AppColors.danger),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (overdue > 0) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 18),
                            const SizedBox(width: 10),
                            Text(
                              '$overdue resolution(s) are overdue and require immediate action.',
                              style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    const Text('IMPLEMENTATION TRACKER', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                    const SizedBox(height: 10),
                    if (milestones.isEmpty)
                      const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No resolutions to track.', style: TextStyle(color: AppColors.textMuted))))
                    else
                      ...milestones.map((m) => _milestoneCard(context, m)),
                  ],
                ),
    );
  }

  Widget _healthCard(String label, String val, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Text(val, style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
        ],
      ),
    ),
  );

  Widget _milestoneCard(BuildContext context, Map<String, dynamic> m) {
    final progress = m['progress'] as double;
    final overdue = m['overdue'] as bool;
    final isComplete = progress >= 1.0;
    final progressColor = isComplete ? AppColors.success : (overdue ? AppColors.danger : AppColors.primary);
    return GestureDetector(
      onTap: () => context.push('/governance/resolutions/details', extra: m),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: overdue && !isComplete ? AppColors.danger.withValues(alpha: 0.4) : AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m['ref'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                      const SizedBox(height: 2),
                      Text(m['title'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                if (overdue && !isComplete)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                    child: const Text('OVERDUE', style: TextStyle(color: AppColors.danger, fontSize: 10, fontWeight: FontWeight.w700)),
                  ),
                if (isComplete) const Icon(Icons.check_circle, color: AppColors.success, size: 20),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: AppColors.bgDark,
                      valueColor: AlwaysStoppedAnimation(progressColor),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text('${(progress * 100).round()}%', style: TextStyle(color: progressColor, fontSize: 12, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.person_outline, color: AppColors.textMuted, size: 12),
                const SizedBox(width: 4),
                Text(m['owner'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                const Spacer(),
                const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 12),
                const SizedBox(width: 4),
                Text('Adopted: ${m['due']}', style: TextStyle(color: overdue && !isComplete ? AppColors.danger : AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
