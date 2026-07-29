import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class CorrespondenceDetailScreen extends ConsumerStatefulWidget {
  const CorrespondenceDetailScreen({super.key, required this.letterId});
  final int letterId;

  @override
  ConsumerState<CorrespondenceDetailScreen> createState() =>
      _CorrespondenceDetailScreenState();
}

class _CorrespondenceDetailScreenState
    extends ConsumerState<CorrespondenceDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _letter;

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
      final res =
          await dio.get('/correspondence/letters/${widget.letterId}');
      if (!mounted) return;
      setState(() {
        _letter = extractObjectData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load letter.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = _letter;
    final hold = l?['legal_hold'] == true;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text('Letter',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null || l == null
              ? Center(
                  child: Text(_error ?? 'Not found',
                      style: const TextStyle(color: AppColors.textSecondary)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(l['subject']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(
                      '${l['reference'] ?? l['reference_number'] ?? '—'} · ${l['status'] ?? '—'}',
                      style: const TextStyle(color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: hold
                            ? AppColors.warning.withValues(alpha: 0.12)
                            : AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: hold ? AppColors.warning : AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            hold
                                ? 'Legal hold active'
                                : 'Retention: ${l['retention_policy'] ?? 'default'}',
                            style: TextStyle(
                                color: hold
                                    ? AppColors.warning
                                    : AppColors.textPrimary,
                                fontWeight: FontWeight.w700),
                          ),
                          if (l['retain_until'] != null) ...[
                            const SizedBox(height: 4),
                            Text('Retain until: ${l['retain_until']}',
                                style: const TextStyle(
                                    color: AppColors.textMuted, fontSize: 12)),
                          ],
                          if (hold && l['legal_hold_reason'] != null) ...[
                            const SizedBox(height: 4),
                            Text('${l['legal_hold_reason']}',
                                style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12)),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(l['body']?.toString() ?? l['content']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary, height: 1.4)),
                  ],
                ),
    );
  }
}
