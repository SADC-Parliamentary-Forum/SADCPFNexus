import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_file/open_file.dart';
import 'package:path_provider/path_provider.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_screen.dart';

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
    return StitchScreen(
      title: 'Documents',
      fallbackRoute: '/dashboard',
      body: _loading
          ? const StitchLoadingState(label: 'Loading documents')
          : _error != null
              ? StitchErrorState(
                  message: _error ?? 'Failed to load documents',
                  onRetry: _loadData,
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          widget.employeeName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ),
                    ),
                    _buildFilterRow(),
                    Expanded(
                      child: _filtered.isEmpty
                          ? StitchEmptyState(
                              title: 'No documents found',
                              message: _selectedType == 'all'
                                  ? 'No documents have been uploaded for this employee.'
                                  : 'No "$_selectedType" documents found.',
                              icon: Icons.folder_open_outlined,
                            )
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
}

// ─────────────────────────────────────────────────────────────────────────────

class _DocCard extends ConsumerWidget {
  final Map<String, dynamic> doc;

  const _DocCard({required this.doc});

  Future<void> _openDocument(BuildContext context, WidgetRef ref) async {
    final path = doc['file_path'] as String? ??
        doc['file_url'] as String? ??
        doc['download_url'] as String?;
    if (path == null || path.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('No file is attached to this document.')));
      return;
    }
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<List<int>>(
        path,
        options: Options(responseType: ResponseType.bytes),
      );
      if (res.data == null || res.data!.isEmpty) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text('No file available for this document.')));
        }
        return;
      }
      final dir = await getTemporaryDirectory();
      final fileName = (doc['file_name'] as String?) ??
          'document_${doc['id'] ?? DateTime.now().millisecondsSinceEpoch}';
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(res.data!);
      final openResult = await OpenFile.open(file.path);
      if (context.mounted && openResult.type != ResultType.done) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Document saved. Open with a compatible viewer.')));
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Unable to open document.')));
      }
    }
  }

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
  Widget build(BuildContext context, WidgetRef ref) {
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
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(
          color: expired
              ? AppColors.danger.withValues(alpha: 0.3)
              : AppColors.border,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _openDocument(context, ref),
          child: Padding(
            padding: const EdgeInsets.all(13),
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
          ),
        ),
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
