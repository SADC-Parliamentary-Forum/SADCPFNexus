import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────
//  MOCK DATA
// ─────────────────────────────────────────────────────────────
const _mockPif = {
  'id': 'PROJ-0025',
  'status': 'fully_approved',
  'title': 'SRHR Governance Workshop',
  'subtitle': 'Implementation Approved. Financial actions enabled.',
  'budget_code': 'SADC-SRHR-2024-001',
  'approved_date': 'Oct 10, 2024',
  'location': 'Johannesburg, ZA',
};

final _linkedDocs = [
  {
    'label': 'Travel Requisition',
    'ref': 'TK-2024-034',
    'status': 'approved',
    'icon': Icons.flight_takeoff,
    'color': AppColors.primary,
  },
  {
    'label': 'Imprest Request',
    'ref': 'Funding Generated',
    'status': 'create',
    'icon': Icons.account_balance_wallet_outlined,
    'color': AppColors.warning,
  },
  {
    'label': 'Arrival Matrix & Participants',
    'ref': '14 MPs, 3 Staff Members',
    'status': 'info',
    'icon': Icons.people_alt_outlined,
    'color': AppColors.info,
  },
];

final _approvalHistory = [
  {
    'role': 'Programme Officer',
    'action': 'Drafted & Reviewed',
    'time': null,
    'done': true,
  },
  {
    'role': 'Director of Programs',
    'action': 'Approved',
    'time': 'Oct 12, 14:30',
    'done': true,
  },
  {
    'role': 'Finance Department',
    'action': 'Budget Confirmed',
    'time': null,
    'done': true,
  },
  {
    'role': 'Secretary General',
    'action': 'Final Approval',
    'time': 'Oct 12, 09:15',
    'done': true,
  },
];

// ─────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────
class PifReviewApprovalScreen extends StatefulWidget {
  const PifReviewApprovalScreen({super.key});

  @override
  State<PifReviewApprovalScreen> createState() => _PifReviewApprovalScreenState();
}

class _PifReviewApprovalScreenState extends State<PifReviewApprovalScreen> {
  bool _participantsExpanded = false;
  bool _generatingImprest = false;

