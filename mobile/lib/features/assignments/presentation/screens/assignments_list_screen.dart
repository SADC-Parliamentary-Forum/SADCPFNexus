import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_card.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_screen.dart';

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
          _capacity =
              extractListData(nested['people'] ?? nested['rows'] ?? nested);
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
    return StitchScreen(
      title: 'Accountability',
      actions: [
        StitchIconAction(
          tooltip: 'Open audit workspace',
          icon: Icons.policy_outlined,
          onPressed: () => context.push('/audit'),
        ),
        StitchIconAction(
          tooltip: 'Open calendar',
          icon: Icons.calendar_month_outlined,
          onPressed: () => context.push('/assignments/calendar'),
        ),
        StitchIconAction(
          tooltip: 'Refresh',
          icon: Icons.refresh,
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
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/assignments/create'),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add),
        label: const Text('New'),
      ),
      body: _loading
          ? const StitchLoadingState(label: 'Loading assignments')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
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
      return StitchEmptyState(
        icon: Icons.assignment_outlined,
        title: empty,
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final assignment = items[i];
          final id = assignment['id'];
          return StitchCard(
            padding: EdgeInsets.zero,
            onTap: id == null ? null : () => context.push('/assignments/$id'),
            child: ListTile(
              title: Text(
                assignment['title']?.toString() ?? 'Assignment',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _statusChip(assignment['status']),
                    Text(
                      'Due ${assignment['due_date'] ?? '-'}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              trailing:
                  const Icon(Icons.chevron_right, color: AppColors.textMuted),
            ),
          );
        },
      ),
    );
  }

  Widget _statusChip(Object? rawStatus) {
    final status = rawStatus?.toString() ?? 'unknown';
    final label = status
        .replaceAll('_', ' ')
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Text(
        label.isEmpty ? 'Unknown' : label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'in_progress':
      case 'started':
        return AppColors.primary;
      case 'completed':
      case 'closed':
        return AppColors.success;
      case 'overdue':
      case 'blocked':
      case 'rejected':
        return AppColors.danger;
      default:
        return AppColors.textMuted;
    }
  }

  Widget _capacityTab() {
    if (_capacity.isEmpty) {
      return const StitchEmptyState(
        icon: Icons.groups_outlined,
        title: 'No capacity rows returned',
      );
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
            '-';
        return StitchCard(
          padding: EdgeInsets.zero,
          child: ListTile(
            title: Text(
              '$name',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Text(
              'Open load: $load',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
            ),
          ),
        );
      },
    );
  }
}
