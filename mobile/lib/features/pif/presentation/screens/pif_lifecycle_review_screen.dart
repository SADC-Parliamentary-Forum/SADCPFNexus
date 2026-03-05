import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────
//  MOCK DATA
// ─────────────────────────────────────────────────────────────
const _refNo = '#SADC-2023-880';

class _ChainCard {
  final int step;
  final String title;
  final String statusLabel;
  final Color statusColor;
  final List<_ChainRow> rows;
  final String? note;
  final Color? noteColor;
  final bool isDark;

  const _ChainCard({
    required this.step,
    required this.title,
    required this.statusLabel,
    required this.statusColor,
    required this.rows,
    this.note,
    this.noteColor,
    this.isDark = false,
  });
}

class _ChainRow {
  final String label;
  final String value;
  const _ChainRow(this.label, this.value);
}

final _chainCards = [
  _ChainCard(
    step: 1,
    title: 'Program Implementation',
    statusLabel: 'Approved',
    statusColor: AppColors.success,
    rows: [
      const _ChainRow('BUDGET LINE', 'BL-3024-01'),
      const _ChainRow('LEAD OFFICER', 'Dr. A. Mwamba'),
    ],
  ),
  _ChainCard(
    step: 2,
    title: 'Travel Requisition',
    statusLabel: 'Completed',
    statusColor: AppColors.primary,
    rows: [
      const _ChainRow('ROUTE', 'Gaborone → Lusaka'),
      const _ChainRow('DSA ENTITLEMENT', '\$1,200.00'),
    ],
  ),
  _ChainCard(
    step: 3,
    title: 'Imprest Requisition',
    statusLabel: 'Disbursed',
    statusColor: AppColors.info,
    rows: [
      const _ChainRow('TRANSACTION ID', '#TXN-99281-ZA'),
      const _ChainRow('AMOUNT', '\$1,260.00'),
    ],
  ),
  _ChainCard(
    step: 4,
    title: 'Expense Retirement',
    statusLabel: 'Reconciled',
    statusColor: AppColors.warning,
    rows: [
      const _ChainRow('IMPREST', '\$1,260.00'),
      const _ChainRow('ACTUAL SPEND', '\$1,150.00'),
      const _ChainRow('VARIANCE', '-\$30.00'),
    ],
    note: 'Refund due to renegotiation',
    noteColor: AppColors.warning,
  ),
  _ChainCard(
    step: 5,
    title: 'WORM Archive',
    statusLabel: 'Secured',
    statusColor: AppColors.success,
    rows: [
      const _ChainRow('VERIFIED', 'HASH-CHAIN'),
      const _ChainRow('HASH', 'a3f9d2e1b7c4...'),
    ],
    note: 'Immutable Record Secured',
    noteColor: AppColors.success,
    isDark: true,
  ),
];

const _complianceItems = [
  'PIF Budget Approval',
  'Travel Policy Adherence',
  'Procurement Audit',
];

// ─────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────
class PifLifecycleReviewScreen extends StatelessWidget {
  const PifLifecycleReviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: _buildAppBar(context),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
        children: [
          // Sub-brand
          Row(
            children: [
              const Text(
                'SADCPFNexus Governance',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
              const Text(
                '  ·  ',
                style: TextStyle(color: AppColors.border),
              ),
              Text(
                'Reference No: $_refNo',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Institutional\nFinancial Chain',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 26,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 24),
          // Chain cards
          ..._chainCards.map((card) => _buildChainCard(card)),
          const SizedBox(height: 24),
          // Compliance section
          _buildComplianceSection(),
        ],
      ),
    );
  }

  AppBar _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.bgDark,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: const Text(
        'Lifecycle Review',
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      centerTitle: true,
      actions: [
        TextButton(
          onPressed: () {},
          child: const Text(
            'Help',
            style: TextStyle(
              color: Color(0xFF14B8A6),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: AppColors.border),
      ),
    );
  }

  Widget _buildChainCard(_ChainCard card) {
    final bgColor = card.isDark ? const Color(0xFF0A1810) : AppColors.bgSurface;
    final borderColor = card.isDark
        ? card.statusColor.withValues(alpha: 0.4)
        : AppColors.border;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Step number
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: card.statusColor.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${card.step}',
                      style: TextStyle(
                        color: card.statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    card.title,
                    style: TextStyle(
                      color: card.isDark ? AppColors.primary : AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: card.statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: card.statusColor.withValues(alpha: 0.35)),
                  ),
                  child: Text(
                    card.statusLabel,
                    style: TextStyle(
                      color: card.statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(height: 1, color: borderColor),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 20,
                  runSpacing: 8,
                  children: card.rows.map((row) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row.label,
                          style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          row.value,
                          style: TextStyle(
                            color: card.isDark ? AppColors.primary : AppColors.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            fontFamily: row.label == 'HASH' || row.label == 'TRANSACTION ID'
                                ? 'monospace'
                                : null,
                          ),
                        ),
                      ],
                    );
                  }).toList(),
                ),
                if (card.note != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: card.noteColor!.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: card.noteColor!.withValues(alpha: 0.25),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          card.isDark ? Icons.lock_outline : Icons.info_outline,
                          color: card.noteColor,
                          size: 14,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          card.note!,
                          style: TextStyle(
                            color: card.noteColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (card.isDark)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.08),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.verified_outlined, color: AppColors.success, size: 14),
                  SizedBox(width: 6),
                  Text(
                    'VERIFIED HASH-CHAIN · Immutable Record',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildComplianceSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.shield_outlined, color: AppColors.success, size: 18),
              SizedBox(width: 8),
              Text(
                'Governance Compliance',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ..._complianceItems.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check,
                      color: AppColors.success,
                      size: 12,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    item,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
