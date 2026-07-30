import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

/// Accountability assignments (not HR work assignments).
class AssignmentsListScreen extends ConsumerStatefulWidget {
  const AssignmentsListScreen({super.key});

  @override
  ConsumerState<AssignmentsListScreen> createState() =>
      _AssignmentsListScreenState();
}

class _AssignmentsListScreenState extends ConsumerState<AssignmentsListScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _mine = [];
  List<Map<String, dynamic>> _register = [];
  List<Map<String, dynamic>> _capacity = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        dio.get('/assignments/mine'),
        dio.get('/assignments/register', queryParameters: {'per_page': 50}),
        dio.get('/assignments/capacity'),
      ]);
      if (!mounted) return;
      setState(() {
        _mine = extractListData(results[0].data);
        _register = extractListData(results[1].data);
        final cap = results[2].data;
        if (cap is Map && cap['data'] is List) {
          _capacity = extractListData(cap);
        } else if (cap is Map && cap['data'] is Map) {
          final nested = cap['data'] as Map;
          _capacity = extractListData(nested['people'] ?? nested['rows'] ?? nested);
        } else {
          _capacity = extractListData(cap);
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is DioException
            ? 'Failed to load assignments.'
            : 'Failed to load assignments.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        title: const Text('Assignments',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w800,
                fontSize: 18)),
        actions: [
          IconButton(
            tooltip: 'Audit',
            icon: const Icon(Icons.policy_outlined, color: AppColors.textSecondary),
            onPressed: () => context.push('/audit'),
          ),
          IconButton(
            icon: const Icon(Icons.calendar_month_outlined, color: AppColors.textSecondary),
            onPressed: () => context.push('/assignments/calendar'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _load,
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Mine'),
            Tab(text: 'Register'),
            Tab(text: 'Capacity'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/assignments/create'),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New', style: TextStyle(color: Colors.white)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!,
                          style:
                              const TextStyle(color: AppColors.textSecondary)),
                      TextButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _list(_mine, empty: 'No assignments assigned to you.'),
                    _list(_register, empty: 'Register is empty.'),
                    _capacityTab(),
                  ],
                ),
    );
  }

  Widget _list(List<Map<String, dynamic>> items, {required String empty}) {
    if (items.isEmpty) {
      return Center(
          child: Text(empty,
              style: const TextStyle(color: AppColors.textMuted)));
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final a = items[i];
          final id = a['id'];
          return ListTile(
            tileColor: AppColors.bgSurface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: AppColors.border),
            ),
            title: Text(a['title']?.toString() ?? 'Assignment',
                style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700)),
            subtitle: Text(
              '${a['status'] ?? '—'} · due ${a['due_date'] ?? '—'}',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
            trailing: const Icon(Icons.chevron_right,
                color: AppColors.textMuted),
            onTap: id == null
                ? null
                : () => context.push('/assignments/$id'),
          );
        },
      ),
    );
  }

  Widget _capacityTab() {
    if (_capacity.isEmpty) {
      return const Center(
          child: Text('No capacity rows returned.',
              style: TextStyle(color: AppColors.textMuted)));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _capacity.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final row = _capacity[i];
        final name = row['name'] ??
            row['user_name'] ??
            row['assignee'] ??
            'Person ${row['user_id'] ?? i + 1}';
        final load = row['open_count'] ??
            row['active_count'] ??
            row['load'] ??
            row['assignments_count'] ??
            '—';
        return ListTile(
          tileColor: AppColors.bgSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
          title: Text('$name',
              style: const TextStyle(
                  color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
          subtitle: Text('Open load: $load',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
        );
      },
    );
  }
}
