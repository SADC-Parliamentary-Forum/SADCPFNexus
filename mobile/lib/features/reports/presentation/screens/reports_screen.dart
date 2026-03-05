import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

const _reportTypes = [
  _ReportType(
    title: 'Travel & Missions',
    subtitle: 'DSA calculations, mission reports, and travel summaries',
    icon: Icons.flight_takeoff_rounded,
    color: AppColors.primary,
    tag: 'Travel',
  ),
  _ReportType(
    title: 'Leave Management',
    subtitle: 'Leave usage, balances, and LIL accrual reports',
    icon: Icons.event_available_rounded,
    color: AppColors.success,
    tag: 'Leave',
  ),
  _ReportType(
    title: 'DSA & Allowances',
    subtitle: 'Daily subsistence allowance and mission allowance reports',
    icon: Icons.payments_rounded,
    color: AppColors.warning,
    tag: 'Finance',
  ),
  _ReportType(
    title: 'Imprest & Finance',
    subtitle: 'Imprest liquidations, advances, and finance summaries',
    icon: Icons.account_balance_wallet_rounded,
    color: AppColors.info,
    tag: 'Finance',
  ),
  _ReportType(
    title: 'Procurement',
    subtitle: 'Requisitions, vendor quotes, and procurement analytics',
    icon: Icons.shopping_cart_rounded,
    color: Color(0xFF8B5CF6),
    tag: 'Procurement',
  ),
  _ReportType(
    title: 'HR & Timesheets',
    subtitle: 'Overtime records, timesheet summaries, and HR analytics',
    icon: Icons.schedule_rounded,
    color: Color(0xFF14B8A6),
    tag: 'HR',
  ),
];

class _ReportType {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String tag;
  const _ReportType({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.tag,
  });
}

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Header
            const SliverAppBar(
              pinned: false,
              backgroundColor: AppColors.bgDark,
              elevation: 0,
              automaticallyImplyLeading: false,
              title: Text('Reports',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary)),
            ),

            // Summary banner
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primary.withValues(alpha:0.15),
                        AppColors.primary.withValues(alpha:0.05),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.primary.withValues(alpha:0.2)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.bar_chart_rounded, color: AppColors.primary, size: 32),
                      SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Reporting Centre',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary)),
                            SizedBox(height: 3),
                            Text('Access and download institutional reports across all modules.',
                              style: TextStyle(fontSize: 11, color: AppColors.textSecondary,
                                height: 1.4)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Section header
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 20, 16, 10),
                child: Row(
                  children: [
                    Icon(Icons.folder_outlined, size: 13, color: AppColors.textMuted),
                    SizedBox(width: 6),
                    Text('REPORT TYPES',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                        color: AppColors.textMuted, letterSpacing: 1.2)),
                  ],
                ),
              ),
            ),

            // Report cards
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final r = _reportTypes[index];
                    return _ReportCard(report: r);
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
  final _ReportType report;
  const _ReportCard({required this.report});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          splashColor: report.color.withValues(alpha:0.08),
          onTap: () {
            // TODO: navigate when report API is available
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('${report.title} reports coming soon.'),
                backgroundColor: AppColors.bgSurface,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Icon container
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    color: report.color.withValues(alpha:0.12),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(report.icon, color: report.color, size: 24),
                ),
                const SizedBox(width: 14),
                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(report.title,
                            style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: report.color.withValues(alpha:0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(report.tag,
                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700,
                                color: report.color, letterSpacing: 0.3)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(report.subtitle,
                        style: const TextStyle(
                          fontSize: 11, color: AppColors.textSecondary, height: 1.4)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
