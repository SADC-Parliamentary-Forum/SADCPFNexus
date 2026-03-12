import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class HrFileDocumentsScreen extends ConsumerStatefulWidget {
  final int fileId;
  final String employeeName;

  const HrFileDocumentsScreen({
    super.key,
    required this.fileId,
    required this.employeeName,
  });

  @override
  ConsumerState<HrFileDocumentsScreen> createState() =>
      _HrFileDocumentsScreenState();
}

class _HrFileDocumentsScreenState
    extends ConsumerState<HrFileDocumentsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _documents = [];
  List<Map<String, dynamic>> _filtered = [];
  String _selectedType = 'all';

  static const _filterTypes = [
    ('all', 'All'),
    ('identity', 'Identity'),
    ('appointment', 'Appointment'),
    ('contract', 'Contract'),
    ('qualification', 'Qualification'),
    ('training', 'Training'),
    ('appraisal', 'Appraisal'),
    ('commendation', 'Commendation'),
    ('warning', 'Warning'),
    ('other', 'Other'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .get<dynamic>('/hr/files/${widget.fileId}/documents');
      final data = res.data;
      final List<dynamic> raw =
          (data is Map && data['data'] != null)
              ? data['data'] as List<dynamic>
              : (data is List ? data : []);
      _documents = raw.cast<Map<String, dynamic>>();
      _applyFilter();
      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _applyFilter() {
    if (_selectedType == 'all') {
      _filtered = List.from(_documents);
    } else {
      _filtered = _documents
          .where((d) => d['document_type'] == _selectedType)
          .toList();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: Text(
          'Documents — ${widget.employeeName}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: AppColors.bgDark,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? _buildError()
              : Column(
                  children: [
                    _buildFilterRow(),
                    Expanded(
                      child: _filtered.isEmpty
                          ? _buildEmpty()
                          : RefreshIndicator(
                              onRefresh: _loadData,
                              color: AppColors.primary,
                              child: ListView.separated(
                                padding: const EdgeInsets.fromLTRB(
                                    16, 12, 16, 32),
                                itemCount: _filtered.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (_, i) =>
                                    _DocCard(doc: _filtered[i]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 48, color: AppColors.danger),
            const SizedBox(height: 12),
            const Text(
              'Failed to load documents',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? '',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textMuted),
              textAlign: TextAlign.center,
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
    );
  }

  Widget _buildFilterRow() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        itemCount: _filterTypes.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final type = _filterTypes[i].$1;
          final label = _filterTypes[i].$2;
          final isSelected = _selectedType == type;
          return GestureDetector(
            onTap: () {
              setState(() => _selectedType = type);
              _applyFilter();
            },
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.15)
                    : AppColors.bgSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected
                      ? AppColors.primary
                      : AppColors.border,
                ),
              ),
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight:
                      isSelected ? FontWeight.w700 : FontWeight.w500,
                  color: isSelected
                      ? AppColors.primary
                      : AppColors.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.folder_open_outlined,
              size: 56,
              color: AppColors.textMuted.withValues(alpha: 0.5)),
          const SizedBox(height: 12),
          const Text(
            'No documents found',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.textMuted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _selectedType == 'all'
                ? 'No documents have been uploaded for this employee.'
                : 'No "$_selectedType" documents found.',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _DocCard extends StatelessWidget {
  final Map<String, dynamic> doc;

  const _DocCard({required this.doc});

  static IconData _typeIcon(String? type) {
    switch (type) {
      case 'appointment':
        return Icons.assignment_outlined;
      case 'contract':
        return Icons.article_outlined;
      case 'qualification':
        return Icons.school_outlined;
      case 'training':
        return Icons.menu_book_outlined;
      case 'appraisal':
        return Icons.rate_review_outlined;
      case 'commendation':
        return Icons.star_outline;
      case 'warning':
        return Icons.warning_amber_outlined;
      case 'identity':
        return Icons.badge_outlined;
      default:
        return Icons.attach_file_outlined;
    }
  }

  static Color _typeColor(String? type) {
    switch (type) {
      case 'warning':
        return AppColors.danger;
      case 'commendation':
        return AppColors.gold;
      case 'appointment':
      case 'contract':
        return AppColors.primary;
      case 'qualification':
      case 'training':
        return AppColors.info;
      case 'identity':
        return const Color(0xFF8B5CF6);
      default:
        return AppColors.textMuted;
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
    final issueDate = doc['issue_date'] as String?;
    final uploadDate = doc['created_at'] as String?;
    final expiryDate = doc['expiry_date'] as String?;
    final uploadedBy = doc['uploaded_by'] as String? ??
        ((doc['uploader'] is Map)
            ? (doc['uploader'] as Map)['name']?.toString()
            : null);

    final iconColor = _typeColor(docType);
    final cColor = _confidentialityColor(confidentiality);

    bool expiryWarning = false;
    bool expired = false;
    String? expiryText;
    if (expiryDate != null) {
      try {
        final exp = DateTime.parse(expiryDate);
        final now = DateTime.now();
        final daysLeft = exp.difference(now).inDays;
        if (exp.isBefore(now)) {
          expired = true;
          expiryText = 'Expired ${_fmtDate(expiryDate)}';
        } else if (daysLeft <= 30) {
          expiryWarning = true;
          expiryText = 'Expires in $daysLeft days';
        } else {
          expiryText = 'Expires ${_fmtDate(expiryDate)}';
        }
      } catch (_) {
        expiryText = expiryDate;
      }
    }

    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(
          color: expired
              ? AppColors.danger.withValues(alpha: 0.3)
              : AppColors.border,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(_typeIcon(docType), size: 20, color: iconColor),
          ),
          const SizedBox(width: 12),
          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
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
                    // Confidentiality badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: cColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(5),
                        border:
                            Border.all(color: cColor.withValues(alpha: 0.3)),
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
                if (docType != null) ...[
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: iconColor.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      docType
                          .split('_')
                          .map(
                              (w) => w[0].toUpperCase() + w.substring(1))
                          .join(' '),
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: iconColor,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 5),
                // Meta row
                Wrap(
                  spacing: 10,
                  runSpacing: 2,
                  children: [
                    if (issueDate != null)
                      _MetaText(
                          icon: Icons.calendar_today_outlined,
                          text: 'Issued ${_fmtDate(issueDate)}'),
                    if (uploadDate != null)
                      _MetaText(
                          icon: Icons.upload_outlined,
                          text:
                              'Uploaded ${_fmtDate(uploadDate)}${uploadedBy != null ? ' by $uploadedBy' : ''}'),
                    if (expiryText != null)
                      _MetaText(
                        icon: Icons.schedule,
                        text: expiryText,
                        color: expired || expiryWarning
                            ? AppColors.danger
                            : AppColors.textMuted,
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

class _MetaText extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color? color;

  const _MetaText({required this.icon, required this.text, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textMuted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 10, color: c),
        const SizedBox(width: 3),
        Text(
          text,
          style: TextStyle(fontSize: 10, color: c),
        ),
      ],
    );
  }
}
