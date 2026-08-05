import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_card.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_screen.dart';

/// Mobile read of Audit Management dashboard + findings.
class AuditManagementScreen extends ConsumerStatefulWidget {
  const AuditManagementScreen({super.key});

  @override
  ConsumerState<AuditManagementScreen> createState() =>
      _AuditManagementScreenState();
}

class _AuditManagementScreenState extends ConsumerState<AuditManagementScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _dashboard = {};
  Map<String, dynamic> _analytics = {};
  List<Map<String, dynamic>> _findings = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
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
        dio.get('/audit-management/dashboard',
            queryParameters: {'view': 'auditor'}),
        dio.get('/audit-management/analytics'),
        dio.get('/audit-management/findings',
            queryParameters: {'per_page': 40}),
      ]);
      if (!mounted) return;
      setState(() {
        final dash = results[0].data;
        _dashboard = dash is Map && dash['data'] is Map
            ? Map<String, dynamic>.from(dash['data'] as Map)
            : {};
        final analytics = results[1].data;
        _analytics = analytics is Map && analytics['data'] is Map
            ? Map<String, dynamic>.from(analytics['data'] as Map)
            : {};
        _findings = extractListData(results[2].data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load audit workspace.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Audit',
      actions: [
        StitchIconAction(
          tooltip: 'Open accountability assignments',
          icon: Icons.assignment_outlined,
          onPressed: () => context.push('/assignments'),
        ),
        StitchIconAction(
          tooltip: 'Refresh',
          icon: Icons.refresh,
          onPressed: _loading ? null : _load,
        ),
      ],
      bottom: TabBar(
        controller: _tabs,
        labelColor: AppColors.primary,
        unselectedLabelColor: AppColors.textMuted,
        indicatorColor: AppColors.primary,
        tabs: const [
          Tab(text: 'Dashboard'),
          Tab(text: 'Findings'),
        ],
      ),
      body: _loading
          ? const StitchLoadingState(label: 'Loading audit workspace')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _DashboardTab(
                      dashboard: _dashboard,
                      analytics: _analytics,
                      onRefresh: _load,
                    ),
                    _FindingsTab(findings: _findings, onRefresh: _load),
                  ],
                ),
    );
  }
}

class _DashboardTab extends StatelessWidget {
  const _DashboardTab({
    required this.dashboard,
    required this.analytics,
    required this.onRefresh,
  });

  final Map<String, dynamic> dashboard;
  final Map<String, dynamic> analytics;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Assurance overview',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry
                  in dashboard.entries.where((entry) => entry.key != 'role'))
                _MetricChip(
                  label: entry.key.replaceAll('_', ' '),
                  value: '${entry.value}',
                ),
              _MetricChip(
                label: 'plan completion %',
                value: '${analytics['plan_completion_pct'] ?? 0}',
              ),
              _MetricChip(
                label: 'overdue CA rate %',
                value: '${analytics['overdue_corrective_rate'] ?? 0}',
              ),
            ],
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => context.push('/assignments'),
            icon: const Icon(Icons.assignment_turned_in_outlined),
            label: const Text('Open accountability'),
          ),
        ],
      ),
    );
  }
}

class _FindingsTab extends StatelessWidget {
  const _FindingsTab({required this.findings, required this.onRefresh});

  final List<Map<String, dynamic>> findings;
  final Future<void> Function() onRefresh;

  void _showFindingDetails(BuildContext context, Map<String, dynamic> finding) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${finding['title'] ?? 'Finding'}',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              ...finding.entries
                  .where((e) =>
                      e.value != null && e.value.toString().isNotEmpty)
                  .map(
                    (e) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 120,
                            child: Text(
                              e.key.replaceAll('_', ' '),
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              e.value.toString(),
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: findings.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 80),
                StitchEmptyState(
                  icon: Icons.fact_check_outlined,
                  title: 'No findings to show',
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: findings.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final finding = findings[i];
                return StitchCard(
                  padding: EdgeInsets.zero,
                  child: ListTile(
                    onTap: () => _showFindingDetails(context, finding),
                    title: Text(
                      '${finding['title'] ?? 'Finding'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${finding['rating'] ?? '-'} - ${finding['status'] ?? '-'}',
                    ),
                    trailing: Text(
                      '${finding['reference_number'] ?? finding['id'] ?? ''}',
                      style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: StitchCard(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label.toUpperCase(),
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
