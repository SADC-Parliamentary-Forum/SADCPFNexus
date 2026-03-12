import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class HrFileSummaryScreen extends ConsumerStatefulWidget {
  final int fileId;

  const HrFileSummaryScreen({super.key, required this.fileId});

  @override
  ConsumerState<HrFileSummaryScreen> createState() =>
      _HrFileSummaryScreenState();
}

class _HrFileSummaryScreenState extends ConsumerState<HrFileSummaryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _file;
  List<Map<String, dynamic>> _documents = [];
  List<Map<String, dynamic>> _timeline = [];

  bool _isHrOrSupervisor = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(authRepositoryProvider);
      final roles = await repo.getStoredRoles();
      _isHrOrSupervisor = roles.any((r) =>
          r.toLowerCase().contains('hr') ||
          r.toLowerCase().contains('supervisor') ||
          r.toLowerCase().contains('manager') ||
          r.toLowerCase().contains('admin'));

      final dio = ref.read(apiClientProvider).dio;

      final fileRes = await dio.get<dynamic>(
        '/hr/files/${widget.fileId}',
        queryParameters: {'with_timeline': 1, 'with_documents': 1},
      );
      final fileData = fileRes.data;
      _file = (fileData is Map && fileData['data'] != null)
          ? Map<String, dynamic>.from(fileData['data'] as Map)
          : Map<String, dynamic>.from(fileData is Map ? fileData : {});

      final rawDocs = _file?['documents'];
      if (rawDocs is List) {
        _documents = rawDocs.cast<Map<String, dynamic>>();
      }

      final rawTimeline = _file?['timeline'];
      if (rawTimeline is List) {
        _timeline = rawTimeline.cast<Map<String, dynamic>>();
      }

      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.bgDark,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.bgDark,
        appBar: AppBar(
          title: const Text('HR Personal File'),
          backgroundColor: AppColors.bgDark,
          foregroundColor: AppColors.textPrimary,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    size: 48, color: AppColors.danger),
                const SizedBox(height: 12),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textMuted),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loadData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.textPrimary,
                    minimumSize: const Size(140, 44),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final f = _file!;
    final name = (f['employee_name'] ?? f['name'] ?? 'Unknown').toString();

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('HR Personal File'),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.folder_outlined),
            tooltip: 'Documents',
            onPressed: () => context.push(
              '/hr/files/documents',
              extra: {'fileId': widget.fileId, 'employeeName': name},
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Summary'),
            Tab(text: 'Employment'),
            Tab(text: 'Documents'),
            Tab(text: 'Timeline'),
          ],
        ),
      ),
      floatingActionButton: _tabController.index == 3 && _isHrOrSupervisor
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.textPrimary,
              onPressed: () => _showAddEventDialog(context),
              child: const Icon(Icons.add),
            )
          : null,
      body: Column(
        children: [
          _buildHeaderCard(f, name),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildSummaryTab(f),
                _buildEmploymentTab(f),
                _buildDocumentsTab(),
                _buildTimelineTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(Map<String, dynamic> f, String name) {
    final position = (f['job_title'] ?? f['position'] ?? '').toString();
    final department = (f['department'] ?? '').toString();
    final fileStatus = f['file_status'] as String?;
    final empStatus = f['employment_status'] as String?;
    final probationStatus = f['probation_status'] as String?;

    final initials = name
        .split(' ')
        .where((s) => s.isNotEmpty)
        .take(2)
        .map((s) => s[0].toUpperCase())
        .join();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (position.isNotEmpty)
                  Text(
                    position,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                if (department.isNotEmpty)
                  Text(
                    department,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted),
                  ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (fileStatus != null)
                      _HrBadge(
                        label: _fileStatusLabel(fileStatus),
                        color: _fileStatusColor(fileStatus),
                      ),
                    if (empStatus != null)
                      _HrBadge(
                        label: _empStatusLabel(empStatus),
                        color: _empStatusColor(empStatus),
                      ),
                    if (probationStatus == 'on_probation')
                      const _HrBadge(
                        label: 'On Probation',
                        color: Color(0xFFF59E0B),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryTab(Map<String, dynamic> f) {
    final warnings = f['total_warnings'] as int? ?? 0;
    final commendations = f['total_commendations'] as int? ?? 0;
    final devActions = f['development_actions_count'] as int? ?? 0;
    final trainingHours =
        double.tryParse((f['training_hours'] ?? '0').toString()) ?? 0.0;

    final appointmentDate = f['appointment_date'] as String?;
    final confirmationDate = f['confirmation_date'] as String?;

    final emergencyContact = f['emergency_contact'] as Map<String, dynamic>?;

    final latestAppraisal =
        f['latest_appraisal'] as Map<String, dynamic>?;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
      children: [
        // Key stats chips
        Row(
          children: [
            _SummaryChip(
              icon: Icons.warning_amber_outlined,
              label: 'Warnings',
              value: '$warnings',
              color: warnings > 0 ? AppColors.danger : AppColors.textMuted,
            ),
            const SizedBox(width: 8),
            _SummaryChip(
              icon: Icons.star_outline,
              label: 'Commendations',
              value: '$commendations',
              color: AppColors.gold,
            ),
            const SizedBox(width: 8),
            _SummaryChip(
              icon: Icons.school_outlined,
              label: 'Dev Actions',
              value: '$devActions',
              color: AppColors.info,
            ),
            const SizedBox(width: 8),
            _SummaryChip(
              icon: Icons.access_time,
              label: 'Training hrs',
              value: trainingHours.toStringAsFixed(0),
              color: AppColors.primary,
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Key dates
        _InfoCard(
          title: 'Key Dates',
          rows: [
            ('Appointment Date', _formatDate(appointmentDate) ?? 'Not set'),
            ('Confirmation Date',
                _formatDate(confirmationDate) ?? 'Not confirmed'),
          ],
        ),
        const SizedBox(height: 12),

        // Emergency contact
        if (emergencyContact != null) ...[
          _InfoCard(
            title: 'Emergency Contact',
            rows: [
              ('Name', emergencyContact['name']?.toString() ?? 'N/A'),
              ('Relationship',
                  emergencyContact['relationship']?.toString() ?? 'N/A'),
              ('Phone', emergencyContact['phone']?.toString() ?? 'N/A'),
            ],
          ),
          const SizedBox(height: 12),
        ],

        // Latest appraisal
        if (latestAppraisal != null) ...[
          _InfoCard(
            title: 'Latest Appraisal',
            rows: [
              ('Period', latestAppraisal['period']?.toString() ?? 'N/A'),
              ('Rating', latestAppraisal['rating']?.toString() ?? 'N/A'),
              ('Score', latestAppraisal['score']?.toString() ?? 'N/A'),
            ],
          ),
          const SizedBox(height: 12),
        ],

        // View performance button
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => context.push('/hr/performance'),
            icon: const Icon(Icons.trending_up, size: 18),
            label: const Text('View Performance Tracker'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: const BorderSide(color: AppColors.primary),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmploymentTab(Map<String, dynamic> f) {
    final appointmentDate = f['appointment_date'] as String?;
    final empStatus = f['employment_status'] as String?;
    final contractType = f['contract_type'] as String?;
    final gradeScale = f['grade_scale'] as String?;
    final payrollNumber = f['payroll_number'] as String?;
    final contractExpiry = f['contract_end_date'] as String?;

    bool contractExpiringSoon = false;
    if (contractExpiry != null) {
      try {
        final exp = DateTime.parse(contractExpiry);
        contractExpiringSoon =
            exp.difference(DateTime.now()).inDays <= 90;
      } catch (_) {}
    }

    final promotionHistory = f['promotion_history'] as List?;
    final transferHistory = f['transfer_history'] as List?;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
      children: [
        _InfoCard(
          title: 'Employment Details',
          rows: [
            ('Appointment Date', _formatDate(appointmentDate) ?? 'N/A'),
            ('Employment Status', _empStatusLabel(empStatus)),
            ('Contract Type', contractType ?? 'N/A'),
            ('Grade / Scale', gradeScale ?? 'N/A'),
            ('Payroll Number', payrollNumber ?? 'N/A'),
          ],
          extraWidget: contractExpiry != null
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Contract Expiry',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary),
                    ),
                    Text(
                      _formatDate(contractExpiry) ?? contractExpiry,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: contractExpiringSoon
                            ? const Color(0xFFF59E0B)
                            : AppColors.textPrimary,
                      ),
                    ),
                  ],
                )
              : null,
        ),
        const SizedBox(height: 12),

        // Promotion history
        if (promotionHistory != null && promotionHistory.isNotEmpty) ...[
          _HistoryCard(
            title: 'Promotion History',
            icon: Icons.arrow_upward,
            color: AppColors.success,
            items: promotionHistory
                .cast<Map<String, dynamic>>()
                .map((p) => _HistoryItem(
                      title: p['title']?.toString() ?? p['position']?.toString() ?? 'Promotion',
                      date: _formatDate(p['date']?.toString()) ?? p['date']?.toString() ?? '',
                      subtitle: p['from']?.toString(),
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
        ],

        // Transfer history
        if (transferHistory != null && transferHistory.isNotEmpty) ...[
          _HistoryCard(
            title: 'Transfer History',
            icon: Icons.swap_horiz,
            color: AppColors.info,
            items: transferHistory
                .cast<Map<String, dynamic>>()
                .map((t) => _HistoryItem(
                      title: t['to_department']?.toString() ??
                          t['department']?.toString() ??
                          'Transfer',
                      date: _formatDate(t['date']?.toString()) ?? t['date']?.toString() ?? '',
                      subtitle: t['from_department']?.toString(),
                    ))
                .toList(),
          ),
        ],

        if ((promotionHistory == null || promotionHistory.isEmpty) &&
            (transferHistory == null || transferHistory.isEmpty))
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'No promotion or transfer history recorded.',
              style:
                  TextStyle(fontSize: 12, color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }

  Widget _buildDocumentsTab() {
    if (_documents.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.folder_open_outlined,
                size: 56,
                color: AppColors.textMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            const Text(
              'No documents uploaded',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
      itemCount: _documents.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) => _DocumentCard(doc: _documents[i]),
    );
  }

  Widget _buildTimelineTab() {
    if (_timeline.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.timeline,
                size: 56,
                color: AppColors.textMuted.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            const Text(
              'No timeline events',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 80),
      itemCount: _timeline.length,
      itemBuilder: (_, i) {
        final event = _timeline[i];
        final isLast = i == _timeline.length - 1;
        return _TimelineEventTile(event: event, isLast: isLast);
      },
    );
  }

  void _showAddEventDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String selectedType = 'general';

    final types = [
      'general',
      'appointment',
      'promotion',
      'transfer',
      'warning',
      'commendation',
      'training',
      'performance_review',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.bgSurface,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14)),
          title: const Text(
            'Add Timeline Event',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Event Title',
                  isDense: true,
                ),
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: selectedType,
                decoration: const InputDecoration(
                  labelText: 'Event Type',
                  isDense: true,
                ),
                items: types
                    .map((t) => DropdownMenuItem(
                          value: t,
                          child: Text(
                            t
                                .split('_')
                                .map((w) =>
                                    w[0].toUpperCase() + w.substring(1))
                                .join(' '),
                            style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textPrimary),
                          ),
                        ))
                    .toList(),
                onChanged: (v) =>
                    setDialogState(() => selectedType = v ?? 'general'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Description (optional)',
                  isDense: true,
                ),
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textPrimary),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel',
                  style: TextStyle(color: AppColors.textMuted)),
            ),
            TextButton(
              onPressed: () async {
                if (titleCtrl.text.isEmpty) return;
                try {
                  await ref.read(apiClientProvider).dio.post<dynamic>(
                    '/hr/files/${widget.fileId}/timeline',
                    data: {
                      'title': titleCtrl.text,
                      'event_type': selectedType,
                      'description': descCtrl.text,
                      'event_date':
                          DateTime.now().toIso8601String().split('T').first,
                    },
                  );
                  if (mounted) {
                    Navigator.pop(ctx);
                    _loadData();
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed: $e')),
                    );
                  }
                }
              },
              style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary),
              child: const Text('Add Event'),
            ),
          ],
        ),
      ),
    );
  }

  static Color _fileStatusColor(String? s) {
    switch (s) {
      case 'active':
        return AppColors.success;
      case 'under_review':
        return const Color(0xFFF59E0B);
      case 'archived':
        return AppColors.textMuted;
      default:
        return AppColors.textMuted;
    }
  }

  static String _fileStatusLabel(String? s) {
    switch (s) {
      case 'active':
        return 'Active File';
      case 'under_review':
        return 'Under Review';
      case 'archived':
        return 'Archived';
      default:
        return s ?? 'Unknown';
    }
  }

  static Color _empStatusColor(String? s) {
    switch (s) {
      case 'active':
        return AppColors.success;
      case 'terminated':
      case 'separated':
        return AppColors.danger;
      case 'on_notice':
        return const Color(0xFFF59E0B);
      default:
        return AppColors.textMuted;
    }
  }

  static String _empStatusLabel(String? s) {
    switch (s) {
      case 'active':
        return 'Active';
      case 'terminated':
        return 'Terminated';
      case 'separated':
        return 'Separated';
      case 'on_notice':
        return 'On Notice';
      default:
        return s ?? 'Unknown';
    }
  }

  static String? _formatDate(String? raw) {
    if (raw == null) return null;
    try {
      final d = DateTime.parse(raw);
      return '${d.day} ${_monthAbbr(d.month)} ${d.year}';
    } catch (_) {
      return raw;
    }
  }

  static String _monthAbbr(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1];
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _HrBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _HrBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _SummaryChip({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 3),
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 8, color: AppColors.textMuted),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final List<(String, String)> rows;
  final Widget? extraWidget;

  const _InfoCard({
    required this.title,
    required this.rows,
    this.extraWidget,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding:
                const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.textSecondary,
                letterSpacing: 0.3,
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          ...rows.map(
            (r) => Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    r.$1,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Flexible(
                    child: Text(
                      r.$2,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      textAlign: TextAlign.right,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (extraWidget != null)
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: extraWidget!,
            ),
        ],
      ),
    );
  }
}

