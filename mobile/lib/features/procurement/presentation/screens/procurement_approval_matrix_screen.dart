import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DATA
// ─────────────────────────────────────────────────────────────────────────────
enum _ApprovalStatus { approved, awaiting, pending }

class _ApprovalStep {
  final String role;
  final String name;
  final _ApprovalStatus status;
  final String note;
  final String? timestamp;

  const _ApprovalStep({
    required this.role,
    required this.name,
    required this.status,
    required this.note,
    this.timestamp,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class ProcurementApprovalMatrixScreen extends StatelessWidget {
  const ProcurementApprovalMatrixScreen({super.key});

  static const List<_ApprovalStep> _chain = [
    _ApprovalStep(
      role: 'Procurement Officer',
      name: 'T. Mahlangu',
      status: _ApprovalStatus.approved,
      note: 'Verified specifications & pricing',
      timestamp: 'Oct 24, 09:30 AM',
    ),
    _ApprovalStep(
      role: 'Director of Finance',
      name: 'K. Moyo',
      status: _ApprovalStatus.approved,
      note: 'Budget availability confirmed',
      timestamp: 'Oct 25, 11:15 AM',
    ),
    _ApprovalStep(
      role: 'Secretary General',
      name: 'D. Sithole',
      status: _ApprovalStatus.awaiting,
      note: 'Final executive authorization',
      timestamp: null,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: AppColors.textPrimary, size: 18),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'Requisition #2491',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.check_circle_rounded,
                color: AppColors.success, size: 20),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        children: [
          // ── Hero Card ─────────────────────────────────────────────────
          _HeroCard(),
          const SizedBox(height: 20),

          // ── Sequential Approval Chain ─────────────────────────────────
          const Text(
            'Sequential Approval Chain',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          _buildChain(),
          const SizedBox(height: 20),

          // ── Policy Compliance ─────────────────────────────────────────
          const Text(
            'Policy Compliance',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          _buildComplianceCard(),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.bgDark,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Authorize Purchase',
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {},
                child: const Text(
                  'Reject Request',
                  style: TextStyle(
                    color: AppColors.danger,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChain() {
    return Column(
      children: _chain.asMap().entries.map((e) {
        final isLast = e.key == _chain.length - 1;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Timeline column
            Column(
              children: [
                _StatusDot(status: e.value.status),
                if (!isLast)
                  Container(
                    width: 2,
                    height: 80,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      color: e.value.status == _ApprovalStatus.approved
                          ? AppColors.success.withValues(alpha: 0.5)
                          : AppColors.border,
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Container(
                margin: EdgeInsets.only(bottom: isLast ? 0 : 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: _ChainStepContent(step: e.value),
              ),
            ),
          ],
        );
      }).toList(),
    );
  }

  Widget _buildComplianceCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _ComplianceRow(
            label: 'Compliance Verification',
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.35)),
              ),
              child: const Text(
                'VERIFIED',
                style: TextStyle(
                  color: AppColors.success,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
          const Divider(color: AppColors.border, height: 20),
          _ComplianceRow(
            label: 'Three-Quote Rule Met',
            trailing: GestureDetector(
              onTap: () {},
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded,
                      color: AppColors.success, size: 16),
                  SizedBox(width: 6),
                  Text(
                    'View Comparison →',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(color: AppColors.border, height: 20),
          _ComplianceRow(
            label: 'Secure Executive Authorization',
            trailing: const Icon(Icons.lock_rounded,
                color: AppColors.textMuted, size: 18),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HERO CARD
// ─────────────────────────────────────────────────────────────────────────────
class _HeroCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary.withValues(alpha: 0.12), AppColors.bgCard],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.35)),
                ),
                child: const Text(
                  'IT Hardware',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Laptop Refresh – Finance Dept',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'TOTAL AMOUNT',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const Text(
            '\$24,500.00',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const Text(
            'BUDGET LINE  IT-CAPEX-2024',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.storefront_outlined,
                  color: AppColors.textMuted, size: 14),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'TechSolutions Ltd',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.35)),
                ),
                child: const Text(
                  'Preferred Vendor · Contract #9821',
                  style: TextStyle(
                    color: AppColors.gold,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  STATUS DOT
// ─────────────────────────────────────────────────────────────────────────────
class _StatusDot extends StatelessWidget {
  final _ApprovalStatus status;
  const _StatusDot({required this.status});

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case _ApprovalStatus.approved:
        return Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.15),
            shape: BoxShape.circle,
            border: Border.all(
                color: AppColors.success.withValues(alpha: 0.5), width: 2),
          ),
          child: const Icon(Icons.check_rounded,
              color: AppColors.success, size: 14),
        );
      case _ApprovalStatus.awaiting:
        return Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.warning.withValues(alpha: 0.12),
            shape: BoxShape.circle,
            border: Border.all(
                color: AppColors.warning.withValues(alpha: 0.5), width: 2),
          ),
          child: const Icon(Icons.schedule_rounded,
              color: AppColors.warning, size: 14),
        );
      case _ApprovalStatus.pending:
        return Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.border, width: 2),
          ),
        );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHAIN STEP CONTENT
// ─────────────────────────────────────────────────────────────────────────────
class _ChainStepContent extends StatelessWidget {
  final _ApprovalStep step;
  const _ChainStepContent({required this.step});

  @override
  Widget build(BuildContext context) {
    final statusColor = step.status == _ApprovalStatus.approved
        ? AppColors.success
        : step.status == _ApprovalStatus.awaiting
            ? AppColors.warning
            : AppColors.textMuted;

    final statusLabel = step.status == _ApprovalStatus.approved
        ? 'Approved'
        : step.status == _ApprovalStatus.awaiting
            ? 'Awaiting Signature'
            : 'Pending';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.role,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  step.name,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: statusColor.withValues(alpha: 0.35)),
              ),
              child: Text(
                statusLabel,
                style: TextStyle(
                  color: statusColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          step.note,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11,
          ),
        ),
        if (step.timestamp != null) ...[
          const SizedBox(height: 4),
          Text(
            step.timestamp!,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 10,
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPLIANCE ROW
// ─────────────────────────────────────────────────────────────────────────────
class _ComplianceRow extends StatelessWidget {
  final String label;
  final Widget trailing;
  const _ComplianceRow({required this.label, required this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        trailing,
      ],
    );
  }
}
