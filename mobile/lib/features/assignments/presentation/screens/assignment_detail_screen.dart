import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class AssignmentDetailScreen extends ConsumerStatefulWidget {
  const AssignmentDetailScreen({super.key, required this.assignmentId});
  final int assignmentId;

  @override
  ConsumerState<AssignmentDetailScreen> createState() =>
      _AssignmentDetailScreenState();
}

class _AssignmentDetailScreenState
    extends ConsumerState<AssignmentDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _item;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get('/assignments/${widget.assignmentId}');
      if (!mounted) return;
      setState(() {
        _item = extractObjectData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load assignment.';
        _loading = false;
      });
    }
  }

  Future<void> _postAction(String action, [Map<String, dynamic>? body]) async {
    setState(() => _acting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/assignments/${widget.assignmentId}/$action', data: body);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${action[0].toUpperCase()}${action.substring(1)} recorded.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not $action.')),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _item;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text('Assignment',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null || a == null
              ? Center(
                  child: Text(_error ?? 'Not found',
                      style: const TextStyle(color: AppColors.textSecondary)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(a['title']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text('${a['status'] ?? '—'} · priority ${a['priority'] ?? '—'}',
                        style: const TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 8),
                    Text('Due: ${a['due_date'] ?? '—'}',
                        style: const TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(height: 16),
                    Text(a['description']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary, height: 1.4)),
                    if (a['source_type'] != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Source: ${a['source_type']} #${a['source_id'] ?? '—'}'
                        '${a['source_reference'] != null ? ' (${a['source_reference']})' : ''}',
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12),
                      ),
                    ],
                    const SizedBox(height: 24),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _actionBtn('Accept', () => _postAction('accept', {
                              'decision': 'accepted',
                            })),
                        _actionBtn('Start', () => _postAction('start')),
                        _actionBtn('Complete', () => _postAction('complete', {
                              'notes': 'Completed from mobile',
                            })),
                      ],
                    ),
                  ],
                ),
    );
  }

  Widget _actionBtn(String label, VoidCallback onPressed) {
    return ElevatedButton(
      onPressed: _acting ? null : onPressed,
      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
      child: Text(label, style: const TextStyle(color: Colors.white)),
    );
  }
}
