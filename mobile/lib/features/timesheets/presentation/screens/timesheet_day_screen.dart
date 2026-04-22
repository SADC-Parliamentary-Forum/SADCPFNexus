import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

/// A focused day-level view for a specific date, showing existing entries
/// and allowing new entries to be added via a bottom sheet.
///
/// Usage: push with GoRouter extra: {'date': 'YYYY-MM-DD', 'timesheetId': int?, 'entries': List}
class TimesheetDayScreen extends ConsumerStatefulWidget {
  final String date;
  final int? timesheetId;
  final List<Map<String, dynamic>> initialEntries;
  final List<Map<String, dynamic>> projects;
  final String? overlayLabel;
  final Color? overlayColor;

  const TimesheetDayScreen({
    super.key,
    required this.date,
    this.timesheetId,
    this.initialEntries = const [],
    this.projects = const [],
    this.overlayLabel,
    this.overlayColor,
  });

  @override
  ConsumerState<TimesheetDayScreen> createState() => _TimesheetDayScreenState();
}

class _TimesheetDayScreenState extends ConsumerState<TimesheetDayScreen> {
  late List<Map<String, dynamic>> _entries;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _entries = List.from(widget.initialEntries);
  }

  double get _totalHours =>
      _entries.fold(0.0, (s, e) => s + ((e['hours'] as num?)?.toDouble() ?? 0.0));

  void _removeEntry(int index) {
    setState(() => _entries.removeAt(index));
  }

  Future<void> _saveAndPop() async {
    if (widget.timesheetId == null) {
      Navigator.pop(context, _entries);
      return;
    }
    setState(() => _saving = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      // 1. Fetch the full timesheet so we preserve other days' entries
      final r = await dio.get<Map<String, dynamic>>('/hr/timesheets/${widget.timesheetId}');
      final existing = ((r.data?['data']?['entries'] ?? r.data?['entries']) as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      // 2. Drop all entries for this day, then re-add this screen's entries
      final otherDays = existing.where((e) => e['work_date'] != widget.date).toList();
      final merged = [
        ...otherDays,
        ..._entries.map((e) => {
          'work_date':   e['work_date'] ?? widget.date,
          'hours':       e['hours'],
          'description': e['description'],
          'work_bucket': e['work_bucket'],
          'project_id':  e['project_id'],
        }),
      ];
      // 3. PUT the merged entries back
      await dio.put<Map<String, dynamic>>(
        '/hr/timesheets/${widget.timesheetId}',
        data: {'entries': merged},
      );
      if (mounted) Navigator.pop(context, _entries);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().contains('SocketException') ? 'No connection — changes not saved.' : 'Failed to save. Try again.'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showAddEntry() {
    showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _DayEntrySheet(date: widget.date, projects: widget.projects),
    ).then((entry) {
      if (entry != null) {
        setState(() => _entries.add(entry));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dayFull = DateFormat('EEEE, d MMMM yyyy').format(DateTime.parse(widget.date));

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDarkDark : AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.bgSurfaceDark : AppColors.bgSurface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Day Detail', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            Text(dayFull, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _saving ? null : _saveAndPop,
            child: const Text('Done', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Overlay banner (leave/travel/holiday)
          if (widget.overlayLabel != null)
            Container(
              width: double.infinity,
              color: (widget.overlayColor ?? Colors.grey).withOpacity(0.12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: (widget.overlayColor ?? Colors.grey).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      widget.overlayLabel!,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: widget.overlayColor ?? Colors.grey,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'System-generated block — this day is already accounted for.',
                      style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ),
                ],
              ),
            ),

          // Hours summary row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: isDark ? AppColors.bgCardDark : AppColors.bgCard,
            child: Row(
              children: [
                const Icon(Icons.schedule_rounded, size: 18, color: AppColors.textMuted),
                const SizedBox(width: 8),
                Text('${_totalHours.toStringAsFixed(1)}h logged', style: const TextStyle(fontWeight: FontWeight.w600)),
                const Spacer(),
                if (_totalHours >= 8)
                  const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
                if (_totalHours > 0 && _totalHours < 8)
                  const Icon(Icons.warning_amber_rounded, color: AppColors.warning, size: 18),
              ],
            ),
          ),

          // Entries list
          Expanded(
            child: _entries.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.schedule_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No entries for this day', style: TextStyle(fontWeight: FontWeight.w600)),
                        SizedBox(height: 6),
                        Text('Tap + to add your first entry',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                    itemCount: _entries.length,
                    itemBuilder: (_, i) {
                      final e      = _entries[i];
                      final bucket = (e['work_bucket'] as String?) ?? 'other';
                      final h      = (e['hours'] as num?)?.toDouble() ?? 0.0;
                      final desc   = (e['description'] as String?) ?? bucket;
                      final projId = e['project_id'];
                      final proj   = projId != null
                          ? widget.projects.firstWhere((p) => p['id'] == projId, orElse: () => {})
                          : null;
                      final projLabel = (proj?['label'] as String?) ?? '';
                      final isLocked  = (e['is_locked'] as bool?) ?? false;
                      final sourceType = (e['source_type'] as String?) ?? 'manual';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.bgCardDark : AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          leading: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: isLocked ? Colors.grey.shade100 : AppColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              isLocked ? Icons.lock_outlined : Icons.work_outline_rounded,
                              size: 18,
                              color: isLocked ? AppColors.textMuted : AppColors.primary,
                            ),
                          ),
                          title: Text(desc, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (projLabel.isNotEmpty)
                                Text(projLabel, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                              if (isLocked)
                                Text(
                                  'Auto-filled · ${sourceType[0].toUpperCase()}${sourceType.substring(1)}',
                                  style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('${h.toStringAsFixed(1)}h', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                              if (!isLocked)
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                                  onPressed: () => _removeEntry(i),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: widget.overlayLabel == null
          ? FloatingActionButton(
              onPressed: _showAddEntry,
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black87,
              child: const Icon(Icons.add_rounded),
            )
          : null,
    );
  }
}

// ─── Day Entry Bottom Sheet ───────────────────────────────────────────────────

class _DayEntrySheet extends StatefulWidget {
  final String date;
  final List<Map<String, dynamic>> projects;

  const _DayEntrySheet({required this.date, required this.projects});

  @override
  State<_DayEntrySheet> createState() => _DayEntrySheetState();
}

class _DayEntrySheetState extends State<_DayEntrySheet> {
  final _descCtrl = TextEditingController();
  double _hours   = 1.0;
  String _bucket  = 'delivery';
  int?   _projectId;

  static const _buckets = [
    ('delivery', 'Delivery / Output'),
    ('meeting', 'Meeting'),
    ('communication', 'Communication'),
    ('administration', 'Administration'),
    ('other', 'Other'),
  ];

  static const _quickHours = [0.5, 1.0, 2.0, 3.0, 4.0, 8.0];

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: BoxDecoration(
          color: isDark ? AppColors.bgSurfaceDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Add Entry', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(context)),
              ],
            ),
            const SizedBox(height: 12),

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

            if (widget.projects.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('Project (optional)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 8),
              DropdownButtonFormField<int?>(
                value: _projectId,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
            ],

            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  Navigator.pop(context, {
                    'work_date':   widget.date,
                    'hours':       _hours,
                    'description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
                    'work_bucket': _bucket,
                    'project_id':  _projectId,
                    'source_type': 'manual',
                    'is_locked':   false,
                  });
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Add', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
