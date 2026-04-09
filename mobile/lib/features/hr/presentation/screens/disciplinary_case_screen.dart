import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class DisciplinaryCaseScreen extends ConsumerStatefulWidget {
  final int? conductId;
  const DisciplinaryCaseScreen({super.key, this.conductId});

  @override
  ConsumerState<DisciplinaryCaseScreen> createState() => _DisciplinaryCaseScreenState();
}

class _DisciplinaryCaseScreenState extends ConsumerState<DisciplinaryCaseScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _cases = [];
  Map<String, dynamic>? _selected;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = null; });
    try {
      final api = ref.read(apiClientProvider);
      if (widget.conductId != null) {
        final res = await api.dio.get<Map<String, dynamic>>('/hr/conduct/${widget.conductId}');
        if (!mounted) return;
        setState(() { _selected = res.data; _loading = false; });
      } else {
        final res = await api.dio.get<Map<String, dynamic>>('/hr/conduct', queryParameters: {'per_page': 20});
        final items = (res.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        if (!mounted) return;
        setState(() {
          _cases = items;
          _selected = items.isNotEmpty ? items.first : null;
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = 'Failed to load conduct records.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: Column(children: [
          _buildAppBar(),
          Expanded(child: _buildBody()),
        ]),
      ),
    );
  }

  Widget _buildAppBar() {
    final caseRef = _selected?['reference_number'] as String? ??
        (_selected != null ? 'Case #${_selected!['id']}' : 'Conduct Cases');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(children: [
        GestureDetector(
          onTap: () => Navigator.of(context).pop(),
          child: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.arrow_back_ios_new, size: 16, color: AppColors.textPrimary),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(caseRef,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
            overflow: TextOverflow.ellipsis),
        ),
        if (_selected != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: _statusColor(_selected!['status'] as String? ?? '').withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _statusColor(_selected!['status'] as String? ?? '').withValues(alpha: 0.4)),
            ),
            child: Text(
              _statusLabel(_selected!['status'] as String? ?? ''),
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor(_selected!['status'] as String? ?? '')),
            ),
          ),
      ]),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_error != null) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline, color: AppColors.danger, size: 40),
        const SizedBox(height: 12),
        Text(_error!, style: const TextStyle(color: AppColors.textMuted, fontSize: 14)),
        const SizedBox(height: 16),
        TextButton(onPressed: _load, child: const Text('Retry', style: TextStyle(color: AppColors.primary))),
      ]));
    }
    if (_cases.isEmpty && _selected == null) {
      return const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.gavel_outlined, color: AppColors.textMuted, size: 48),
        SizedBox(height: 12),
        Text('No conduct records found.', style: TextStyle(color: AppColors.textMuted, fontSize: 14)),
      ]));
    }

    return RefreshIndicator(
      color: AppColors.primary,
      backgroundColor: AppColors.bgSurface,
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 24), children: [
        // Case selector if multiple
        if (_cases.length > 1) ...[
          _sectionHeader('All Cases (${_cases.length})', Icons.list_alt_outlined, AppColors.primary),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: _cases.map((c) {
              final isSelected = _selected?['id'] == c['id'];
              return GestureDetector(
                onTap: () => setState(() => _selected = c),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary.withValues(alpha: 0.15) : AppColors.bgSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
                  ),
                  child: Text(
                    c['reference_number'] as String? ?? 'Case #${c['id']}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? AppColors.primary : AppColors.textSecondary,
                    ),
                  ),
                ),
              );
            }).toList()),
          ),
          const SizedBox(height: 16),
        ],

        if (_selected != null) ...[
          // Case details card
          _buildCaseDetailsCard(_selected!),
          const SizedBox(height: 16),

          // Lifecycle stepper
          _buildLifecycleStepper(_selected!),
          const SizedBox(height: 16),

          // Description card
          if ((_selected!['description'] as String?)?.isNotEmpty == true)
            _buildDescriptionCard(_selected!),
        ],
      ]),
    );
  }

  Widget _buildCaseDetailsCard(Map<String, dynamic> c) {
    final employee = (c['employee'] as Map?)?.cast<String, dynamic>();
    final recordedBy = (c['recorded_by'] as Map?)?.cast<String, dynamic>();
    return Container(
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Text('Case Details', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ),
        const Divider(height: 1, color: AppColors.border),
        _detailRow('EMPLOYEE', employee?['name'] as String? ?? 'N/A', Icons.person_outline),
        const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
        _detailRow('TYPE', _formatType(c['record_type'] as String? ?? ''), Icons.label_outline),
        const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
        _detailRow('ISSUED', c['issue_date'] as String? ?? '', Icons.calendar_today_outlined),
        if ((c['incident_date'] as String?) != null) ...[
          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
          _detailRow('INCIDENT DATE', c['incident_date'] as String, Icons.event_outlined),
        ],
        if (recordedBy != null) ...[
          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
          _detailRow('RECORDED BY', recordedBy['name'] as String? ?? '', Icons.manage_accounts_outlined),
        ],
        if ((c['outcome'] as String?)?.isNotEmpty == true) ...[
          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
          _detailRow('OUTCOME', c['outcome'] as String, Icons.check_circle_outline),
        ],
        if ((c['resolution_date'] as String?) != null) ...[
          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.border),
          _detailRow('RESOLVED', c['resolution_date'] as String, Icons.event_available_outlined),
        ],
      ]),
    );
  }

  Widget _buildLifecycleStepper(Map<String, dynamic> c) {
    final status = c['status'] as String? ?? 'open';
    final stages = _getStages(status);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Case Lifecycle', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 16),
        ...stages.asMap().entries.map((entry) {
          final i = entry.key;
          final stage = entry.value;
          return _StepRow(label: stage['label'] as String, statusStr: stage['status'] as String, isLast: i == stages.length - 1);
        }),
      ]),
    );
  }

  Widget _buildDescriptionCard(Map<String, dynamic> c) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Description', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 10),
        Text(c['description'] as String, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.5)),
        if ((c['appeal_notes'] as String?)?.isNotEmpty == true) ...[
          const SizedBox(height: 12),
          const Text('Appeal Notes', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          const SizedBox(height: 6),
          Text(c['appeal_notes'] as String, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.5)),
        ],
      ]),
    );
  }

  Widget _sectionHeader(String title, IconData icon, Color color) => Row(children: [
    Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: color, size: 15)),
    const SizedBox(width: 8),
    Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
  ]);

  Widget _detailRow(String label, String value, IconData icon) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    child: Row(children: [
      Container(width: 32, height: 32, decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(8)), child: Icon(icon, size: 16, color: AppColors.textSecondary)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.8)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      ])),
    ]),
  );

  List<Map<String, String>> _getStages(String status) {
    final allStages = ['open', 'under_review', 'hearing', 'outcome', 'appealed', 'resolved', 'closed'];
    final stageLabels = {
      'open': 'Initial Report',
      'under_review': 'Under Review',
      'hearing': 'Hearing',
      'outcome': 'Outcome',
      'appealed': 'Appeal',
      'resolved': 'Resolved',
      'closed': 'Closed',
    };
    final currentIdx = allStages.indexOf(status);
    return allStages.map((s) {
      final idx = allStages.indexOf(s);
      String stepStatus;
      if (idx < currentIdx) {
        stepStatus = 'completed';
      } else if (idx == currentIdx) stepStatus = 'active';
      else stepStatus = 'pending';
      return {'label': stageLabels[s] ?? s, 'status': stepStatus};
    }).toList();
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'resolved': case 'closed': return AppColors.success;
      case 'hearing': case 'under_review': return AppColors.warning;
      case 'appealed': return AppColors.info;
      default: return AppColors.primary;
    }
  }

  String _statusLabel(String status) => status.replaceAll('_', ' ').split(' ').map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
  String _formatType(String type) => type.replaceAll('_', ' ').split(' ').map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _StepRow extends StatelessWidget {
  final String label;
  final String statusStr;
  final bool isLast;
  const _StepRow({required this.label, required this.statusStr, required this.isLast});

  @override
  Widget build(BuildContext context) {
    Color dotColor;
    Color dotBg;
    Widget dotChild;
    Color textColor;

    switch (statusStr) {
      case 'completed':
        dotColor = AppColors.success;
        dotBg = AppColors.success.withValues(alpha: 0.15);
        dotChild = const Icon(Icons.check, size: 14, color: AppColors.success);
        textColor = AppColors.textPrimary;
        break;
      case 'active':
        dotColor = AppColors.warning;
        dotBg = AppColors.warning.withValues(alpha: 0.15);
        dotChild = Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.warning, shape: BoxShape.circle));
        textColor = AppColors.textPrimary;
        break;
      default:
        dotColor = AppColors.border;
        dotBg = AppColors.bgCard;
        dotChild = Container(width: 8, height: 8, decoration: BoxDecoration(color: AppColors.textMuted.withValues(alpha: 0.5), shape: BoxShape.circle));
        textColor = AppColors.textSecondary;
    }

    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Column(children: [
        Container(
          width: 30, height: 30,
          decoration: BoxDecoration(color: dotBg, shape: BoxShape.circle, border: Border.all(color: dotColor, width: 1.5)),
          child: Center(child: dotChild),
        ),
        if (!isLast)
          Container(width: 2, height: 32, color: statusStr == 'completed' ? AppColors.success.withValues(alpha: 0.4) : AppColors.border),
      ]),
      const SizedBox(width: 12),
      Expanded(child: Padding(padding: const EdgeInsets.only(top: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: textColor)),
        if (!isLast) const SizedBox(height: 8),
      ]))),
    ]);
  }
}
