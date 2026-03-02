import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _travel = [];
  List<Map<String, dynamic>> _leave = [];
  List<Map<String, dynamic>> _imprest = [];

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
        dio.get<Map<String, dynamic>>('/travel/requests').then((r) => (r.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? []),
        dio.get<Map<String, dynamic>>('/leave/requests').then((r) => (r.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? []),
        dio.get<Map<String, dynamic>>('/imprest/requests').then((r) => (r.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? []),
      ]);
      if (mounted) {
        setState(() {
          _travel = results[0];
          _leave = results[1];
          _imprest = results[2];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().contains('SocketException') || e.toString().contains('Connection')
              ? 'Cannot reach server.'
              : 'Failed to load requests.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Requests'),
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
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _section('Travel', _travel, 'reference_number', 'purpose', 'status', Icons.flight_takeoff),
                      const SizedBox(height: 24),
                      _section('Leave', _leave, 'reference_number', 'reason', 'status', Icons.event_available),
                      const SizedBox(height: 24),
                      _section('Imprest', _imprest, 'reference_number', 'purpose', 'status', Icons.account_balance_wallet),
                    ],
                  ),
                ),
    );
  }

  Widget _section(String title, List<Map<String, dynamic>> items, String refKey, String descKey, String statusKey, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Text('No $title requests', style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
          )
        else
          ...items.map((e) {
            final ref = e[refKey]?.toString() ?? '—';
            final desc = e[descKey]?.toString() ?? '—';
            final status = e[statusKey]?.toString() ?? '—';
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              color: AppColors.bgSurface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border)),
              child: ListTile(
                leading: CircleAvatar(backgroundColor: AppColors.primary.withValues(alpha: 0.2), child: Icon(icon, color: AppColors.primary, size: 20)),
                title: Text(desc, style: const TextStyle(color: AppColors.textPrimary, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(ref, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.border.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(status, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                ),
              ),
            );
          }),
      ],
    );
  }
}
