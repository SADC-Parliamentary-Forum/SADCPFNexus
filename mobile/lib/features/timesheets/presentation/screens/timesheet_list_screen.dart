import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

class TimesheetListScreen extends ConsumerStatefulWidget {
  const TimesheetListScreen({super.key});

  @override
  ConsumerState<TimesheetListScreen> createState() => _TimesheetListScreenState();
}

class _TimesheetListScreenState extends ConsumerState<TimesheetListScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _timesheets = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ref.read(apiClientProvider).dio.get<Map<String, dynamic>>(
        '/hr/timesheets',
        queryParameters: {'per_page': 20},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>? ?? [];
      setState(() {
        _timesheets = data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load timesheets.'; _loading = false; });
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':  return AppColors.success;
      case 'submitted': return AppColors.warning;
      case 'rejected':  return AppColors.danger;
      default:          return AppColors.textMuted;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'approved':  return 'Approved';
      case 'submitted': return 'Pending';
      case 'rejected':  return 'Rejected';
      default:          return 'Draft';
    }
  }

  String _formatDateRange(String? start, String? end) {
    if (start == null || end == null) return '';
    try {
      final s = DateFormat('d MMM').format(DateTime.parse(start));
      final e = DateFormat('d MMM yyyy').format(DateTime.parse(end));
      return '$s – $e';
    } catch (_) {
      return '$start – $end';
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDarkDark : AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.bgSurfaceDark : AppColors.bgSurface,
        elevation: 0,
        title: const Text('Timesheets', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _load,
            tooltip: 'Refresh',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/timesheets/weekly'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.black87,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Log This Week', style: TextStyle(fontWeight: FontWeight.w600)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline_rounded, size: 40, color: AppColors.danger),
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: AppColors.danger)),
                      const SizedBox(height: 12),
                      OutlinedButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _timesheets.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.schedule_outlined, size: 48, color: AppColors.textMuted),
                          SizedBox(height: 12),
                          Text('No timesheets yet',
                              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                          SizedBox(height: 6),
                          Text('Tap + to log your first week',
                              style: TextStyle(color: AppColors.textMuted)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                        itemCount: _timesheets.length,
                        itemBuilder: (context, i) {
                          final ts     = _timesheets[i];
                          final status = (ts['status'] as String?) ?? 'draft';
                          final hours  = (ts['total_hours'] as num?)?.toDouble() ?? 0.0;
                          final weekRange = _formatDateRange(ts['week_start'] as String?, ts['week_end'] as String?);

                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.bgCardDark : AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              leading: Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: _statusColor(status).withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(Icons.schedule_rounded, color: _statusColor(status), size: 22),
                              ),
                              title: Text(
                                weekRange,
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: _statusColor(status).withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(
                                        _statusLabel(status),
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: _statusColor(status),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text('${hours.toStringAsFixed(1)}h logged',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                  ],
                                ),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (status == 'draft')
                                    TextButton(
                                      onPressed: () => context.push('/timesheets/weekly', extra: {'timesheetId': ts['id']}),
                                      style: TextButton.styleFrom(
                                        foregroundColor: AppColors.primary,
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                        minimumSize: Size.zero,
                                      ),
                                      child: const Text('Edit', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                                    ),
                                  const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
                                ],
                              ),
                              onTap: () => context.push('/timesheets/weekly', extra: {'timesheetId': ts['id']}),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
