import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

class PifReviewApprovalScreen extends ConsumerStatefulWidget {
  const PifReviewApprovalScreen({super.key, this.programmeId});

  final String? programmeId;

  @override
  ConsumerState<PifReviewApprovalScreen> createState() =>
      _PifReviewApprovalScreenState();
}

class _PifReviewApprovalScreenState
    extends ConsumerState<PifReviewApprovalScreen> {
  bool _loading = true;
  bool _attachmentsLoading = false;
  bool _uploadingAttachment = false;
  bool _generatingImprest = false;
  String? _error;
  Map<String, dynamic>? _programme;
  List<Map<String, dynamic>> _attachments = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final programmeId = widget.programmeId;
    if (programmeId == null || programmeId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing programme ID.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final dio = ref.read(apiClientProvider).dio;
      final programmeRes =
          await dio.get<Map<String, dynamic>>('/programmes/$programmeId');
      final attachmentsRes = await dio
          .get<Map<String, dynamic>>('/programmes/$programmeId/attachments');

      if (!mounted) return;
      setState(() {
        _programme = programmeRes.data == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(programmeRes.data as Map);
        _attachments = ((attachmentsRes.data?['data'] as List<dynamic>?) ?? const [])
            .map(
              (item) => item is Map
                  ? Map<String, dynamic>.from(item)
                  : <String, dynamic>{},
            )
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load programme.';
        _loading = false;
      });
    }
  }

  Future<void> _loadAttachments() async {
    final programmeId = widget.programmeId;
    if (programmeId == null || programmeId.isEmpty) return;
    setState(() => _attachmentsLoading = true);
    try {
      final res = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>('/programmes/$programmeId/attachments');
      if (!mounted) return;
      setState(() {
        _attachments = ((res.data?['data'] as List<dynamic>?) ?? const [])
            .map(
              (item) => item is Map
                  ? Map<String, dynamic>.from(item)
                  : <String, dynamic>{},
            )
            .toList();
      });
    } finally {
      if (mounted) setState(() => _attachmentsLoading = false);
    }
  }

  Future<void> _pickAndUploadAttachment() async {
    final programmeId = widget.programmeId;
    if (programmeId == null || programmeId.isEmpty) return;
    final file = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      type: FileType.any,
    );
    final path = file?.files.single.path;
    if (path == null || !mounted) return;

    setState(() => _uploadingAttachment = true);
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(path, filename: file!.files.single.name),
        'document_type': 'other',
      });
      await ref
          .read(apiClientProvider)
          .dio
          .post('/programmes/$programmeId/attachments', data: form);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attachment uploaded.'),
          backgroundColor: AppColors.success,
        ),
      );
      await _loadAttachments();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Upload failed.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingAttachment = false);
    }
  }

  Future<void> _downloadAttachment(Map<String, dynamic> attachment) async {
    final programmeId = widget.programmeId;
    final attachmentId = attachment['id'];
    if (programmeId == null || attachmentId == null) return;
    try {
      final res = await ref.read(apiClientProvider).dio.get<List<int>>(
            '/programmes/$programmeId/attachments/$attachmentId/download',
            options: Options(responseType: ResponseType.bytes),
          );
      final dir = await getTemporaryDirectory();
      final filename =
          attachment['original_filename']?.toString() ?? 'attachment';
      final file = File('${dir.path}/$filename');
      await file.writeAsBytes(res.data ?? const []);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Saved: ${file.path}')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Download failed.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _deleteAttachment(Map<String, dynamic> attachment) async {
    final programmeId = widget.programmeId;
    final attachmentId = attachment['id'];
    if (programmeId == null || attachmentId == null) return;
    try {
      await ref
          .read(apiClientProvider)
          .dio
          .delete('/programmes/$programmeId/attachments/$attachmentId');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attachment deleted.'),
          backgroundColor: AppColors.success,
        ),
      );
      await _loadAttachments();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delete failed.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _generateImprest() async {
    final programme = _programme;
    final programmeId = widget.programmeId;
    if (programme == null || programmeId == null) return;

    final amount = _asDouble(programme['total_budget']);
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Programme has no budget to generate an imprest request.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    setState(() => _generatingImprest = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final liquidationDate = _liquidationDate(programme);
      final createRes = await dio.post<Map<String, dynamic>>(
        '/imprest/requests',
        data: {
          'budget_line': programme['reference_number']?.toString() ??
              programme['title']?.toString() ??
              'Programme',
          'amount_requested': amount,
          'currency': programme['primary_currency']?.toString() ?? 'NAD',
          'expected_liquidation_date': liquidationDate,
          'purpose': programme['title']?.toString() ?? 'Programme activity',
          'justification': programme['background']?.toString() ??
              'Generated from programme $programmeId',
        },
      );
      final imprestId = createRes.data?['data']?['id'];
      if (imprestId != null) {
        await dio.post('/imprest/requests/$imprestId/submit');
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Imprest request generated and submitted.'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to generate imprest request.'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _generatingImprest = false);
    }
  }

  String _liquidationDate(Map<String, dynamic> programme) {
    final endDate = programme['end_date']?.toString();
    final now = DateTime.now();
    if (endDate != null && endDate.isNotEmpty) {
      final parsed = DateTime.tryParse(endDate);
      if (parsed != null) {
        return parsed.add(const Duration(days: 14)).toIso8601String().split('T').first;
      }
    }
    return now.add(const Duration(days: 14)).toIso8601String().split('T').first;
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  String _statusLabel(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return 'Approved';
      case 'submitted':
        return 'Submitted';
      case 'rejected':
        return 'Rejected';
      case 'draft':
        return 'Draft';
      default:
        return status == null || status.isEmpty ? 'Unknown' : status;
    }
  }

  Color _statusColor(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return AppColors.success;
      case 'rejected':
        return AppColors.danger;
      case 'draft':
        return AppColors.textMuted;
      default:
        return AppColors.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        title: const Text(
          'Programme Review',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _buildBody(_programme ?? const {}),
      bottomNavigationBar: _programme == null
          ? null
          : Container(
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
              child: ElevatedButton.icon(
                onPressed: _generatingImprest ? null : _generateImprest,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.bgDark,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: _generatingImprest
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.bgDark,
                        ),
                      )
                    : const Icon(Icons.account_balance_wallet_outlined),
                label: Text(
                  _generatingImprest ? 'Generating...' : 'Generate Imprest',
                ),
              ),
            ),
    );
  }

  Widget _buildBody(Map<String, dynamic> programme) {
    final status = programme['status']?.toString();
    final statusColor = _statusColor(status);
    final budgetLines = (programme['budget_lines'] as List<dynamic>? ?? const []);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _statusLabel(status),
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'ID: ${programme['reference_number'] ?? programme['id'] ?? '-'}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            programme['title']?.toString() ?? 'Programme',
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            programme['overall_objective']?.toString() ??
                programme['background']?.toString() ??
                '-',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                _metaRow(
                  icon: Icons.tag,
                  label: 'Reference',
                  value: programme['reference_number']?.toString() ?? '-',
                  valueColor: AppColors.gold,
                ),
                const SizedBox(height: 10),
                _metaRow(
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'Total Budget',
                  value:
                      '${programme['primary_currency'] ?? 'NAD'} ${_asDouble(programme['total_budget']).toStringAsFixed(2)}',
                  valueColor: AppColors.success,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _metaRow(
                        icon: Icons.calendar_today,
                        label: 'Start',
                        value: programme['start_date']?.toString() == null
                            ? '-'
                            : AppDateFormatter.short(
                                programme['start_date'].toString(),
                              ),
                        valueColor: AppColors.textPrimary,
                      ),
                    ),
                    Expanded(
                      child: _metaRow(
                        icon: Icons.location_on_outlined,
                        label: 'Location',
                        value: _memberStates(programme),
                        valueColor: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const _SectionTitle(
            icon: Icons.account_balance_wallet_outlined,
            iconColor: AppColors.primary,
            label: 'BUDGET LINES',
          ),
          const SizedBox(height: 12),
          if (budgetLines.isEmpty)
            const Text(
              'No budget lines attached yet.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            )
          else
            ...budgetLines.map(
              (rawLine) {
                final line = rawLine is Map
                    ? Map<String, dynamic>.from(rawLine)
                    : <String, dynamic>{};
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
                      Text(
                        line['category']?.toString() ?? 'Budget Line',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        line['description']?.toString() ?? '-',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${programme['primary_currency'] ?? 'NAD'} ${_asDouble(line['amount']).toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: 22),
          const _SectionTitle(
            icon: Icons.attach_file,
            iconColor: AppColors.primary,
            label: 'ATTACHMENTS',
          ),
          const SizedBox(height: 12),
          if (_attachmentsLoading && _attachments.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            )
          else if (_attachments.isEmpty)
            const Text(
              'No attachments yet.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            )
          else
            ..._attachments.map(_attachmentCard),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _uploadingAttachment ? null : _pickAndUploadAttachment,
            icon: _uploadingAttachment
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  )
                : const Icon(Icons.add),
            label: Text(_uploadingAttachment ? 'Uploading...' : 'Add attachment'),
          ),
        ],
      ),
    );
  }

  String _memberStates(Map<String, dynamic> programme) {
    final raw = programme['member_states'];
    if (raw is List && raw.isNotEmpty) {
      return raw.join(', ');
    }
    return '-';
  }

  Widget _metaRow({
    required IconData icon,
    required String label,
    required String value,
    required Color valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _attachmentCard(Map<String, dynamic> attachment) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.insert_drive_file_outlined, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  attachment['original_filename']?.toString() ?? 'Attachment',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  attachment['created_at']?.toString() == null
                      ? '-'
                      : AppDateFormatter.short(attachment['created_at'].toString()),
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _downloadAttachment(attachment),
            icon: const Icon(Icons.download_outlined),
          ),
          IconButton(
            onPressed: () => _deleteAttachment(attachment),
            icon: const Icon(Icons.delete_outline, color: AppColors.danger),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 16),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1,
          ),
        ),
      ],
    );
  }
}
