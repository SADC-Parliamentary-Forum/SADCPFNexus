import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────
//  MOCK DATA
// ─────────────────────────────────────────────────────────────
class _PipelineStep {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String statusLabel;
  final Color statusColor;
  final int count;
  final double? progress;
  final bool isComplete;
  final String? linkLabel;

  const _PipelineStep({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.statusLabel,
    required this.statusColor,
    required this.count,
    this.progress,
    this.isComplete = false,
    this.linkLabel,
  });
}

final _pipelineSteps = [
  const _PipelineStep(
    title: 'Approved PIF',
    subtitle: 'Program Implementation Framework initialized.',
    icon: Icons.description_outlined,
    color: AppColors.success,
    statusLabel: 'Complete',
    statusColor: AppColors.success,
    count: 24,
    isComplete: true,
  ),
  const _PipelineStep(
    title: 'Travel Requisition',
    subtitle: 'Logistics & accommodation clearance.',
    icon: Icons.flight_takeoff,
    color: AppColors.warning,
    statusLabel: 'Pending',
    statusColor: AppColors.warning,
    count: 12,
  ),
  const _PipelineStep(
    title: 'Consultancy Req.',
    subtitle: 'External expert engagement approval.',
    icon: Icons.work_outline,
    color: AppColors.info,
    statusLabel: 'Review',
    statusColor: AppColors.info,
    count: 5,
  ),
  const _PipelineStep(
    title: 'Imprest Request',
    subtitle: 'Operational fund disbursement.',
    icon: Icons.account_balance_wallet_outlined,
    color: AppColors.primary,
    statusLabel: 'Processing',
    statusColor: AppColors.primary,
    count: 8,
    progress: 0.65,
  ),
  const _PipelineStep(
    title: 'Expense Retirement',
    subtitle: 'Final reconciliation for audit ledger.',
    icon: Icons.receipt_long_outlined,
    color: AppColors.textMuted,
    statusLabel: 'Waiting',
    statusColor: AppColors.textMuted,
    count: 3,
    linkLabel: 'View Audit Ledger →',
  ),
];

// ─────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────
class PifLifecycleFlowScreen extends StatefulWidget {
  const PifLifecycleFlowScreen({super.key});

  @override
  State<PifLifecycleFlowScreen> createState() => _PifLifecycleFlowScreenState();
}

class _PifLifecycleFlowScreenState extends State<PifLifecycleFlowScreen> {
  int _navIndex = 1;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          Expanded(child: _buildBody()),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.bgDark,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: const Text(
        'Lifecycle Overview',
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      centerTitle: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.filter_list, color: AppColors.textSecondary),
          onPressed: () {},
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: AppColors.border),
      ),
    );
  }

  Widget _buildBody() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      children: [
        // Header
        const Text(
          'PIF to Imprest',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Institutional Value Chain',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 20),
        // Stats row
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: const Row(
            children: [
              Expanded(
                child: _StatCell(
                  value: '142',
                  label: 'TOTAL PIFS',
                  color: AppColors.primary,
                ),
              ),
              _VertDivider(),
              Expanded(
                child: _StatCell(
                  value: '450K',
                  label: 'IMPREST (\$)',
                  color: AppColors.gold,
                ),
              ),
              _VertDivider(),
              Expanded(
                child: _StatCell(
                  value: '89%',
                  label: 'RETIRED',
                  color: AppColors.success,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // Pipeline
        ..._pipelineSteps.asMap().entries.map((entry) {
          final i = entry.key;
          final step = entry.value;
          final isLast = i == _pipelineSteps.length - 1;
          return _PipelineCard(step: step, isLast: isLast);
        }),
      ],
    );
  }

  Widget _buildBottomNav() {
    const navItems = [
      _NavItem(icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: 'Dashboard'),
      _NavItem(icon: Icons.account_tree_outlined, activeIcon: Icons.account_tree, label: 'Workflows'),
      _NavItem(icon: Icons.bar_chart_outlined, activeIcon: Icons.bar_chart, label: 'Reports'),
      _NavItem(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Profile'),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bgSurface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 60,
          child: Row(
            children: navItems.asMap().entries.map((entry) {
              final i = entry.key;
              final item = entry.value;
              final isActive = i == _navIndex;
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _navIndex = i),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        isActive ? item.activeIcon : item.icon,
                        color: isActive ? AppColors.primary : AppColors.textSecondary,
                        size: 22,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.label,
                        style: TextStyle(
                          color: isActive ? AppColors.primary : AppColors.textSecondary,
                          fontSize: 10,
                          fontWeight: isActive ? FontWeight.w700 : FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  PIPELINE CARD
// ─────────────────────────────────────────────────────────────
class _PipelineCard extends StatelessWidget {
  final _PipelineStep step;
  final bool isLast;

  const _PipelineCard({required this.step, required this.isLast});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left connector
        Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: step.isComplete
                    ? step.color.withValues(alpha: 0.2)
                    : AppColors.bgSurface,
                shape: BoxShape.circle,
                border: Border.all(
                  color: step.isComplete ? step.color : AppColors.border,
                  width: step.isComplete ? 2 : 1,
                ),
              ),
              child: Icon(
                step.isComplete ? Icons.check : step.icon,
                color: step.isComplete ? step.color : AppColors.textSecondary,
                size: 20,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 60,
                color: step.isComplete
                    ? step.color.withValues(alpha: 0.4)
                    : AppColors.border,
              ),
          ],
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Container(
            margin: EdgeInsets.only(bottom: isLast ? 0 : 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: step.isComplete
                    ? step.color.withValues(alpha: 0.3)
                    : AppColors.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        step.title,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Count badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: step.color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${step.count}',
                        style: TextStyle(
                          color: step.color,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    // Status label
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: step.statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: step.statusColor.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        step.statusLabel,
                        style: TextStyle(
                          color: step.statusColor,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  step.subtitle,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                if (step.isComplete) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: 1.0,
                      backgroundColor: AppColors.border,
                      valueColor: AlwaysStoppedAnimation(step.color),
                      minHeight: 4,
                    ),
                  ),
                ],
                if (step.progress != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(3),
                          child: LinearProgressIndicator(
                            value: step.progress,
                            backgroundColor: AppColors.border,
                            valueColor: AlwaysStoppedAnimation(step.color),
                            minHeight: 4,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${(step.progress! * 100).toInt()}%',
                        style: TextStyle(
                          color: step.color,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ],
                if (step.linkLabel != null) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () {},
                    child: Text(
                      step.linkLabel!,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  SHARED WIDGETS
// ─────────────────────────────────────────────────────────────
class _StatCell extends StatelessWidget {
  final String value;
  final String label;
  final Color color;

  const _StatCell({
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _VertDivider extends StatelessWidget {
  const _VertDivider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 40, color: AppColors.border);
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem({required this.icon, required this.activeIcon, required this.label});
}
