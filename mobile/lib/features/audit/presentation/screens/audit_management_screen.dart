import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

/// Mobile read of Audit Management dashboard + findings (Phase 2 polish).
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
        dio.get('/audit-management/dashboard', queryParameters: {'view': 'auditor'}),
        dio.get('/audit-management/analytics'),
        dio.get('/audit-management/findings', queryParameters: {'per_page': 40}),
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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load audit workspace.';
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
        title: const Text(
          'Audit',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
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
        actions: [
          IconButton(
            tooltip: 'Assignments',
            onPressed: () => context.push('/assignments'),
            icon: const Icon(Icons.assignment_outlined, color: AppColors.textSecondary),
          ),
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [
                    RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
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
                              for (final e in _dashboard.entries.where((e) => e.key != 'role'))
                                _MetricChip(
                                  label: e.key.replaceAll('_', ' '),
                                  value: '${e.value}',
                                ),
                              _MetricChip(
                                label: 'plan completion %',
                                value: '${_analytics['plan_completion_pct'] ?? 0}',
                              ),
                              _MetricChip(
                                label: 'overdue CA rate %',
                                value: '${_analytics['overdue_corrective_rate'] ?? 0}',
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          OutlinedButton.icon(
                            onPressed: () => context.push('/assignments'),
                            icon: const Icon(Icons.assignment_turned_in_outlined),
                            label: const Text('Open assignments'),
                          ),
                        ],
                      ),
                    ),
                    RefreshIndicator(
                      onRefresh: _load,
                      child: _findings.isEmpty
                          ? ListView(
                              children: const [
                                SizedBox(height: 80),
                                Center(child: Text('No findings to show.')),
                              ],
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _findings.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (context, i) {
                                final f = _findings[i];
                                return Card(
                                  color: AppColors.bgSurface,
                                  child: ListTile(
                                    title: Text('${f['title'] ?? 'Finding'}'),
                                    subtitle: Text(
                                      '${f['rating'] ?? '—'} · ${f['status'] ?? '—'}',
                                    ),
                                    trailing: Text(
                                      '${f['reference_number'] ?? f['id'] ?? ''}',
                                      style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
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
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
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
    );
  }
}
