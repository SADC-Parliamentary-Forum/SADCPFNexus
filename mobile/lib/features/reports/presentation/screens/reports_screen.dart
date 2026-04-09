import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/shell_drawer_scope.dart';

const _reportTypes = [
  _ReportType(
    title: 'Travel & Missions',
    subtitle: 'Mission requests, travel summaries, and institutional travel reports',
    icon: Icons.flight_takeoff_rounded,
    color: AppColors.primary,
    tag: 'Travel',
    apiKey: 'travel',
  ),
  _ReportType(
    title: 'Leave Management',
    subtitle: 'Leave usage, balances, and leave request reporting',
    icon: Icons.event_available_rounded,
    color: AppColors.success,
    tag: 'Leave',
    apiKey: 'leave',
  ),
  _ReportType(
    title: 'DSA & Allowances',
    subtitle: 'Allowance and mission subsistence reporting',
    icon: Icons.payments_rounded,
    color: AppColors.warning,
    tag: 'Finance',
    apiKey: 'dsa',
  ),
  _ReportType(
    title: 'Imprest & Finance',
    subtitle: 'Imprest requests, advances, and repayment activity',
    icon: Icons.account_balance_wallet_rounded,
    color: AppColors.info,
    tag: 'Finance',
    apiKey: 'finance',
  ),
  _ReportType(
    title: 'Procurement',
    subtitle: 'Procurement requests and sourcing activity',
    icon: Icons.shopping_cart_rounded,
    color: Color(0xFF8B5CF6),
    tag: 'Procurement',
    apiKey: 'procurement',
  ),
  _ReportType(
    title: 'HR & Timesheets',
    subtitle: 'Timesheets, attendance, and HR operational reporting',
    icon: Icons.schedule_rounded,
    color: Color(0xFF14B8A6),
    tag: 'HR',
    apiKey: 'hr',
  ),
  _ReportType(
    title: 'Asset Register',
    subtitle: 'Asset inventory, category, and lifecycle reporting',
    icon: Icons.inventory_2_rounded,
    color: Color(0xFFF97316),
    tag: 'Assets',
    apiKey: 'assets',
  ),
];

class _ReportType {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String tag;
  final String apiKey;

  const _ReportType({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.tag,
    required this.apiKey,
  });
}

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  bool _loading = true;
  String? _error;
  final Map<String, int> _counts = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final dio = ref.read(apiClientProvider).dio;
    final counts = <String, int>{};

    try {
      final summaryRes = await dio.get<Map<String, dynamic>>('/reports/summary');
      final summary = summaryRes.data ?? const <String, dynamic>{};
      counts['travel'] = _asInt(summary['travel_requests_count']);
      counts['leave'] = _asInt(summary['leave_requests_count']);
      counts['assets'] = _asInt(summary['asset_count']);
    } catch (_) {
      _error ??= 'Some report counts could not be loaded.';
    }

    for (final entry in const {
      'dsa': '/reports/dsa',
      'finance': '/finance/advances',
      'procurement': '/procurement/requests',
      'hr': '/hr/timesheets',
    }.entries) {
      try {
        final res = await dio.get<Map<String, dynamic>>(
          entry.value,
          queryParameters: {'per_page': 1},
        );
        counts[entry.key] = _extractCount(res.data);
      } catch (_) {
        counts.putIfAbsent(entry.key, () => 0);
        _error ??= 'Some report counts could not be loaded.';
      }
    }

    if (!mounted) return;
    setState(() {
      _counts
        ..clear()
        ..addAll(counts);
      _loading = false;
    });
  }

  int _extractCount(Map<String, dynamic>? data) {
    if (data == null) return 0;
    if (data['total'] is num) return (data['total'] as num).toInt();
    if (data['data'] is List) return (data['data'] as List).length;
    return 0;
  }

  int _asInt(dynamic value) {
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    final textTheme = theme.textTheme;
    final totalCount = _counts.values.fold<int>(0, (sum, item) => sum + item);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: false,
              backgroundColor: theme.scaffoldBackgroundColor,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.menu),
                onPressed: ShellDrawerScope.openDrawerOf(context),
              ),
              title: Text(
                'Reports',
                style: textTheme.titleLarge?.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: _loading ? null : _load,
                ),
              ],
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        c.primary.withValues(alpha: 0.15),
                        c.primary.withValues(alpha: 0.05),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: c.primary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.bar_chart_rounded, color: c.primary, size: 32),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Reporting Centre',
                              style: textTheme.titleSmall?.copyWith(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              _loading
                                  ? 'Loading live report counts across operational modules.'
                                  : 'Tracking $totalCount records across the available report modules.',
                              style: textTheme.bodySmall?.copyWith(
                                fontSize: 11,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (_error != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: c.error.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: c.error.withValues(alpha: 0.2)),
                    ),
                    child: Text(
                      _error!,
                      style: TextStyle(color: c.error, fontSize: 12),
                    ),
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 16, 10),
                child: Row(
                  children: [
                    Icon(
                      Icons.folder_outlined,
                      size: 13,
                      color: c.onSurface.withValues(alpha: 0.5),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'REPORT TYPES',
                      style: textTheme.labelSmall?.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: c.onSurface.withValues(alpha: 0.5),
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final report = _reportTypes[index];
                    return _ReportCard(
                      report: report,
                      count: _counts[report.apiKey],
                      loading: _loading,
                    );
                  },
                  childCount: _reportTypes.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({
    required this.report,
    required this.count,
    required this.loading,
  });

  final _ReportType report;
  final int? count;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.outline),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          splashColor: report.color.withValues(alpha: 0.08),
          onTap: () => context.push(
            '/reports/detail?type=${report.apiKey}&title=${Uri.encodeComponent(report.title)}',
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: report.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(report.icon, color: report.color, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              report.title,
                              style: textTheme.titleSmall?.copyWith(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: report.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              report.tag,
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: report.color,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        report.subtitle,
                        style: textTheme.bodySmall?.copyWith(
                          fontSize: 11,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        loading
                            ? 'Loading live count...'
                            : '${count ?? 0} records available',
                        style: textTheme.labelSmall?.copyWith(
                          fontSize: 10,
                          color: c.onSurface.withValues(alpha: 0.65),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  Icons.chevron_right_rounded,
                  color: c.onSurface.withValues(alpha: 0.5),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
