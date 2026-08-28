import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class ResolutionImplementationDetailsScreen extends StatelessWidget {
  const ResolutionImplementationDetailsScreen({super.key, this.resolution});

  final Map<String, dynamic>? resolution;

  static String _statusLabel(String? s) {
    switch ((s ?? '').toLowerCase().replaceAll(' ', '_')) {
      case 'adopted': return 'Adopted';
      case 'implemented': return 'Implemented';
      case 'in_progress': return 'In Progress';
      case 'deferred': return 'Deferred';
      default: return s ?? '—';
    }
  }

  static Color _statusColor(String s) {
    if (s == 'Adopted' || s == 'Implemented') return AppColors.success;
    if (s == 'In Progress') return AppColors.primary;
    if (s == 'Deferred') return AppColors.warning;
    return AppColors.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    final ref = resolution?['reference_number'] ?? resolution?['ref'] ?? '—';
    final title = resolution?['title'] as String? ?? 'Resolution Details';
    final status = _statusLabel(resolution?['status'] as String?);
    final statusColor = _statusColor(status);
    final adoptedAt = resolution?['adopted_at'] as String?;
    final dateStr = adoptedAt != null ? AppDateFormatter.short(adoptedAt) : '—';
    final description = resolution?['description'] as String?;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Resolution Details', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [IconButton(icon: const Icon(Icons.share_outlined, color: AppColors.textSecondary), onPressed: () {})],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(status, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 8),
          Text(ref, style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 4),
          Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text('Adopted: $dateStr', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          if (description != null && description.toString().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(description.toString(), style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ],
          const SizedBox(height: 20),
          _card(children: [
            _secHeader('Implementation Progress'),
            Padding(padding: const EdgeInsets.fromLTRB(14, 8, 14, 16), child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Overall Completion', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                Text(
                  resolution?['implementation_progress']?.toString() ?? 'Not recorded',
                  style: const TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ]),
              const SizedBox(height: 12),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Due Date', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                Text(resolution?['due_date']?.toString() ?? '—', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ]),
              const SizedBox(height: 4),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Responsible Dept', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                Text(resolution?['committee']?.toString() ?? resolution?['lead_role']?.toString() ?? '—', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              ]),
            ])),
          ]),
          const SizedBox(height: 12),
          _card(children: [
            _secHeader('Voting Record'),
            Padding(padding: const EdgeInsets.fromLTRB(14, 8, 14, 14), child: Column(children: [
              _voteRow('For', (resolution?['votes_for'] ?? '—').toString(), AppColors.success),
              _voteRow('Against', (resolution?['votes_against'] ?? '—').toString(), AppColors.danger),
              _voteRow('Abstain', (resolution?['votes_abstain'] ?? '—').toString(), AppColors.textMuted),
            ])),
          ]),
          const SizedBox(height: 12),
          _card(children: [
            _secHeader('Resolution Text'),
            Padding(padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
              child: Text(
                (description != null && description.toString().isNotEmpty)
                    ? description.toString()
                    : 'Full resolution text is not stored on this record.',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.6),
              )),
          ]),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, height: 50,
            child: ElevatedButton.icon(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              icon: const Icon(Icons.file_download_outlined, size: 18),
              label: const Text('Export Full Report', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _card({required List<Widget> children}) => Container(
    margin: const EdgeInsets.only(bottom: 2),
    decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
  );

  Widget _secHeader(String title) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
    child: Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
  );

  Widget _voteRow(String label, String count, Color color) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      const Spacer(),
      Text(count, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w700)),
    ]),
  );
}