class _HistoryItem {
  final String title;
  final String date;
  final String? subtitle;

  const _HistoryItem({
    required this.title,
    required this.date,
    this.subtitle,
  });
}

class _HistoryCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final List<_HistoryItem> items;

  const _HistoryCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 6),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration:
                        BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (item.subtitle != null)
                          Text(
                            'From: ${item.subtitle}',
                            style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    item.date,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
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

class _DocumentCard extends StatelessWidget {
  final Map<String, dynamic> doc;

  const _DocumentCard({required this.doc});

  static IconData _docIcon(String? type) {
    switch (type) {
      case 'appointment':
        return Icons.assignment_outlined;
      case 'qualification':
      case 'training':
        return Icons.school_outlined;
      case 'warning':
        return Icons.warning_amber_outlined;
      case 'commendation':
        return Icons.star_outline;
      case 'appraisal':
        return Icons.rate_review_outlined;
      case 'contract':
        return Icons.description_outlined;
      case 'identity':
        return Icons.badge_outlined;
      default:
        return Icons.attach_file;
    }
  }

  static Color _confidentialityColor(String? level) {
    switch (level) {
      case 'restricted':
        return const Color(0xFFF59E0B);
      case 'confidential':
        return AppColors.danger;
      default:
        return AppColors.success;
    }
  }

  static String _confidentialityLabel(String? level) {
    switch (level) {
      case 'restricted':
        return 'Restricted';
      case 'confidential':
        return 'Confidential';
      default:
        return 'Standard';
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = (doc['title'] ?? doc['document_name'] ?? 'Document').toString();
    final docType = doc['document_type'] as String?;
    final confidentiality = doc['confidentiality'] as String?;
    final uploadDate = doc['created_at'] as String?;
    final uploadedBy = doc['uploaded_by'] as String? ??
        ((doc['uploader'] is Map)
            ? (doc['uploader'] as Map)['name']?.toString()
            : null);

    final cColor = _confidentialityColor(confidentiality);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_docIcon(docType),
                size: 20, color: AppColors.info),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (docType != null)
                  Text(
                    docType
                        .split('_')
                        .map(
                            (w) => w[0].toUpperCase() + w.substring(1))
                        .join(' '),
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textMuted),
                  ),
                if (uploadDate != null || uploadedBy != null)
                  Text(
                    [
                      if (uploadedBy != null) 'By $uploadedBy',
                      if (uploadDate != null)
                        _fmtDate(uploadDate),
                    ].join(' · '),
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textMuted),
                  ),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: cColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(5),
              border: Border.all(color: cColor.withValues(alpha: 0.3)),
            ),
            child: Text(
              _confidentialityLabel(confidentiality),
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: cColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _fmtDate(String raw) {
    try {
      final d = DateTime.parse(raw);
      const m = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${d.day} ${m[d.month - 1]} ${d.year}';
    } catch (_) {
      return raw;
    }
  }
}

