import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Good morning,',
                              style: Theme.of(context).textTheme.bodySmall),
                          Text(
                            'Staff Member',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Stack(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: AppColors.bgSurface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: const Icon(Icons.notifications_outlined,
                              color: AppColors.textSecondary, size: 22),
                        ),
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.danger,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Overview',
                        style: Theme.of(context).textTheme.titleSmall
                            ?.copyWith(color: AppColors.textSecondary)),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.5,
                      children: const [
                        _StatCard(label: 'Pending', value: '12',
                            icon: Icons.pending_actions_outlined, color: AppColors.warning),
                        _StatCard(label: 'Travels', value: '4',
                            icon: Icons.flight_takeoff_outlined, color: AppColors.primary),
                        _StatCard(label: 'Leave', value: '7',
                            icon: Icons.event_available_outlined, color: AppColors.success),
                        _StatCard(label: 'Requisitions', value: '3',
                            icon: Icons.shopping_cart_outlined, color: AppColors.info),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Quick Actions',
                        style: Theme.of(context).textTheme.titleSmall
                            ?.copyWith(color: AppColors.textSecondary)),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _QuickAction(icon: Icons.flight_takeoff, label: 'Travel'),
                        _QuickAction(icon: Icons.event_available, label: 'Leave'),
                        _QuickAction(icon: Icons.account_balance_wallet, label: 'Finance'),
                        _QuickAction(icon: Icons.shopping_cart, label: 'Procure'),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Recent Activity',
                        style: Theme.of(context).textTheme.titleSmall
                            ?.copyWith(color: AppColors.textSecondary)),
                    const SizedBox(height: 12),
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Column(
                        children: [
                          _ActivityItem(
                            title: 'Travel requisition submitted',
                            subtitle: '2 hours ago',
                            icon: Icons.flight_takeoff_outlined,
                            status: 'PENDING',
                            statusColor: AppColors.warning,
                            isLast: false,
                          ),
                          _ActivityItem(
                            title: 'Leave approved by supervisor',
                            subtitle: '4 hours ago',
                            icon: Icons.check_circle_outline,
                            status: 'APPROVED',
                            statusColor: AppColors.success,
                            isLast: false,
                          ),
                          _ActivityItem(
                            title: 'Imprest retirement pending',
                            subtitle: '1 day ago',
                            icon: Icons.account_balance_wallet_outlined,
                            status: 'ACTION',
                            statusColor: AppColors.danger,
                            isLast: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(label,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;

  const _QuickAction({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: (MediaQuery.of(context).size.width - 60) / 4,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 10)),
        ],
      ),
    );
  }
}

class _ActivityItem extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final String status;
  final Color statusColor;
  final bool isLast;

  const _ActivityItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.status,
    required this.statusColor,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.textSecondary, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500)),
                Text(subtitle,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 11)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: statusColor,
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
