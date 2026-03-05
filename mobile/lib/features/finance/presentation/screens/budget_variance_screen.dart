import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DATA MODELS
// ─────────────────────────────────────────────────────────────────────────────
enum _SecurityLevel { secret, confidential, public }

class _AuditEntry {
  final _SecurityLevel level;
  final String time;
  final String action;
  final String actor;
  final String role;
  final String description;
  final String ipfsHash;

  const _AuditEntry({
    required this.level,
    required this.time,
    required this.action,
    required this.actor,
    required this.role,
    required this.description,
    required this.ipfsHash,
  });
}

class _AuditGroup {
  final String dateLabel;
  final List<_AuditEntry> entries;
  const _AuditGroup({required this.dateLabel, required this.entries});
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class BudgetVarianceScreen extends StatefulWidget {
  const BudgetVarianceScreen({super.key});

  @override
  State<BudgetVarianceScreen> createState() => _BudgetVarianceScreenState();
}

class _BudgetVarianceScreenState extends State<BudgetVarianceScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  static final List<_AuditGroup> _allGroups = [
    _AuditGroup(
      dateLabel: 'TODAY  24 OCT 2023',
      entries: [
        _AuditEntry(
          level: _SecurityLevel.secret,
          time: '14:32',
          action: 'Budget Cap Override Executed',
          actor: 'Director K. Moyo',
          role: 'Finance Director',
          description:
              'Elevated budget cap for IT-CAPEX-2024 from \$50,000 to \$75,000 pending board approval.',
          ipfsHash: 'Qm4x9BcT...f22a',
        ),
        _AuditEntry(
          level: _SecurityLevel.confidential,
          time: '11:15',
          action: 'Access Grant: External Vendor',
          actor: 'Sys-Admin R. Banda',
          role: 'System Administrator',
          description:
              'Temporary read-only access granted to vendor TechSolutions Ltd for audit period.',
          ipfsHash: 'QmR3kJ7L...b88f',
        ),
        _AuditEntry(
          level: _SecurityLevel.public,
          time: '09:04',
          action: 'Payroll Run Initiated',
          actor: 'HR Automation',
          role: 'Scheduled Process',
          description:
              'Monthly payroll processing for 204 staff members. October cycle commenced.',
          ipfsHash: 'Qm5hFW2P...c01d',
        ),
      ],
    ),
    _AuditGroup(
      dateLabel: 'YESTERDAY  23 OCT 2023',
      entries: [
        _AuditEntry(
          level: _SecurityLevel.confidential,
          time: '16:50',
          action: 'Policy Exception #44 Approved',
          actor: 'Secretary General',
          role: 'Executive',
          description:
              'Procurement policy exception granted for single-source acquisition of satellite bandwidth.',
          ipfsHash: 'Qm7aGD9M...a14c',
        ),
        _AuditEntry(
          level: _SecurityLevel.public,
          time: '10:22',
          action: 'Leave Record Updated',
          actor: 'E. Dlamini',
          role: 'Staff Member',
          description:
              'Annual leave balance recalculated after approved carry-over request.',
          ipfsHash: 'QmBz1KN5...e73a',
        ),
      ],
    ),
  ];

  List<_AuditGroup> get _filtered {
    if (_query.isEmpty) return _allGroups;
    final q = _query.toLowerCase();
    return _allGroups
        .map((g) => _AuditGroup(
              dateLabel: g.dateLabel,
              entries: g.entries
                  .where((e) =>
                      e.action.toLowerCase().contains(q) ||
                      e.actor.toLowerCase().contains(q) ||
                      e.ipfsHash.toLowerCase().contains(q) ||
                      e.time.contains(q))
                  .toList(),
            ))
        .where((g) => g.entries.isNotEmpty)
        .toList();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final groups = _filtered;
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
          'Audit Log',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert_rounded,
                color: AppColors.textSecondary),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Immutable Ledger Banner ────────────────────────────────────
          Container(
            margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.35)),
            ),
            child: Row(
              children: [
                const Icon(Icons.lock_rounded,
                    color: AppColors.success, size: 16),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'IMMUTABLE LEDGER ACTIVE',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Hash Chain 100% Verified',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // ── Search Bar ────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _query = v),
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Search Hash, Module, or Date...',
                hintStyle: const TextStyle(
                    color: AppColors.textMuted, fontSize: 13),
                prefixIcon: const Icon(Icons.search_rounded,
                    color: AppColors.textMuted, size: 18),
                filled: true,
                fillColor: AppColors.bgSurface,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(
                      color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Timeline List ─────────────────────────────────────────────
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
              itemCount: groups.length,
              itemBuilder: (context, gi) {
                final group = groups[gi];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10, top: 4),
                      child: Text(
                        group.dateLabel,
                        style: const TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                    ...group.entries.map((e) => _AuditEntryCard(entry: e)),
                    const SizedBox(height: 8),
                  ],
                );
              },
            ),
          ),
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
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0A4D30),
                    foregroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
                  label: const Text(
                    'Export Verified PDF Ledger',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Document includes digital signature & blockchain hash proof.',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENTRY CARD
// ─────────────────────────────────────────────────────────────────────────────
class _AuditEntryCard extends StatelessWidget {
  final _AuditEntry entry;
  const _AuditEntryCard({required this.entry});

  Color get _levelColor {
    switch (entry.level) {
      case _SecurityLevel.secret:
        return AppColors.danger;
      case _SecurityLevel.confidential:
        return AppColors.warning;
      case _SecurityLevel.public:
        return AppColors.success;
    }
  }

  String get _levelLabel {
    switch (entry.level) {
      case _SecurityLevel.secret:
        return 'LEVEL 9-SECRET';
      case _SecurityLevel.confidential:
        return 'LEVEL 5-CONFIDENTIAL';
      case _SecurityLevel.public:
        return 'LEVEL 1-PUBLIC';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _levelColor;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Level badge + time
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border:
                      Border.all(color: color.withValues(alpha: 0.4)),
                ),
                child: Text(
                  _levelLabel,
                  style: TextStyle(
                    color: color,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                entry.time,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Action title
          Text(
            entry.action,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),

          // Actor + role
          Row(
            children: [
              const Icon(Icons.person_rounded,
                  color: AppColors.textMuted, size: 12),
              const SizedBox(width: 4),
              Text(
                entry.actor,
                style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600),
              ),
              const SizedBox(width: 4),
              Text(
                '· ${entry.role}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Description
          Text(
            entry.description,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 8),

          // IPFS hash tag
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.bgDark,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.link_rounded,
                    color: AppColors.textMuted, size: 11),
                const SizedBox(width: 4),
                Text(
                  'IPFS: ${entry.ipfsHash}',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10,
                    fontFamily: 'monospace',
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
