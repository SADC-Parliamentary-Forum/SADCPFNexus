import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';

class AssignmentsCalendarScreen extends ConsumerStatefulWidget {
  const AssignmentsCalendarScreen({super.key});

  @override
  ConsumerState<AssignmentsCalendarScreen> createState() =>
      _AssignmentsCalendarScreenState();
}

class _AssignmentsCalendarScreenState
    extends ConsumerState<AssignmentsCalendarScreen> {
  DateTime _cursor = DateTime.now();
  bool _weekMode = false;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  (DateTime, DateTime) _bounds() {
    if (_weekMode) {
      final start = _cursor.subtract(Duration(days: _cursor.weekday % 7));
      final end = start.add(const Duration(days: 6));
      return (DateTime(start.year, start.month, start.day),
          DateTime(end.year, end.month, end.day));
    }
    final from = DateTime(_cursor.year, _cursor.month, 1);
    final to = DateTime(_cursor.year, _cursor.month + 1, 0);
    return (from, to);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final (from, to) = _bounds();
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get('/assignments/calendar', queryParameters: {
        'from': DateFormat('yyyy-MM-dd').format(from),
        'to': DateFormat('yyyy-MM-dd').format(to),
        'scope': 'mine',
      });
      final raw = res.data;
      List list;
      if (raw is Map && raw['data'] is List) {
        list = raw['data'] as List;
      } else if (raw is List) {
        list = raw;
      } else {
        list = const [];
      }
      if (!mounted) return;
      setState(() {
        _items = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load calendar';
        _loading = false;
      });
    }
  }

  Map<String, List<Map<String, dynamic>>> get _byDay {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final item in _items) {
      final day = item['due_date']?.toString().substring(0, 10);
      if (day == null || day.length < 10) continue;
      map.putIfAbsent(day, () => []).add(item);
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final (from, to) = _bounds();
    final label = _weekMode
        ? '${DateFormat('d MMM').format(from)} – ${DateFormat('d MMM y').format(to)}'
        : DateFormat('MMMM y').format(_cursor);

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('Assignment calendar',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _weekMode = !_weekMode);
              _load();
            },
            child: Text(_weekMode ? 'Month' : 'Week',
                style: const TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                IconButton(
                  onPressed: () {
                    setState(() {
                      _cursor = _weekMode
                          ? _cursor.subtract(const Duration(days: 7))
                          : DateTime(_cursor.year, _cursor.month - 1, 1);
                    });
                    _load();
                  },
                  icon: const Icon(Icons.chevron_left,
                      color: AppColors.textPrimary),
                ),
                Expanded(
                  child: Text(label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700)),
                ),
                IconButton(
                  onPressed: () {
                    setState(() {
                      _cursor = _weekMode
                          ? _cursor.add(const Duration(days: 7))
                          : DateTime(_cursor.year, _cursor.month + 1, 1);
                    });
                    _load();
                  },
                  icon: const Icon(Icons.chevron_right,
                      color: AppColors.textPrimary),
                ),
              ],
            ),
          ),
          if (_loading)
            const Expanded(
                child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Expanded(
                child: Center(
                    child: Text(_error!,
                        style: const TextStyle(color: AppColors.danger))))
          else
            Expanded(child: _weekMode ? _buildWeek() : _buildMonth()),
        ],
      ),
    );
  }

  Widget _buildMonth() {
    final first = DateTime(_cursor.year, _cursor.month, 1);
    final daysInMonth = DateTime(_cursor.year, _cursor.month + 1, 0).day;
    final lead = first.weekday % 7;
    final cells = <DateTime?>[];
    for (var i = 0; i < lead; i++) cells.add(null);
    for (var d = 1; d <= daysInMonth; d++) {
      cells.add(DateTime(_cursor.year, _cursor.month, d));
    }
    final byDay = _byDay;
    return GridView.builder(
      padding: const EdgeInsets.all(8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 4,
        crossAxisSpacing: 4,
        childAspectRatio: 0.7,
      ),
      itemCount: cells.length,
      itemBuilder: (context, i) {
        final day = cells[i];
        if (day == null) return const SizedBox.shrink();
        final key = DateFormat('yyyy-MM-dd').format(day);
        final items = byDay[key] ?? [];
        return Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${day.day}',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 11)),
              ...items.take(2).map((it) => GestureDetector(
                    onTap: () => context.push('/assignments/${it['id']}'),
                    child: Text(
                      it['title']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.primary, fontSize: 9),
                    ),
                  )),
              if (items.length > 2)
                Text('+${items.length - 2}',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 9)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildWeek() {
    final (from, _) = _bounds();
    final byDay = _byDay;
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: 7,
      itemBuilder: (context, i) {
        final day = from.add(Duration(days: i));
        final key = DateFormat('yyyy-MM-dd').format(day);
        final items = byDay[key] ?? [];
        return Card(
          color: AppColors.bgSurface,
          child: ExpansionTile(
            title: Text(DateFormat('EEE d MMM').format(day),
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700)),
            subtitle: Text('${items.length} due',
                style: const TextStyle(color: AppColors.textMuted)),
            children: items
                .map((it) => ListTile(
                      title: Text(it['title']?.toString() ?? '',
                          style:
                              const TextStyle(color: AppColors.textPrimary)),
                      onTap: () => context.push('/assignments/${it['id']}'),
                    ))
                .toList(),
          ),
        );
      },
    );
  }
}