  Future<void> _generateImprest() async {
    setState(() => _generatingImprest = true);
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() => _generatingImprest = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Imprest request created successfully'),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          Expanded(child: _buildBody()),
          _buildBottomBar(),
        ],
      ),
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
        'PIF Details',
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      centerTitle: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.more_vert, color: AppColors.textSecondary),
          onPressed: () => _showOptionsMenu(context),
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: AppColors.border),
      ),
    );
  }

  void _showOptionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            _OptionTile(icon: Icons.share_outlined, label: 'Share PIF', onTap: () {}),
            _OptionTile(icon: Icons.download_outlined, label: 'Download PDF', onTap: () {}),
            _OptionTile(icon: Icons.print_outlined, label: 'Print', onTap: () {}),
            _OptionTile(
              icon: Icons.archive_outlined,
              label: 'Archive',
              onTap: () {},
              color: AppColors.warning,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      children: [
        // Status + ID row
        Row(
          children: [
            const _StatusBadge(
              label: 'FULLY APPROVED',
              color: AppColors.success,
            ),
            const SizedBox(width: 10),
            Text(
              'ID: ${_mockPif['id']}',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        // Title
        Text(
          _mockPif['title'] as String,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _mockPif['subtitle'] as String,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 14),
        // Meta row
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              _MetaRow(
                icon: Icons.tag,
                label: 'Budget Code',
                value: _mockPif['budget_code'] as String,
                valueColor: AppColors.gold,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _MetaRow(
                      icon: Icons.calendar_today,
                      label: 'Approved',
                      value: _mockPif['approved_date'] as String,
                      valueColor: AppColors.success,
                    ),
                  ),
                  Expanded(
                    child: _MetaRow(
                      icon: Icons.location_on_outlined,
                      label: 'Location',
                      value: _mockPif['location'] as String,
                      valueColor: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        // Linked Financial Documents
        const _SectionTitle(
          icon: Icons.link,
          iconColor: AppColors.primary,
          label: 'LINKED FINANCIAL DOCUMENTS',
        ),
        const SizedBox(height: 12),
        ..._linkedDocs.map((doc) => _LinkedDocCard(
              doc: doc,
              onParticipantsToggle: doc['label'] == 'Arrival Matrix & Participants'
                  ? () => setState(() => _participantsExpanded = !_participantsExpanded)
                  : null,
              participantsExpanded: _participantsExpanded,
            )),
        const SizedBox(height: 22),
        // Approval History
        const _SectionTitle(
          icon: Icons.history,
          iconColor: AppColors.gold,
          label: 'APPROVAL HISTORY',
        ),
        const SizedBox(height: 12),
        _ApprovalTimeline(steps: _approvalHistory),
      ],
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).padding.bottom + 16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.bgDark,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: ElevatedButton(
        onPressed: _generatingImprest ? null : _generateImprest,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.bgDark,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: _generatingImprest
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  color: AppColors.bgDark,
                  strokeWidth: 2.5,
                ),
              )
            : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.account_balance_wallet_outlined, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Generate Imprest',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ],
              ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  LINKED DOC CARD
// ─────────────────────────────────────────────────────────────
class _LinkedDocCard extends StatelessWidget {
  final Map<String, dynamic> doc;
  final VoidCallback? onParticipantsToggle;
  final bool participantsExpanded;

  const _LinkedDocCard({
    required this.doc,
    this.onParticipantsToggle,
    required this.participantsExpanded,
  });

  @override
  Widget build(BuildContext context) {
    final status = doc['status'] as String;
    final icon = doc['icon'] as IconData;
    final color = doc['color'] as Color;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: color, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doc['label'] as String,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        doc['ref'] as String,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (status == 'approved')
                  const _StatusBadge(label: 'Approved', color: AppColors.success)
                else if (status == 'create')
                  const _CreateButton(label: 'Create')
                else if (status == 'info' && onParticipantsToggle != null)
                  GestureDetector(
                    onTap: onParticipantsToggle,
                    child: Icon(
                      participantsExpanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      color: AppColors.textMuted,
                      size: 20,
                    ),
                  ),
              ],
            ),
          ),
          if (status == 'info' && participantsExpanded)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: 12),
                  Text(
                    '14 Member of Parliament delegates and 3 staff members confirmed for attendance.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _ParticipantChip(label: 'MPs (14)', color: AppColors.primary),
                      _ParticipantChip(label: 'Staff (3)', color: AppColors.info),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ParticipantChip extends StatelessWidget {
  final String label;
  final Color color;

  const _ParticipantChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _CreateButton extends StatelessWidget {
  final String label;

  const _CreateButton({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.primary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  APPROVAL TIMELINE
// ─────────────────────────────────────────────────────────────
class _ApprovalTimeline extends StatelessWidget {
  final List<Map<String, dynamic>> steps;

  const _ApprovalTimeline({required this.steps});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        children: steps.asMap().entries.map((entry) {
          final i = entry.key;
          final step = entry.value;
          final isLast = i == steps.length - 1;
          final done = step['done'] as bool;

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: done
                          ? AppColors.success.withValues(alpha: 0.15)
                          : AppColors.bgCard,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: done ? AppColors.success : AppColors.border,
                        width: 1.5,
                      ),
                    ),
                    child: Icon(
                      done ? Icons.check : Icons.radio_button_unchecked,
                      color: done ? AppColors.success : AppColors.textMuted,
                      size: 14,
                    ),
                  ),
                  if (!isLast)
                    Container(
                      width: 1.5,
                      height: 40,
                      color: done ? AppColors.success.withValues(alpha: 0.4) : AppColors.border,
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: isLast ? 0 : 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step['role'] as String,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Text(
                            step['action'] as String,
                            style: TextStyle(
                              color: done ? AppColors.success : AppColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                          if (step['time'] != null) ...[
                            const Text(
                              '  ·  ',
                              style: TextStyle(color: AppColors.border, fontSize: 11),
                            ),
                            Text(
                              step['time'] as String,
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  SHARED WIDGETS
// ─────────────────────────────────────────────────────────────
class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;

  const _SectionTitle({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 16),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
          ),
        ),
      ],
    );
  }
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;

  const _MetaRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: AppColors.textMuted, size: 13),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: TextStyle(
                color: valueColor,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _OptionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textPrimary;
    return ListTile(
      leading: Icon(icon, color: c, size: 20),
      title: Text(label, style: TextStyle(color: c, fontSize: 14)),
      onTap: () {
        Navigator.of(context).pop();
        onTap();
      },
      contentPadding: EdgeInsets.zero,
    );
  }
}
