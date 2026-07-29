import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

class FleetTransportScreen extends ConsumerStatefulWidget {
  const FleetTransportScreen({super.key});

  @override
  ConsumerState<FleetTransportScreen> createState() =>
      _FleetTransportScreenState();
}

class _FleetTransportScreenState extends ConsumerState<FleetTransportScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _bookings = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
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
        dio.get('/fleet/vehicles'),
        dio.get('/fleet/bookings'),
      ]);
      if (!mounted) return;
      setState(() {
        _vehicles = extractListData(results[0].data);
        _bookings = extractListData(results[1].data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load fleet data.';
        _loading = false;
      });
    }
  }

  Color _statusColor(String s) {
    switch (s.toLowerCase()) {
      case 'available':
        return AppColors.success;
      case 'assigned':
      case 'in_use':
        return AppColors.primary;
      case 'maintenance':
      case 'service':
        return AppColors.warning;
      case 'retired':
        return AppColors.danger;
      default:
        return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Fleet & Transport',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded,
                color: AppColors.textSecondary),
            onPressed: _load,
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          tabs: const [Tab(text: 'Fleet'), Tab(text: 'Bookings')],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!,
                          style:
                              const TextStyle(color: AppColors.textSecondary)),
                      TextButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabs,
                  children: [_fleetTab(), _bookingsTab()],
                ),
    );
  }

  Widget _fleetTab() {
    if (_vehicles.isEmpty) {
      return const Center(
          child: Text('No vehicles registered.',
              style: TextStyle(color: AppColors.textMuted)));
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _vehicles.length,
        itemBuilder: (context, i) {
          final v = _vehicles[i];
          final id = v['id'];
          final status = (v['status'] as String? ?? '').toLowerCase();
          final gpsLat = v['gps_lat'];
          final gpsLng = v['gps_lng'];
          final telematics = v['telematics_sync_status']?.toString() ??
              (v['telematics_device_id'] != null ? 'mapped' : 'none');
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              tileColor: AppColors.bgSurface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.border),
              ),
              title: Text(v['name']?.toString() ?? v['asset_tag']?.toString() ?? 'Vehicle',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700)),
              subtitle: Text(
                '${status.isEmpty ? '—' : status}'
                '${gpsLat != null && gpsLng != null ? ' · GPS $gpsLat, $gpsLng' : ' · GPS —'}'
                ' · telematics $telematics',
                style: TextStyle(
                    color: _statusColor(status), fontSize: 11),
              ),
              trailing: const Icon(Icons.chevron_right,
                  color: AppColors.textMuted),
              onTap: id == null ? null : () => context.push('/fleet/$id'),
            ),
          );
        },
      ),
    );
  }

  Widget _bookingsTab() {
    if (_bookings.isEmpty) {
      return const Center(
          child: Text('No bookings.',
              style: TextStyle(color: AppColors.textMuted)));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _bookings.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final b = _bookings[i];
        return ListTile(
          tileColor: AppColors.bgSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.border),
          ),
          title: Text(b['purpose']?.toString() ?? 'Booking',
              style: const TextStyle(
                  color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
          subtitle: Text(
            '${b['status'] ?? '—'} · ${b['starts_at'] ?? b['start_at'] ?? '—'}',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
        );
      },
    );
  }
}
