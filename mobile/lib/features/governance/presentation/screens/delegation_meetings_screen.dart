import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class DelegationMeetingsScreen extends ConsumerStatefulWidget {
  const DelegationMeetingsScreen({super.key});
  @override
  ConsumerState<DelegationMeetingsScreen> createState() => _DelegationMeetingsScreenState();
}

class _DelegationMeetingsScreenState extends ConsumerState<DelegationMeetingsScreen> {
  String _filter = 'Upcoming';
  final _filters = ['Upcoming', 'Completed', 'All'];
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _meetings = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>('/governance/meetings', queryParameters: {'per_page': 100});
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      setState(() {
        _meetings = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load meetings.'; _loading = false; });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'All') return List.from(_meetings);
    final status = _filter == 'Upcoming' ? 'upcoming' : 'completed';
    return _meetings.where((m) => (m['status'] as String?) == status).toList();
  }


  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final upcomingCount = _meetings.where((m) => (m['status'] as String?) == 'upcoming').length;
    final completedCount = _meetings.length - upcomingCount;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Meetings & Delegations', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [IconButton(icon: const Icon(Icons.calendar_month, color: AppColors.primary), onPressed: _load)],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _statCard('Upcoming', '$upcomingCount', AppColors.primary, Icons.event),
                const SizedBox(width: 10),
                _statCard('Completed', '$completedCount', AppColors.gold, Icons.people_outline),
              ],
            ),
          ),
          const SizedBox(height: 12),
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
                    child: Text(_filters[i], style: TextStyle(color: active ? AppColors.bgDark : AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
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
                    : filtered.isEmpty
                        ? const Center(child: Text('No meetings found', style: TextStyle(color: AppColors.textMuted)))
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) => _meetingCard(filtered[i]),
                          ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.bgDark,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('Schedule', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color, IconData icon) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800)),
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
      ]),
    ),
  );

  Widget _meetingCard(Map<String, dynamic> m) {
    final isCompleted = (m['status'] as String?) == 'completed';
    final dateStr = m['date'] != null ? AppDateFormatter.withWeekday(m['date'] as String) : '—';
    final venue = m['responsible'] as String? ?? '—';
    return GestureDetector(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                  child: const Text('Meeting', style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: (isCompleted ? AppColors.success : AppColors.warning).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(isCompleted ? 'Completed' : 'Upcoming', style: TextStyle(color: isCompleted ? AppColors.success : AppColors.warning, fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(m['title'] as String? ?? '', style: TextStyle(color: isCompleted ? AppColors.textSecondary : AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 12),
                const SizedBox(width: 5),
                Text(dateStr, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.person_outline, color: AppColors.textMuted, size: 12),
                const SizedBox(width: 5),
                Text(venue, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
