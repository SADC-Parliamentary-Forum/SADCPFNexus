import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class FleetVehicleDetailScreen extends ConsumerStatefulWidget {
  const FleetVehicleDetailScreen({super.key, required this.vehicleId});
  final int vehicleId;

  @override
  ConsumerState<FleetVehicleDetailScreen> createState() =>
      _FleetVehicleDetailScreenState();
}

class _FleetVehicleDetailScreenState
    extends ConsumerState<FleetVehicleDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _vehicle;

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
      final res = await dio.get('/fleet/vehicles/${widget.vehicleId}');
      if (!mounted) return;
      setState(() {
        _vehicle = extractObjectData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load vehicle.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = _vehicle;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text('Vehicle',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null || v == null
              ? Center(
                  child: Text(_error ?? 'Not found',
                      style: const TextStyle(color: AppColors.textSecondary)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(v['name']?.toString() ?? v['asset_tag']?.toString() ?? '',
                        style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text('Status: ${v['status'] ?? '—'}',
                        style: const TextStyle(color: AppColors.textMuted)),
                    const SizedBox(height: 16),
                    _panel(
                      'GPS (read-only)',
                      v['gps_lat'] != null && v['gps_lng'] != null
                          ? 'Lat ${v['gps_lat']}, Lng ${v['gps_lng']}\nRecorded: ${v['gps_recorded_at'] ?? '—'}'
                          : 'No last-known GPS on record.',
                    ),
                    const SizedBox(height: 12),
                    _panel(
                      'Telematics (read-only)',
                      'Device: ${v['telematics_device_id'] ?? 'unmapped'}\n'
                      'Provider: ${v['telematics_provider'] ?? '—'}\n'
                      'Sync: ${v['telematics_sync_status'] ?? '—'}\n'
                      'Synced at: ${v['telematics_synced_at'] ?? '—'}\n'
                      '${v['telematics_sync_error'] != null ? 'Error: ${v['telematics_sync_error']}' : ''}',
                    ),
                  ],
                ),
    );
  }

  Widget _panel(String title, String body) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: AppColors.textPrimary, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(body.trim(),
              style: const TextStyle(
                  color: AppColors.textSecondary, height: 1.4, fontSize: 13)),
        ],
      ),
    );
  }
}
