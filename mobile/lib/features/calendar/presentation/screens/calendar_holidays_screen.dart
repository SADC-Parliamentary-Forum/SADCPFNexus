import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

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
  int _year = DateTime.now().year;

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
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/calendar/upload'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.upload_file, size: 18),
        label: const Text('Upload', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'SADC Calendar & Holidays',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
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
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.danger)),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: _load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
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
      return Center(
        child: Text(
          type == 'un_day'
              ? 'No UN days in this year. Use upload to add entries.'
              : 'No public holidays. Use upload to add SADC region holidays.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
        ),
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
