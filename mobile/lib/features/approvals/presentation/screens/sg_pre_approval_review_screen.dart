import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

class SgPreApprovalReviewScreen extends StatefulWidget {
  const SgPreApprovalReviewScreen({super.key});

  @override
  State<SgPreApprovalReviewScreen> createState() =>
      _SgPreApprovalReviewScreenState();
}

class _SgPreApprovalReviewScreenState
    extends State<SgPreApprovalReviewScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Pre-Approval Review',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.shield_outlined,
                  color: AppColors.primary, size: 18),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Reference label
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.tag_rounded,
                      color: AppColors.textMuted, size: 13),
                  const SizedBox(width: 5),
                  const Text(
                    'Procurement #REQ-2023-892',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Main heading
            const Text(
              'Approve \$50k Procurement',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 24,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Procurement of IT infrastructure for SADC PF Secretariat modernization project.',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 20),

            // Critical action warning card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.35)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.warning_amber_rounded,
                        color: AppColors.warning, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Critical Action Required',
                          style: TextStyle(
                            color: AppColors.warning,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          'This action involves significant resource allocation above the standard threshold. Biometric verification will be required to proceed.',
                          style: TextStyle(
                            color: AppColors.warning.withValues(alpha: 0.85),
                            fontSize: 12,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Risk assessment section
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  // Header row
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                    child: Row(
                      children: [
                        const Icon(Icons.analytics_outlined,
                            color: AppColors.textMuted, size: 16),
                        const SizedBox(width: 8),
                        const Text(
                          'Risk Assessment',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.success.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: AppColors.success
                                    .withValues(alpha: 0.35)),
                          ),
                          child: const Text(
                            'LOW RISK',
                            style: TextStyle(
                              color: AppColors.success,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Divider(color: AppColors.border, height: 1),

                  // Check rows
                  _buildCheckRow(
                    label: 'Compliance Check',
                    status: 'Passed',
                    icon: Icons.check_circle_rounded,
                  ),
                  const Divider(
                      color: AppColors.border, height: 1, indent: 16),
                  _buildCheckRow(
                    label: 'Budget Availability',
                    status: 'Verified',
                    icon: Icons.check_circle_rounded,
                  ),
                  const Divider(
                      color: AppColors.border, height: 1, indent: 16),
                  _buildCheckRow(
                    label: 'Vendor Status',
                    status: 'Vetted',
                    icon: Icons.check_circle_rounded,
                  ),
                  const SizedBox(height: 4),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Procurement details summary
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'PROCUREMENT DETAILS',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow('Amount', '\$50,000.00'),
                  const SizedBox(height: 8),
                  _buildInfoRow('Category', 'IT Infrastructure'),
                  const SizedBox(height: 8),
                  _buildInfoRow('Department', 'Secretariat'),
                  const SizedBox(height: 8),
                  _buildInfoRow('Submitted By', 'Dir. Finance'),
                  const SizedBox(height: 8),
                  _buildInfoRow('Date', 'Oct 24, 2024'),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // CTA button
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton.icon(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.bgDark,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                icon: const Icon(Icons.fingerprint_rounded, size: 22),
                label: const Text(
                  'Initiate Secure Signature',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Center(
              child: GestureDetector(
                onTap: () {},
                child: const Text(
                  'Send Back for Revision',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckRow({
    required String label,
    required String status,
    required IconData icon,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 13),
          ),
          const Spacer(),
          Icon(icon, color: AppColors.success, size: 16),
          const SizedBox(width: 5),
          Text(
            status,
            style: const TextStyle(
              color: AppColors.success,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
              color: AppColors.textSecondary, fontSize: 13),
        ),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
