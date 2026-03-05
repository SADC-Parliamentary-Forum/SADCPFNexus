import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class DelegationMeetingsScreen extends StatefulWidget {
  const DelegationMeetingsScreen({super.key});
  @override
  State<DelegationMeetingsScreen> createState() => _DelegationMeetingsScreenState();
}

class _DelegationMeetingsScreenState extends State<DelegationMeetingsScreen> {
  String _filter = 'Upcoming';
  final _filters = ['Upcoming', 'Ongoing', 'Completed', 'All'];

  final _meetings = [
    {'title': 'SADC-PF Plenary Session', 'date': 'Mon, 10 Mar 2026', 'time': '09:00 – 17:00', 'venue': 'Windhoek, Namibia', 'type': 'Plenary', 'status': 'Upcoming', 'delegates': 42, 'quorum': true},
    {'title': 'Standing Committee on Finance', 'date': 'Wed, 12 Mar 2026', 'time': '10:00 – 13:00', 'venue': 'Virtual', 'type': 'Committee', 'status': 'Upcoming', 'delegates': 18, 'quorum': true},
    {'title': 'Budget Review Working Group', 'date': 'Thu, 13 Mar 2026', 'time': '14:00 – 16:00', 'venue': 'Gaborone, Botswana', 'type': 'Working Group', 'status': 'Upcoming', 'delegates': 12, 'quorum': false},
    {'title': 'Regional Cooperation Summit', 'date': 'Fri, 28 Feb 2026', 'time': '09:00 – 18:00', 'venue': 'Harare, Zimbabwe', 'type': 'Summit', 'status': 'Completed', 'delegates': 65, 'quorum': true},
  ];

  List<Map<String, dynamic>> get _filtered => _filter == 'All'
      ? List.from(_meetings)
      : _meetings.where((m) => m['status'] == _filter).map((m) => Map<String, dynamic>.from(m)).toList();

  Color _typeColor(String t) {
    if (t == 'Plenary') return AppColors.primary;
    if (t == 'Committee') return AppColors.info;
    if (t == 'Summit') return AppColors.gold;
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
        title: const Text('Meetings & Delegations', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.calendar_month, color: AppColors.primary), onPressed: () {}),
        ],
      ),
      body: Column(
        children: [
          // Stats row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              _statCard('This Month', '6', AppColors.primary, Icons.event),
              const SizedBox(width: 10),
              _statCard('Total Delegates', '187', AppColors.gold, Icons.people_outline),
              const SizedBox(width: 10),
              _statCard('Quorum Met', '5/6', AppColors.success, Icons.verified_outlined),
            ]),
          ),
          const SizedBox(height: 12),
          // Filters
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
            child: filtered.isEmpty
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
    final typeColor = _typeColor(m['type'] as String);
    final isCompleted = m['status'] == 'Completed';
    return GestureDetector(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(m['type'] as String, style: TextStyle(color: typeColor, fontSize: 10, fontWeight: FontWeight.w700))),
            const Spacer(),
            if (m['quorum'] as bool)
              const Row(children: [
                Icon(Icons.verified, color: AppColors.success, size: 12),
                SizedBox(width: 3),
                Text('Quorum', style: TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w600)),
              ]),
          ]),
          const SizedBox(height: 8),
          Text(m['title'] as String, style: TextStyle(
            color: isCompleted ? AppColors.textSecondary : AppColors.textPrimary,
            fontSize: 14, fontWeight: FontWeight.w700,
          )),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.calendar_today_outlined, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 5),
            Text(m['date'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            const SizedBox(width: 10),
            const Icon(Icons.access_time, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 5),
            Text(m['time'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(Icons.location_on_outlined, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 5),
            Text(m['venue'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            const Spacer(),
            const Icon(Icons.people_outline, color: AppColors.textMuted, size: 12),
            const SizedBox(width: 4),
            Text('${m['delegates']} delegates', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ]),
        ]),
      ),
    );
  }
}
