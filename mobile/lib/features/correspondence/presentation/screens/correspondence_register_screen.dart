import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class CorrespondenceRegisterScreen extends ConsumerStatefulWidget {
  const CorrespondenceRegisterScreen({super.key});

  @override
  ConsumerState<CorrespondenceRegisterScreen> createState() =>
      _CorrespondenceRegisterScreenState();
}

class _CorrespondenceRegisterScreenState
    extends ConsumerState<CorrespondenceRegisterScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _letters = [];

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
      final res = await dio.get('/correspondence/letters',
          queryParameters: {'per_page': 50});
      if (!mounted) return;
      setState(() {
        _letters = extractListData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load correspondence register.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('Correspondence',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Text(_error!,
                      style: const TextStyle(color: AppColors.textSecondary)))
              : _letters.isEmpty
                  ? const Center(
                      child: Text('No letters in register.',
                          style: TextStyle(color: AppColors.textMuted)))
                  : RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _letters.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final l = _letters[i];
                          final id = l['id'];
                          final hold = l['legal_hold'] == true;
                          return ListTile(
                            tileColor: AppColors.bgSurface,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                  color: hold
                                      ? AppColors.warning
                                      : AppColors.border),
                            ),
                            title: Text(
                              l['subject']?.toString() ??
                                  l['reference']?.toString() ??
                                  'Letter',
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              '${l['direction'] ?? l['status'] ?? '—'}'
                              '${hold ? ' · LEGAL HOLD' : ''}'
                              '${l['retention_policy'] != null ? ' · ${l['retention_policy']}' : ''}',
                              style: TextStyle(
                                  color: hold
                                      ? AppColors.warning
                                      : AppColors.textMuted,
                                  fontSize: 12,
                                  fontWeight: hold
                                      ? FontWeight.w700
                                      : FontWeight.w400),
                            ),
                            trailing: const Icon(Icons.chevron_right,
                                color: AppColors.textMuted),
                            onTap: id == null
                                ? null
                                : () => context.push('/correspondence/$id'),
                          );
                        },
                      ),
                    ),
    );
  }
}
