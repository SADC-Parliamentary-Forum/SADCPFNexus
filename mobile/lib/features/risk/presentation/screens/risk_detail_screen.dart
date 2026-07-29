import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class RiskDetailScreen extends ConsumerStatefulWidget {
  const RiskDetailScreen({super.key, required this.riskId});
  final int riskId;

  @override
  ConsumerState<RiskDetailScreen> createState() => _RiskDetailScreenState();
}

class _RiskDetailScreenState extends ConsumerState<RiskDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _risk;

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
      final res = await dio.get('/risk/risks/${widget.riskId}');
      if (!mounted) return;
      setState(() {
        _risk = extractObjectData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load risk.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _risk;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text('Risk detail',
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
                    Text(r['title']?.toString() ?? r['name']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text('Status: ${r['status'] ?? '—'}',
                        style: const TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 8),
                    Text(
                      'Inherent: ${r['inherent_rating'] ?? r['inherent_score'] ?? '—'} · '
                      'Residual: ${r['residual_rating'] ?? r['residual_score'] ?? '—'}',
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 16),
                    Text(r['description']?.toString() ?? r['risk_description']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary, height: 1.4)),
                    if (r['owner'] != null || r['owner_name'] != null) ...[
                      const SizedBox(height: 16),
                      Text('Owner: ${r['owner_name'] ?? r['owner']}',
                          style: const TextStyle(color: AppColors.textMuted)),
                    ],
                  ],
                ),
    );
  }
}
