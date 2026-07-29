import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class WeeklySummariesScreen extends ConsumerStatefulWidget {
  const WeeklySummariesScreen({super.key});

  @override
  ConsumerState<WeeklySummariesScreen> createState() =>
      _WeeklySummariesScreenState();
}

class _WeeklySummariesScreenState extends ConsumerState<WeeklySummariesScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _dashboard;
  Map<String, dynamic>? _current;
  bool _creating = false;

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
      final results = await Future.wait([
        dio.get('/weekly-summaries/dashboard'),
        dio.get('/weekly-summaries/current'),
      ]);
      if (!mounted) return;
      setState(() {
        _dashboard = extractObjectData(results[0].data) ??
            (results[0].data is Map
                ? Map<String, dynamic>.from(results[0].data as Map)
                : null);
        _current = extractObjectData(results[1].data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load weekly summaries.';
        _loading = false;
      });
    }
  }

  Future<void> _createCurrent() async {
    setState(() => _creating = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.post('/weekly-summaries/');
      final created = extractObjectData(res.data);
      if (!mounted) return;
      final id = created?['id'];
      if (id != null) {
        context.push('/weekly-summaries/$id');
      } else {
        await _load();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create weekly summary.')),
        );
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reports = extractListData(_dashboard?['reports'] ??
        _dashboard?['recent'] ??
        _dashboard?['items'] ??
        _dashboard);
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('Weekly summaries',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _creating ? null : _createCurrent,
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(_creating ? 'Creating…' : 'Create',
            style: const TextStyle(color: Colors.white)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Text(_error!,
                      style: const TextStyle(color: AppColors.textSecondary)))
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 88),
                    children: [
                      if (_current != null)
                        ListTile(
                          tileColor: AppColors.bgSurface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: AppColors.primary),
                          ),
                          title: Text(
                            _current!['reference']?.toString() ??
                                'Current period',
                            style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            'Status: ${_current!['status'] ?? '—'}',
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 12),
                          ),
                          trailing: const Icon(Icons.chevron_right,
                              color: AppColors.textMuted),
                          onTap: _current!['id'] == null
                              ? null
                              : () => context
                                  .push('/weekly-summaries/${_current!['id']}'),
                        ),
                      const SizedBox(height: 16),
                      const Text('Recent',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (reports.isEmpty)
                        const Text('No reports listed.',
                            style: TextStyle(color: AppColors.textMuted))
                      else
                        ...reports.map((r) {
                          final id = r['id'];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              tileColor: AppColors.bgSurface,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                                side: const BorderSide(color: AppColors.border),
                              ),
                              title: Text(
                                r['reference']?.toString() ?? 'Report',
                                style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text('${r['status'] ?? '—'}',
                                  style: const TextStyle(
                                      color: AppColors.textMuted, fontSize: 12)),
                              onTap: id == null
                                  ? null
                                  : () =>
                                      context.push('/weekly-summaries/$id'),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}
