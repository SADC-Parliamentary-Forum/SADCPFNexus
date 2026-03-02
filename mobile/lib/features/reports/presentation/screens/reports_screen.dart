import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

/// Reports hub: travel, leave, DSA and other report types.
/// When a reports API is available, this screen can list and link to generated reports.
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('Reports'),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Report types',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 12),
            _ReportCard(
              title: 'Travel & missions',
              subtitle: 'Travel requests, DSA and mission reports',
              icon: Icons.flight_takeoff_rounded,
              onTap: () {
                // TODO: navigate to travel reports when screen/API exists
              },
            ),
            const SizedBox(height: 10),
            _ReportCard(
              title: 'Leave',
              subtitle: 'Leave usage and balances',
              icon: Icons.event_available_rounded,
              onTap: () {
                // TODO: navigate to leave reports when screen/API exists
              },
            ),
            const SizedBox(height: 10),
            _ReportCard(
              title: 'DSA & allowances',
              subtitle: 'Daily subsistence and allowance reports',
              icon: Icons.payments_rounded,
              onTap: () {
                // TODO: navigate to DSA reports when screen/API exists
              },
            ),
            const SizedBox(height: 10),
            _ReportCard(
              title: 'Imprest & finance',
              subtitle: 'Imprest liquidations and finance summaries',
              icon: Icons.account_balance_wallet_rounded,
              onTap: () {
                // TODO: navigate to finance reports when screen/API exists
              },
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                'Generated reports will appear here when the reports API is available.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textMuted,
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
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;

  const _ReportCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.bgCard,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textMuted,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