class _TimelineEventTile extends StatelessWidget {
  final Map<String, dynamic> event;
  final bool isLast;

  const _TimelineEventTile({required this.event, required this.isLast});

  static ({IconData icon, Color color}) _eventInfo(String? type) {
    switch (type) {
      case 'appointment':
        return (icon: Icons.work_outline, color: AppColors.primary);
      case 'promotion':
        return (icon: Icons.arrow_upward, color: AppColors.success);
      case 'transfer':
        return (icon: Icons.swap_horiz, color: AppColors.info);
      case 'warning':
        return (icon: Icons.warning_amber_outlined, color: AppColors.danger);
      case 'commendation':
        return (icon: Icons.star_outline, color: AppColors.gold);
      case 'training':
        return (icon: Icons.school_outlined, color: AppColors.info);
      case 'performance_review':
        return (icon: Icons.rate_review_outlined, color: AppColors.primary);
      default:
        return (icon: Icons.circle_outlined, color: AppColors.textMuted);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = event['title']?.toString() ?? 'Event';
    final type = event['event_type'] as String?;
    final date = event['event_date'] ?? event['created_at'];
    final description = event['description'] as String?;

    final info = _eventInfo(type);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline line + dot
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: info.color.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(info.icon, size: 14, color: info.color),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: AppColors.border,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Content
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment:
                          MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        if (date != null)
                          Text(
                            _fmtDate(date.toString()),
                            style: const TextStyle(
                              fontSize: 10,
                              color: AppColors.textMuted,
                            ),
                          ),
                      ],
                    ),
                    if (description != null &&
                        description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        description,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _fmtDate(String raw) {
    try {
      final d = DateTime.parse(raw);
      const m = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${d.day} ${m[d.month - 1]} ${d.year}';
    } catch (_) {
      return raw;
    }
  }
}
