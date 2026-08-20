import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class WeeklySummaryDetailScreen extends ConsumerStatefulWidget {
  const WeeklySummaryDetailScreen({super.key, required this.reportId});
  final int reportId;

  @override
  ConsumerState<WeeklySummaryDetailScreen> createState() =>
      _WeeklySummaryDetailScreenState();
}

class _WeeklySummaryDetailScreenState
    extends ConsumerState<WeeklySummaryDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _report;
  Map<String, dynamic>? _aiDraft;
  bool _busy = false;
  bool _aiConfirmed = false;
  final _donorCode = TextEditingController();
  final _donorName = TextEditingController();
  String _templateKey = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _donorCode.dispose();
    _donorName.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get('/weekly-summaries/${widget.reportId}');
      if (!mounted) return;
      setState(() {
        _report = extractObjectData(res.data);
        _aiConfirmed = _report?['ai_draft_confirmed_at'] != null;
        _donorCode.text = _report?['donor_code']?.toString() ?? '';
        _donorName.text = _report?['donor_name']?.toString() ?? '';
        _templateKey = _report?['template_key']?.toString() ?? '';
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load weekly summary.';
        _loading = false;
      });
    }
  }

  Future<void> _generateAi() async {
    setState(() => _busy = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res =
          await dio.post('/weekly-summaries/${widget.reportId}/ai-draft');
      if (!mounted) return;
      setState(() {
        _aiDraft = extractObjectData(res.data);
        _aiConfirmed = false;
      });
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('AI draft unavailable.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmAi() async {
    setState(() => _busy = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/weekly-summaries/${widget.reportId}/ai-draft/confirm',
          data: {'confirm': true});
      if (!mounted) return;
      setState(() => _aiConfirmed = true);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('AI draft confirmed. Report not submitted.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Confirm failed.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveDonorTemplate() async {
    setState(() => _busy = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.put('/weekly-summaries/${widget.reportId}', data: {
        'donor_code': _donorCode.text.trim().isEmpty ? null : _donorCode.text.trim(),
        'donor_name': _donorName.text.trim().isEmpty ? null : _donorName.text.trim(),
        'template_key': _templateKey.isEmpty ? null : _templateKey,
      });
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Donor and template saved.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save donor/template.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/weekly-summaries/${widget.reportId}/submit',
          data: {'declaration_confirmed': true});
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Weekly summary submitted.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Submit failed.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _report;
    final draftText = _aiDraft?['draft']?.toString() ??
        r?['ai_draft_text']?.toString();
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text('Weekly summary',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null || r == null
              ? Center(
                  child: Text(_error ?? 'Not found',
                      style: const TextStyle(color: AppColors.textSecondary)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(r['reference']?.toString() ?? 'Report',
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text('Status: ${r['status'] ?? '—'}',
                        style: const TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _donorCode,
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: const InputDecoration(labelText: 'Donor code'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _donorName,
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration:
                          const InputDecoration(labelText: 'Donor / project name'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _templateKey.isEmpty ? '' : _templateKey,
                      dropdownColor: AppColors.bgSurface,
                      decoration: const InputDecoration(labelText: 'Template'),
                      items: const [
                        DropdownMenuItem(value: '', child: Text('Template (optional)')),
                        DropdownMenuItem(value: 'standard', child: Text('Standard')),
                        DropdownMenuItem(
                            value: 'donor_progress', child: Text('Donor progress')),
                        DropdownMenuItem(
                            value: 'project_update', child: Text('Project update')),
                      ],
                      onChanged: (v) => setState(() => _templateKey = v ?? ''),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _busy ? null : _saveDonorTemplate,
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.bgSurface),
                      child: const Text('Save donor/template',
                          style: TextStyle(color: AppColors.textPrimary)),
                    ),
                    const SizedBox(height: 16),
                    Text(r['additional_notes']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary, height: 1.4)),
                    const SizedBox(height: 20),
                    const Text('AI draft (human confirm only)',
                        style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ElevatedButton(
                          onPressed: _busy ? null : _generateAi,
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary),
                          child: const Text('Generate AI draft',
                              style: TextStyle(color: Colors.white)),
                        ),
                        ElevatedButton(
                          onPressed: _busy || draftText == null || _aiConfirmed
                              ? null
                              : _confirmAi,
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.bgSurface),
                          child: Text(
                              _aiConfirmed ? 'Draft confirmed' : 'Confirm draft',
                              style: const TextStyle(
                                  color: AppColors.textPrimary)),
                        ),
                        ElevatedButton(
                          onPressed: _busy ? null : _submit,
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.success),
                          child: const Text('Submit',
                              style: TextStyle(color: Colors.white)),
                        ),
                      ],
                    ),
                    if (draftText != null && draftText.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(draftText,
                            style: const TextStyle(
                                color: AppColors.textSecondary, height: 1.35)),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'AI never auto-submits. Confirm is audit/content only until you submit.',
                        style: TextStyle(
                            color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ],
                ),
    );
  }
}
