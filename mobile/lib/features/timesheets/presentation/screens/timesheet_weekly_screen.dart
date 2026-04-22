import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

/// Returns the Monday of the week containing [date].
DateTime _getMonday(DateTime date) {
  final diff = date.weekday - DateTime.monday;
  return DateTime(date.year, date.month, date.day).subtract(Duration(days: diff));
}

String _toYMD(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

class TimesheetWeeklyScreen extends ConsumerStatefulWidget {
  final int? timesheetId;

  const TimesheetWeeklyScreen({super.key, this.timesheetId});

  @override
  ConsumerState<TimesheetWeeklyScreen> createState() => _TimesheetWeeklyScreenState();
}

class _TimesheetWeeklyScreenState extends ConsumerState<TimesheetWeeklyScreen> {
  bool _loading = true;
  bool _saving  = false;
  String? _error;

  late DateTime _weekStart;
  Map<String, dynamic>? _timesheet;
  List<Map<String, dynamic>> _entries = [];

  // Overlay maps: date -> info
  Map<String, Map<String, dynamic>> _leaveDays    = {};
  Map<String, Map<String, dynamic>> _travelDays   = {};
  Map<String, Map<String, dynamic>> _holidayDates = {};
  List<Map<String, dynamic>> _projects = [];

  @override
  void initState() {
    super.initState();
    _weekStart = _getMonday(DateTime.now());
    _load();
  }

  DateTime get _weekEnd => _weekStart.add(const Duration(days: 6));
  List<DateTime> get _weekDates => List.generate(5, (i) => _weekStart.add(Duration(days: i)));

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    final start = _toYMD(_weekStart);
    final end   = _toYMD(_weekEnd);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        dio.get<Map<String, dynamic>>('/hr/timesheets', queryParameters: {'week_start': start}),
        dio.get<Map<String, dynamic>>('/hr/timesheets/leave-days', queryParameters: {'week_start': start, 'week_end': end}),
        dio.get<Map<String, dynamic>>('/hr/timesheets/travel-days', queryParameters: {'week_start': start, 'week_end': end}),
        dio.get<Map<String, dynamic>>('/hr/timesheets/holiday-dates', queryParameters: {'start': start, 'end': end}),
        dio.get<Map<String, dynamic>>('/admin/timesheet-projects'),
      ]);

      if (!mounted) return;

      final tsData  = (results[0].data?['data'] as List<dynamic>? ?? []);
      final ts      = tsData.isNotEmpty ? Map<String, dynamic>.from(tsData.first as Map) : null;
      final entries = ((ts?['entries'] as List<dynamic>?) ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

      setState(() {
        _timesheet    = ts;
        _entries      = entries;
        _leaveDays    = _parseOverlay(results[1].data?['data']);
        _travelDays   = _parseOverlay(results[2].data?['data']);
        _holidayDates = _parseOverlay(results[3].data?['data']);
        _projects     = ((results[4].data?['data'] as List<dynamic>?) ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load timesheet.'; _loading = false; });
    }
  }

  Map<String, Map<String, dynamic>> _parseOverlay(dynamic raw) {
    if (raw == null) return {};
    final map = raw as Map<String, dynamic>;
    return map.map((k, v) => MapEntry(k, Map<String, dynamic>.from(v as Map)));
  }

  Future<void> _submit() async {
    final ts = _timesheet;
    if (ts == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Save entries first before submitting.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(apiClientProvider).dio.post<Map<String, dynamic>>(
        '/hr/timesheets/${ts['id']}/submit',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Timesheet submitted for approval.')),
      );
      await _load();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit.')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _prevWeek() {
    setState(() { _weekStart = _weekStart.subtract(const Duration(days: 7)); });
    _load();
  }

  void _nextWeek() {
    setState(() { _weekStart = _weekStart.add(const Duration(days: 7)); });
    _load();
  }

  String _dayOverlayLabel(String ymd) {
    if (_holidayDates.containsKey(ymd)) return _holidayDates[ymd]!['name'] as String? ?? 'Holiday';
    if (_travelDays.containsKey(ymd))   return 'Mission';
    if (_leaveDays.containsKey(ymd)) {
      final lt = (_leaveDays[ymd]!['leave_type'] as String? ?? 'leave').replaceAll('_', ' ');
      return lt[0].toUpperCase() + lt.substring(1);
    }
    return '';
  }

  Color _dayOverlayColor(String ymd) {
    if (_holidayDates.containsKey(ymd)) return Colors.grey.shade400;
    if (_travelDays.containsKey(ymd))   return const Color(0xFF0D9488); // teal
    if (_leaveDays.containsKey(ymd))    return const Color(0xFFD97706); // amber
    return Colors.transparent;
  }

  double _hoursForDay(String ymd) =>
      _entries.where((e) => e['work_date'] == ymd).fold(0.0, (s, e) => s + ((e['hours'] as num?)?.toDouble() ?? 0.0));

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final status = (_timesheet?['status'] as String?) ?? 'draft';
    final isDraft = status == 'draft' || _timesheet == null;

    final weekLabel =
        '${DateFormat('d MMM').format(_weekStart)} – ${DateFormat('d MMM yyyy').format(_weekStart.add(const Duration(days: 4)))}';

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDarkDark : AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.bgSurfaceDark : AppColors.bgSurface,
        elevation: 0,
        leading: BackButton(onPressed: () => context.canPop() ? context.pop() : context.go('/timesheets')),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Weekly Timesheet', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            Text(weekLabel, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.chevron_left_rounded), onPressed: _prevWeek, tooltip: 'Prev week'),
          IconButton(icon: const Icon(Icons.chevron_right_rounded), onPressed: _nextWeek, tooltip: 'Next week'),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Status bar
                if (_timesheet != null)
                  Container(
                    color: isDark ? AppColors.bgCardDark : AppColors.bgCard,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Row(
                      children: [
                        _StatusChip(status: status),
                        const SizedBox(width: 8),
                        Text(
                          'Week total: ${_entries.fold(0.0, (s, e) => s + ((e['hours'] as num?)?.toDouble() ?? 0.0)).toStringAsFixed(1)}h',
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),

                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(_error!, style: const TextStyle(color: AppColors.danger)),
                  ),

                // Day cards
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                    children: [
                      ..._weekDates.map((d) {
                        final ymd     = _toYMD(d);
                        final dayName = DateFormat('EEEE').format(d);
                        final dayDate = DateFormat('d MMM').format(d);
                        final overlay = _dayOverlayLabel(ymd);
                        final oColor  = _dayOverlayColor(ymd);
                        final hours   = _hoursForDay(ymd);
                        final dayEntries = _entries.where((e) => e['work_date'] == ymd).toList();

                        return GestureDetector(
                          onTap: () async {
                            await context.push('/timesheets/day', extra: {
                              'date': ymd,
                              'timesheetId': _timesheet?['id'],
                              'entries': dayEntries,
                              'projects': _projects,
                              'overlayLabel': overlay.isNotEmpty ? overlay : null,
                            });
                            if (mounted) _load();
                          },
                          child: Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            color: isDark ? AppColors.bgCardDark : AppColors.bgSurface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Day header
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: overlay.isNotEmpty ? oColor.withOpacity(0.08) : Colors.transparent,
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(dayName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                          Text(dayDate, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                                        ],
                                      ),
                                    ),
                                    if (overlay.isNotEmpty)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: oColor.withOpacity(0.15),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(overlay, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: oColor)),
                                      )
                                    else if (hours > 0)
                                      Text('${hours.toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.primary)),
                                  ],
                                ),
                              ),

                              // Entries
                              if (dayEntries.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                                  child: Column(
                                    children: dayEntries.map((e) {
                                      final bucket = (e['work_bucket'] as String?) ?? 'other';
                                      final h = (e['hours'] as num?)?.toDouble() ?? 0.0;
                                      final desc = e['description'] as String?;
                                      final projId = e['project_id'];
                                      final proj = projId != null
                                          ? _projects.firstWhere((p) => p['id'] == projId, orElse: () => {})
                                          : null;
                                      final projLabel = (proj?['label'] as String?) ?? '';
                                      final isLocked = (e['is_locked'] as bool?) ?? false;
                                      return Container(
                                        margin: const EdgeInsets.only(bottom: 6),
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                        decoration: BoxDecoration(
                                          color: isDark ? AppColors.bgDarkDark : AppColors.bgCard,
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(desc ?? bucket, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                                                  if (projLabel.isNotEmpty)
                                                    Text(projLabel, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                                ],
                                              ),
                                            ),
                                            Text('${h.toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                                            if (!isLocked && isDraft)
                                              IconButton(
                                                icon: const Icon(Icons.delete_outline_rounded, size: 16, color: AppColors.danger),
                                                onPressed: () {
                                                  setState(() => _entries.remove(e));
                                                },
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                              ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ),

                              // Add entry button (only for non-system days and draft)
                              if (overlay.isEmpty && isDraft)
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                                  child: OutlinedButton.icon(
                                    onPressed: () => _showAddEntry(ymd),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: AppColors.primary,
                                      side: const BorderSide(color: AppColors.primary, width: 1),
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      minimumSize: const Size(double.infinity, 36),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    icon: const Icon(Icons.add_rounded, size: 16),
                                    label: const Text('Add Entry', style: TextStyle(fontSize: 13)),
                                  ),
                                ),
                            ],
                          ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),

                // Bottom action bar
                if (isDraft)
                  SafeArea(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      color: isDark ? AppColors.bgSurfaceDark : AppColors.bgSurface,
                      child: Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _saving ? null : () => _saveEntries(),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.primary,
                                side: const BorderSide(color: AppColors.primary),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              child: const Text('Save Draft', style: TextStyle(fontWeight: FontWeight.w600)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton(
                              onPressed: (_saving || _entries.isEmpty) ? null : _submit,
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.black87,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              child: _saving
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black54))
                                  : const Text('Submit', style: TextStyle(fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Future<void> _saveEntries() async {
    if (_entries.isEmpty) return;
    setState(() => _saving = true);
    try {
      final dio  = ref.read(apiClientProvider).dio;
      final start = _toYMD(_weekStart);
      final end   = _toYMD(_weekEnd);
      final payload = _entries.map((e) => {
        'work_date':   e['work_date'],
        'hours':       e['hours'],
        'description': e['description'],
        'work_bucket': e['work_bucket'],
        'project_id':  e['project_id'],
      }).toList();

      if (_timesheet != null) {
        final res = await dio.put<Map<String, dynamic>>(
          '/hr/timesheets/${_timesheet!['id']}',
          data: {'entries': payload},
        );
        final updated = (res.data?['data'] as Map<String, dynamic>?);
        if (updated != null && mounted) {
          setState(() {
            _timesheet = updated;
            _entries = ((updated['entries'] as List<dynamic>?) ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
          });
        }
      } else {
        final res = await dio.post<Map<String, dynamic>>(
          '/hr/timesheets',
          data: {'week_start': start, 'week_end': end, 'entries': payload},
        );
        final created = (res.data?['data'] as Map<String, dynamic>?);
        if (created != null && mounted) {
          setState(() {
            _timesheet = created;
            _entries = ((created['entries'] as List<dynamic>?) ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
          });
        }
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save.')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showAddEntry(String ymd) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => _AddEntrySheet(
        initialDate: ymd,
        weekStart: _weekStart,
        projects: _projects,
        onAddMany: (entries) {
          setState(() => _entries.addAll(entries));
        },
      ),
    );
  }
}

// ─── Status Chip ─────────────────────────────────────────────────────────────

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;
    switch (status) {
      case 'approved':  color = AppColors.success; label = 'Approved'; break;
      case 'submitted': color = AppColors.warning;  label = 'Pending';  break;
      case 'rejected':  color = AppColors.danger;   label = 'Rejected'; break;
      default:          color = AppColors.textMuted; label = 'Draft';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color)),
    );
  }
}

// ─── Add Entry Sheet ──────────────────────────────────────────────────────────

enum _SpanMode { single, week, range }

class _AddEntrySheet extends StatefulWidget {
  final String initialDate;
  final DateTime weekStart;
  final List<Map<String, dynamic>> projects;
  final void Function(List<Map<String, dynamic>>) onAddMany;

  const _AddEntrySheet({
    required this.initialDate,
    required this.weekStart,
    required this.projects,
    required this.onAddMany,
  });

  @override
  State<_AddEntrySheet> createState() => _AddEntrySheetState();
}

class _AddEntrySheetState extends State<_AddEntrySheet> {
  final _descCtrl = TextEditingController();
  double _hours = 1.0;
  String _bucket = 'delivery';
  int? _projectId;
  _SpanMode _spanMode = _SpanMode.single;
  late DateTime _rangeFrom;
  late DateTime _rangeTo;

  static const _buckets = [
    ('delivery',       'Delivery'),
    ('meeting',        'Meeting'),
    ('communication',  'Communication'),
    ('administration', 'Administration'),
    ('other',          'Other'),
  ];

  static const _quickHours = [0.5, 1.0, 2.0, 4.0, 8.0];

  @override
  void initState() {
    super.initState();
    _rangeFrom = widget.weekStart;
    _rangeTo = widget.weekStart.add(const Duration(days: 4)); // Friday
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  /// Returns working days (Mon–Fri) in [from, to] inclusive.
  List<DateTime> _workingDays(DateTime from, DateTime to) {
    final days = <DateTime>[];
    var cur = DateTime(from.year, from.month, from.day);
    final end = DateTime(to.year, to.month, to.day);
    while (!cur.isAfter(end)) {
      if (cur.weekday >= DateTime.monday && cur.weekday <= DateTime.friday) {
        days.add(cur);
      }
      cur = cur.add(const Duration(days: 1));
    }
    return days;
  }

  List<DateTime> get _selectedDays {
    switch (_spanMode) {
      case _SpanMode.single:
        final d = DateFormat('yyyy-MM-dd').parse(widget.initialDate);
        return [d];
      case _SpanMode.week:
        return _workingDays(widget.weekStart, widget.weekStart.add(const Duration(days: 4)));
      case _SpanMode.range:
        return _workingDays(_rangeFrom, _rangeTo);
    }
  }

  Future<void> _pickDate(bool isFrom) async {
    final initial = isFrom ? _rangeFrom : _rangeTo;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null && mounted) {
      setState(() {
        if (isFrom) {
          _rangeFrom = picked;
          if (_rangeTo.isBefore(_rangeFrom)) _rangeTo = _rangeFrom;
        } else {
          _rangeTo = picked;
          if (_rangeFrom.isAfter(_rangeTo)) _rangeFrom = _rangeTo;
        }
      });
    }
  }

  String _fmtDate(DateTime d) => DateFormat('d MMM').format(d);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final days = _selectedDays;
    final dayCount = days.length;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: BoxDecoration(
          color: isDark ? AppColors.bgSurfaceDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Add Entry', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(context)),
                ],
              ),
              const SizedBox(height: 12),

              // ── Date Span ──────────────────────────────────────────────────
              const Text('Date Span', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              // Mode selector
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [_SpanMode.single, _SpanMode.week, _SpanMode.range].map((mode) {
                    final selected = _spanMode == mode;
                    final label = mode == _SpanMode.single ? 'Single' : mode == _SpanMode.week ? 'This Week' : 'Range';
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _spanMode = mode),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: selected ? AppColors.primary : Colors.transparent,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            label,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: selected ? Colors.black87 : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 10),

              // Span detail
              if (_spanMode == _SpanMode.single)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.bgCardDark : AppColors.bgCard,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Text(widget.initialDate, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                    ],
                  ),
                )
              else if (_spanMode == _SpanMode.week)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.date_range_rounded, size: 16, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Text(
                        '${_fmtDate(widget.weekStart)} – ${_fmtDate(widget.weekStart.add(const Duration(days: 4)))}  •  5 working days',
                        style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                )
              else ...[
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(true),
                        icon: const Icon(Icons.calendar_today_rounded, size: 14),
                        label: Text(_fmtDate(_rangeFrom), style: const TextStyle(fontSize: 13)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Text('to', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    ),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _pickDate(false),
                        icon: const Icon(Icons.calendar_today_rounded, size: 14),
                        label: Text(_fmtDate(_rangeTo), style: const TextStyle(fontSize: 13)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
                if (dayCount > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      '$dayCount working ${dayCount == 1 ? 'day' : 'days'} selected',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ),
              ],

              const SizedBox(height: 16),

              // ── Description ────────────────────────────────────────────────
              TextField(
                controller: _descCtrl,
                decoration: InputDecoration(
                  labelText: 'Description',
                  hintText: 'What did you work on?',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                textCapitalization: TextCapitalization.sentences,
                maxLines: 2,
              ),
              const SizedBox(height: 14),

              // ── Hours ──────────────────────────────────────────────────────
              const Text('Hours', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _quickHours.map((h) => ChoiceChip(
                  label: Text('${h}h'),
                  selected: _hours == h,
                  onSelected: (_) => setState(() => _hours = h),
                  selectedColor: AppColors.primary.withOpacity(0.2),
                  labelStyle: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: _hours == h ? AppColors.primaryDark : AppColors.textSecondary,
                  ),
                )).toList(),
              ),
              const SizedBox(height: 14),

              // ── Work Type ──────────────────────────────────────────────────
              const Text('Work Type', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _bucket,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                items: _buckets.map((b) => DropdownMenuItem(value: b.$1, child: Text(b.$2))).toList(),
                onChanged: (v) => setState(() => _bucket = v ?? 'delivery'),
              ),
              const SizedBox(height: 14),

              // ── Project ────────────────────────────────────────────────────
              if (widget.projects.isNotEmpty) ...[
                const Text('Project (optional)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 8),
                DropdownButtonFormField<int?>(
                  value: _projectId,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    hintText: 'None',
                  ),
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('— None —')),
                    ...widget.projects.map((p) => DropdownMenuItem<int?>(
                      value: p['id'] as int?,
                      child: Text((p['label'] as String?) ?? ''),
                    )),
                  ],
                  onChanged: (v) => setState(() => _projectId = v),
                ),
                const SizedBox(height: 14),
              ],

              // ── Submit ─────────────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: dayCount == 0
                      ? null
                      : () {
                          final desc = _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim();
                          final entries = days.map((d) => {
                            'work_date':   _toYMD(d),
                            'hours':       _hours,
                            'description': desc,
                            'work_bucket': _bucket,
                            'project_id':  _projectId,
                            'source_type': 'manual',
                          }).toList();
                          widget.onAddMany(entries);
                          Navigator.pop(context);
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black87,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    dayCount > 1 ? 'Add $dayCount Entries' : 'Add Entry',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
