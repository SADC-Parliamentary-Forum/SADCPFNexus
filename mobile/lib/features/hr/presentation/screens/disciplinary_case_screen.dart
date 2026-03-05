import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class DisciplinaryCaseScreen extends StatefulWidget {
  const DisciplinaryCaseScreen({super.key});

  @override
  State<DisciplinaryCaseScreen> createState() => _DisciplinaryCaseScreenState();
}

class _DisciplinaryCaseScreenState extends State<DisciplinaryCaseScreen> {
  static const _steps = [
    _CaseStep(
      label: 'Initial Report',
      date: 'Oct 28, 2024',
      status: _StepStatus.completed,
    ),
    _CaseStep(
      label: 'Hearing In Progress',
      date: '04 NOV 2024 · 14:00 CT',
      status: _StepStatus.active,
    ),
    _CaseStep(
      label: 'Outcome',
      date: null,
      status: _StepStatus.pending,
    ),
    _CaseStep(
      label: 'Appeals',
      date: '0 applicable',
      status: _StepStatus.pending,
    ),
  ];

  static const _documents = [
    _EvidenceDoc(
      name: 'Incident_Report_Final.pdf',
      version: 'Verified · v1.2.3',
    ),
    _EvidenceDoc(
      name: 'Witness_Statements_Conso...',
      version: 'Verified · v2.0.1',
    ),
    _EvidenceDoc(
      name: 'CCTV_Frame_092.png',
      version: 'Verified · v1.0.0',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  _buildLifecycleStepper(),
                  const SizedBox(height: 16),
                  _buildHearingDetailsCard(),
                  const SizedBox(height: 16),
                  _buildEvidenceSection(),
                  const SizedBox(height: 24),
                ],
              ),
            ),
            _buildBottomButtons(),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.arrow_back_ios_new,
                  size: 16, color: AppColors.textPrimary),
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Case #4291: Disciplinary He...',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.help_outline,
                size: 18, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
            ),
            child: const Text(
              'Hearing Workflow',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLifecycleStepper() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Case Lifecycle',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          ..._steps.asMap().entries.map((entry) {
            final i = entry.key;
            final step = entry.value;
            final isLast = i == _steps.length - 1;
            return _StepRow(step: step, isLast: isLast, index: i);
          }),
        ],
      ),
    );
  }

  Widget _buildHearingDetailsCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Hearing Details',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                GestureDetector(
                  onTap: () {},
                  child: const Text(
                    'Edit',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          _HearingDetailRow(
            label: 'DATE & TIME',
            value: 'Oct 24, 2024 · 14:00-16:30',
            icon: Icons.access_time,
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
          _HearingDetailRow(
            label: 'VENUE',
            value: 'Executive Chamber B, West Wing',
            icon: Icons.location_on_outlined,
          ),
          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'BOARD MEMBERS',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: List.generate(3, (i) {
                    final colors = [AppColors.primary, AppColors.info, AppColors.gold];
                    return Container(
                      width: 32,
                      height: 32,
                      margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                      decoration: BoxDecoration(
                        color: colors[i].withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                        border: Border.all(color: colors[i].withValues(alpha: 0.4)),
                      ),
                      child: Icon(Icons.person, size: 16, color: colors[i]),
                    );
                  }),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEvidenceSection() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: Text(
              'Evidence & Documentation',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          ..._documents.asMap().entries.map((entry) {
            final i = entry.key;
            final doc = entry.value;
            return Column(
              children: [
                _DocumentRow(doc: doc),
                if (i < _documents.length - 1)
                  const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
              ],
            );
          }),
          const Divider(height: 1, color: AppColors.border),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: GestureDetector(
              onTap: () {},
              child: const Row(
                children: [
                  Text(
                    'View All Documents (6)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(Icons.arrow_forward, size: 14, color: AppColors.primary),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButtons() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
        color: AppColors.bgSurface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {},
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.primary),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Initiate Appeal',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: GestureDetector(
              onTap: () {},
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'Submit Outcome',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.bgDark,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data models ───────────────────────────────────────────────────────────────
enum _StepStatus { completed, active, pending }

class _CaseStep {
  final String label;
  final String? date;
  final _StepStatus status;
  const _CaseStep({required this.label, this.date, required this.status});
}

class _EvidenceDoc {
  final String name;
  final String version;
  const _EvidenceDoc({required this.name, required this.version});
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _StepRow extends StatelessWidget {
  final _CaseStep step;
  final bool isLast;
  final int index;

  const _StepRow({
    required this.step,
    required this.isLast,
    required this.index,
  });

  @override
  Widget build(BuildContext context) {
    Color dotColor;
    Color dotBg;
    Widget dotChild;
    Color textColor;

    switch (step.status) {
      case _StepStatus.completed:
        dotColor = AppColors.success;
        dotBg = AppColors.success.withValues(alpha: 0.15);
        dotChild = const Icon(Icons.check, size: 14, color: AppColors.success);
        textColor = AppColors.textPrimary;
        break;
      case _StepStatus.active:
        dotColor = AppColors.warning;
        dotBg = AppColors.warning.withValues(alpha: 0.15);
        dotChild = Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: AppColors.warning,
            shape: BoxShape.circle,
          ),
        );
        textColor = AppColors.textPrimary;
        break;
      case _StepStatus.pending:
        dotColor = AppColors.border;
        dotBg = AppColors.bgCard;
        dotChild = Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: AppColors.textMuted.withValues(alpha: 0.5),
            shape: BoxShape.circle,
          ),
        );
        textColor = AppColors.textSecondary;
        break;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: dotBg,
                shape: BoxShape.circle,
                border: Border.all(color: dotColor, width: 1.5),
              ),
              child: Center(child: dotChild),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 36,
                color: step.status == _StepStatus.completed
                    ? AppColors.success.withValues(alpha: 0.4)
                    : AppColors.border,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                  ),
                ),
                if (step.date != null) ...[
                  const SizedBox(height: 3),
                  if (step.status == _StepStatus.active)
                    Container(
                      margin: const EdgeInsets.only(bottom: 2),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'HEARING IN PROG  ${step.date!}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.warning,
                        ),
                      ),
                    )
                  else
                    Text(
                      step.date!,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
                if (!isLast) const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _HearingDetailRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _HearingDetailRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textMuted,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DocumentRow extends StatelessWidget {
  final _EvidenceDoc doc;
  const _DocumentRow({required this.doc});

  @override
  Widget build(BuildContext context) {
    final isPdf = doc.name.endsWith('.pdf');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isPdf ? Icons.picture_as_pdf : Icons.image_outlined,
              size: 18,
              color: AppColors.info,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  doc.name,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.verified,
                        size: 10, color: AppColors.success),
                    const SizedBox(width: 3),
                    Text(
                      doc.version,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            icon: const Icon(Icons.download_outlined,
                size: 18, color: AppColors.textSecondary),
            onPressed: () {},
          ),
        ],
      ),
    );
  }
}
