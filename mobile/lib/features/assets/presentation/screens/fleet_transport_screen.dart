import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

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
  List<Map<String, dynamic>> _assets = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
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
      final res = await dio.get<Map<String, dynamic>>(
        '/assets',
        queryParameters: {
          'per_page': 100,
          'category': 'Vehicle',
        },
      );
      final data = res.data?['data'] as List<dynamic>? ?? [];
      setState(() {
        _assets =
            data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _loading = false;
      });
    } catch (_) {
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

  String _statusLabel(String s) {
    switch (s.toLowerCase()) {
      case 'available':
        return 'Available';
      case 'assigned':
      case 'in_use':
        return 'In Use';
      case 'maintenance':
        return 'Service';
      case 'retired':
        return 'Retired';
      default:
        return s;
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
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: const TextStyle(
              fontSize: 12, fontWeight: FontWeight.w700),
          tabs: const [
            Tab(text: 'Fleet'),
            Tab(text: 'Bookings'),
            Tab(text: 'Logbook'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_fleetTab(), _comingSoonTab(), _comingSoonTab()],
      ),
    );
  }

  Widget _fleetTab() {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.danger, size: 40),
            const SizedBox(height: 12),
            Text(_error!,
                style:
                    const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            TextButton(
              onPressed: _load,
              child: const Text('Retry',
                  style: TextStyle(color: AppColors.primary)),
            ),
          ],
        ),
      );
    }
    if (_assets.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.directions_car_outlined,
                color: AppColors.textMuted, size: 48),
            SizedBox(height: 12),
            Text('No vehicles registered.',
                style: TextStyle(color: AppColors.textMuted)),
          ],
        ),
      );
    }

    final available = _assets
        .where((a) =>
            (a['status'] as String? ?? '').toLowerCase() == 'available')
        .length;
    final inUse = _assets
        .where((a) {
          final s = (a['status'] as String? ?? '').toLowerCase();
          return s == 'assigned' || s == 'in_use';
        })
        .length;
    final service = _assets
        .where((a) =>
            (a['status'] as String? ?? '').toLowerCase() == 'maintenance')
        .length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          _statChip('Available', '$available', AppColors.success),
          const SizedBox(width: 10),
          _statChip('In Use', '$inUse', AppColors.primary),
          const SizedBox(width: 10),
          _statChip('Service', '$service', AppColors.warning),
        ]),
        const SizedBox(height: 16),
        ..._assets.map((a) => _vehicleTile(a)),
      ],
    );
  }

  Widget _statChip(String label, String val, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(children: [
            Text(val,
                style: TextStyle(
                    color: color,
                    fontSize: 20,
                    fontWeight: FontWeight.w800)),
            Text(label,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 10)),
          ]),
        ),
      );

  Widget _vehicleTile(Map<String, dynamic> asset) {
    final name = asset['name'] as String? ?? '—';
    final tag = asset['asset_tag'] as String? ?? '—';
    final statusRaw = asset['status'] as String? ?? '';
    final statusLabel = _statusLabel(statusRaw);
    final statusColor = _statusColor(statusRaw);
    final location = asset['location'] as String?;
    final assignedUser = asset['assigned_user'] as Map<String, dynamic>?;
    final assignedName = assignedUser?['name'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.bgDark,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: const Icon(Icons.directions_car,
                  color: AppColors.textSecondary, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w700)),
                  Text(tag,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(statusLabel,
                  style: TextStyle(
                      color: statusColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w700)),
            ),
          ]),
          if (location != null && location.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.location_on_outlined,
                  color: AppColors.textMuted, size: 13),
              const SizedBox(width: 4),
              Text(location,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 11)),
            ]),
          ],
          if (assignedName != null) ...[
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.person_outline,
                  color: AppColors.primary, size: 13),
              const SizedBox(width: 4),
              Text('Assigned: $assignedName',
                  style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600)),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _comingSoonTab() => const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.construction_rounded,
                color: AppColors.textMuted, size: 48),
            SizedBox(height: 16),
            Text(
              'Coming Soon',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w700),
            ),
            SizedBox(height: 8),
            Text(
              'This feature is under development.',
              style: TextStyle(
                  color: AppColors.textMuted, fontSize: 13),
            ),
          ],
        ),
      );
}
