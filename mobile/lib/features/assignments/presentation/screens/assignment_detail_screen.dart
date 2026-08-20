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
  List<Map<String, dynamic>> _blockedBy = [];
  final _dependsOn = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _dependsOn.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        dio.get('/assignments/${widget.assignmentId}'),
        dio.get('/assignments/${widget.assignmentId}/dependencies'),
      ]);
      if (!mounted) return;
      final deps = extractObjectData(results[1].data) ?? {};
      setState(() {
        _item = extractObjectData(results[0].data);
        _blockedBy = extractListData(deps['blocked_by'] ?? deps['data']);
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

  Future<void> _addDependency() async {
    final id = int.tryParse(_dependsOn.text.trim());
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the blocking assignment ID.')),
      );
      return;
    }
    setState(() => _acting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post(
        '/assignments/${widget.assignmentId}/dependencies',
        data: {'depends_on_assignment_id': id},
      );
      _dependsOn.clear();
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not add dependency.')),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _removeDependency(int dependencyId) async {
    setState(() => _acting = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.delete(
        '/assignments/${widget.assignmentId}/dependencies/$dependencyId',
      );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not remove dependency.')),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
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
                    const Text('Blocked by',
                        style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    if (_blockedBy.isEmpty)
                      const Text('No blocking assignments.',
                          style: TextStyle(color: AppColors.textMuted))
                    else
                      ..._blockedBy.map((dep) {
                        final depId = dep['id'] ?? dep['dependency_id'];
                        final title = dep['title'] ??
                            dep['depends_on_assignment_id'] ??
                            depId ??
                            'Dependency';
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            tileColor: AppColors.bgSurface,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: AppColors.border),
                            ),
                            title: Text(title.toString(),
                                style: const TextStyle(
                                    color: AppColors.textPrimary)),
                            trailing: IconButton(
                              onPressed: _acting || depId == null
                                  ? null
                                  : () => _removeDependency(
                                      depId is int
                                          ? depId
                                          : int.parse(depId.toString())),
                              icon: const Icon(Icons.close,
                                  color: AppColors.textMuted),
                            ),
                          ),
                        );
                      }),
                    TextField(
                      controller: _dependsOn,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        labelText: 'Depends on assignment ID',
                      ),
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: _acting ? null : _addDependency,
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.bgSurface),
                      child: const Text('Add dependency',
                          style: TextStyle(color: AppColors.textPrimary)),
                    ),
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
