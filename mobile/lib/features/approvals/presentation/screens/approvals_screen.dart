import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

class ApprovalsScreen extends ConsumerStatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  ConsumerState<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends ConsumerState<ApprovalsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _submitted = [];

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
      final travel = await dio.get<Map<String, dynamic>>('/travel/requests', queryParameters: {'status': 'submitted'});
      final leave = await dio.get<Map<String, dynamic>>('/leave/requests', queryParameters: {'status': 'submitted'});
      final imprest = await dio.get<Map<String, dynamic>>('/imprest/requests', queryParameters: {'status': 'submitted'});
      final t = (travel.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final l = (leave.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final i = (imprest.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final combined = <Map<String, dynamic>>[
        ...t.map((e) => {...e, 'type': 'Travel'}),
        ...l.map((e) => {...e, 'type': 'Leave'}),
        ...i.map((e) => {...e, 'type': 'Imprest'}),
      ];
      if (mounted) {
        setState(() {
          _submitted = combined;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().contains('SocketException') || e.toString().contains('Connection')
              ? 'Cannot reach server.'
              : 'Failed to load pending approvals.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pending Approvals'),
        backgroundColor: AppColors.bgSurface,
        foregroundColor: AppColors.textPrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      backgroundColor: AppColors.bgDark,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cloud_off, size: 48, color: AppColors.textSecondary),
                        const SizedBox(height: 16),
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
                        const SizedBox(height: 16),
                        TextButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh, size: 20),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _submitted.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 64, color: AppColors.textMuted),
                          SizedBox(height: 16),
                          Text('No pending approvals', style: TextStyle(color: AppColors.textSecondary, fontSize: 16)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _submitted.length,
                        itemBuilder: (context, index) {
                          final e = _submitted[index];
                          final type = e['type'] as String? ?? '—';
                          final ref = e['reference_number']?.toString() ?? '—';
                          final desc = (e['purpose'] ?? e['reason'] ?? e['title'])?.toString() ?? '—';
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            color: AppColors.bgSurface,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: AppColors.border),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                                child: Text(
                                  type[0],
                                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                                ),
                              ),
                              title: Text(desc, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Text('$type · $ref', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                              trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
