import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';
import '../../../../shared/widgets/stitch_screen.dart';

/// SADC PF Calendar: Public Holidays (SADC region) and UN Days with alerts.
class CalendarHolidaysScreen extends ConsumerStatefulWidget {
  const CalendarHolidaysScreen({super.key});

  @override
  ConsumerState<CalendarHolidaysScreen> createState() => _CalendarHolidaysScreenState();
}

class _CalendarHolidaysScreenState extends ConsumerState<CalendarHolidaysScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<Map<String, dynamic>> _holidays = [];
  List<Map<String, dynamic>> _unDays = [];
  bool _loading = true;
  String? _error;
  final int _year = DateTime.now().year;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/calendar/entries',
        queryParameters: {'year': _year, 'per_page': 500},
      );
      final data = res.data;
      if (!mounted) return;
      final list = (data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final holidays = list.where((e) => e['type'] == 'sadc_holiday').toList();
      final unDays = list.where((e) => e['type'] == 'un_day').toList();
      holidays.sort((a, b) => (a['date'] ?? '').compareTo(b['date'] ?? ''));
      unDays.sort((a, b) => (a['date'] ?? '').compareTo(b['date'] ?? ''));
      setState(() {
        _holidays = holidays;
        _unDays = unDays;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load calendar.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'SADC Calendar & Holidays',
      fallbackRoute: '/dashboard',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/calendar/upload'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.upload_file, size: 18),
        label: const Text('Upload', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      bottom: TabBar(
        controller: _tabController,
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.textMuted,
        indicatorColor: AppColors.primary,
        tabs: const [
          Tab(text: 'Public Holidays'),
          Tab(text: 'UN Days'),
        ],
      ),
      actions: [
        StitchIconAction(
          tooltip: 'Refresh',
          icon: Icons.refresh,
          onPressed: _loading ? null : _load,
        ),
      ],
      body: _loading
          ? const StitchLoadingState(label: 'Loading calendar')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _ListEntries(entries: _holidays, type: 'sadc_holiday'),
                    _ListEntries(entries: _unDays, type: 'un_day'),
                  ],
                ),
    );
  }
}

class _ListEntries extends StatelessWidget {
  final List<Map<String, dynamic>> entries;
  final String type;

  const _ListEntries({required this.entries, required this.type});

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return StitchEmptyState(
        title: type == 'un_day'
            ? 'No UN days in this year'
            : 'No public holidays',
        message: type == 'un_day'
            ? 'Use upload to add UN day entries.'
            : 'Use upload to add SADC region holidays.',
        icon: type == 'un_day' ? Icons.public : Icons.celebration_outlined,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: entries.length,
      itemBuilder: (context, i) {
        final e = entries[i];
        final date = e['date']?.toString();
        final title = e['title']?.toString() ?? '';
        final isAlert = e['is_alert'] == true;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isAlert ? AppColors.info.withValues(alpha: 0.5) : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: (type == 'un_day' ? AppColors.info : AppColors.primary)
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  type == 'un_day' ? Icons.public : Icons.celebration_outlined,
                  color: type == 'un_day' ? AppColors.info : AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      AppDateFormatter.short(date),
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (isAlert)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Alert',
                    style: TextStyle(color: AppColors.info, fontSize: 10, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
