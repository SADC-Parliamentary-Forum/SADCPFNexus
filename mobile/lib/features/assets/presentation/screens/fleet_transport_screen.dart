import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

class FleetTransportScreen extends StatefulWidget {
  const FleetTransportScreen({super.key});
  @override
  State<FleetTransportScreen> createState() => _FleetTransportScreenState();
}

class _FleetTransportScreenState extends State<FleetTransportScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  final _fleet = [
    {'plate': 'SADC 055', 'model': 'Toyota Land Cruiser 300', 'status': 'Available', 'driver': 'Unassigned', 'fuel': 0.78, 'mileage': '45,230 km', 'icon': Icons.directions_car},
    {'plate': 'SADC 062', 'model': 'Toyota Hilux Double Cab', 'status': 'In Use', 'driver': 'James K.', 'fuel': 0.42, 'mileage': '62,100 km', 'icon': Icons.local_shipping},
    {'plate': 'SADC 071', 'model': 'Nissan Patrol', 'status': 'Service', 'driver': 'Unassigned', 'fuel': 0.15, 'mileage': '98,700 km', 'icon': Icons.directions_car},
    {'plate': 'SADC 083', 'model': 'Toyota Fortuner', 'status': 'Available', 'driver': 'Unassigned', 'fuel': 0.91, 'mileage': '22,500 km', 'icon': Icons.directions_car},
  ];

  final _bookings = [
    {'vehicle': 'SADC 055', 'purpose': 'Airport Transfer – SG', 'date': 'Today, 14:00', 'status': 'Confirmed'},
    {'vehicle': 'SADC 083', 'purpose': 'Inter-office Mission', 'date': 'Thu, 06 Mar', 'status': 'Pending'},
    {'vehicle': 'SADC 055', 'purpose': 'Parliament Session Pickup', 'date': 'Fri, 07 Mar', 'status': 'Confirmed'},
  ];

  final _logs = [
    {'vehicle': 'SADC 062', 'event': 'Fuel Refill – 80L', 'time': 'Today 09:15', 'icon': Icons.local_gas_station},
    {'vehicle': 'SADC 071', 'event': 'Service Check-In', 'time': 'Yesterday 16:30', 'icon': Icons.build_outlined},
    {'vehicle': 'SADC 055', 'event': 'Trip Completed', 'time': 'Yesterday 11:00', 'icon': Icons.check_circle_outline},
    {'vehicle': 'SADC 083', 'event': 'New Assignment', 'time': '03 Mar 08:00', 'icon': Icons.assignment_outlined},
  ];

  Color _statusColor(String s) {
    if (s == 'Available') return AppColors.success;
    if (s == 'In Use') return AppColors.primary;
    if (s == 'Service') return AppColors.warning;
    return AppColors.textMuted;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary), onPressed: () => Navigator.pop(context)),
        title: const Text('Fleet & Transport', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
        actions: [
          TextButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.add, color: AppColors.primary, size: 16),
            label: const Text('Book', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.primary,
          indicatorSize: TabBarIndicatorSize.label,
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          tabs: const [Tab(text: 'Fleet'), Tab(text: 'Bookings'), Tab(text: 'Logbook')],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_fleetTab(), _bookingsTab(), _logbookTab()],
      ),
    );
  }

  Widget _fleetTab() {
    final available = _fleet.where((v) => v['status'] == 'Available').length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(children: [
          _statChip('Available', '$available', AppColors.success),
          const SizedBox(width: 10),
          _statChip('In Use', '${_fleet.where((v) => v['status'] == 'In Use').length}', AppColors.primary),
          const SizedBox(width: 10),
          _statChip('Service', '${_fleet.where((v) => v['status'] == 'Service').length}', AppColors.warning),
        ]),
        const SizedBox(height: 16),
        ..._fleet.map((v) => _vehicleTile(v)),
      ],
    );
  }

  Widget _statChip(String label, String val, Color color) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: color.withValues(alpha: 0.3))),
      child: Column(children: [
        Text(val, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.w800)),
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
      ]),
    ),
  );

  Widget _vehicleTile(Map<String, dynamic> v) {
    final statusColor = _statusColor(v['status'] as String);
    final fuel = v['fuel'] as double;
    Color fuelColor = fuel > 0.5 ? AppColors.success : (fuel > 0.25 ? AppColors.warning : AppColors.danger);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 44, height: 44,
            decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
            child: Icon(v['icon'] as IconData, color: AppColors.textSecondary, size: 22)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(v['model'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            Text(v['plate'] as String, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
          Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(v['status'] as String, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          const Icon(Icons.local_gas_station, color: AppColors.textMuted, size: 14),
          const SizedBox(width: 6),
          Expanded(child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: fuel, minHeight: 4, backgroundColor: AppColors.bgDark, valueColor: AlwaysStoppedAnimation(fuelColor)),
          )),
          const SizedBox(width: 8),
          Text('${(fuel * 100).round()}%', style: TextStyle(color: fuelColor, fontSize: 11, fontWeight: FontWeight.w600)),
          const SizedBox(width: 14),
          const Icon(Icons.speed, color: AppColors.textMuted, size: 14),
          const SizedBox(width: 4),
          Text(v['mileage'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
        ]),
        if (v['driver'] != 'Unassigned') ...[
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.person_outline, color: AppColors.primary, size: 14),
            const SizedBox(width: 4),
            Text('Driver: ${v['driver']}', style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600)),
          ]),
        ],
      ]),
    );
  }

  Widget _bookingsTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Container(padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.primary.withValues(alpha: 0.25))),
        child: Row(children: [
          const Icon(Icons.directions_car, color: AppColors.primary, size: 20),
          const SizedBox(width: 10),
          const Expanded(child: Text('Book a vehicle for official travel. All bookings require supervisor approval.', style: TextStyle(color: AppColors.textSecondary, fontSize: 12))),
          GestureDetector(onTap: () {},
            child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(8)),
              child: const Text('Book Now', style: TextStyle(color: AppColors.bgDark, fontSize: 11, fontWeight: FontWeight.w700)))),
        ]),
      ),
      const SizedBox(height: 16),
      const Text('UPCOMING BOOKINGS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 10),
      ..._bookings.map((b) {
        final isPending = b['status'] == 'Pending';
        final statusColor = isPending ? AppColors.warning : AppColors.success;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
          child: Row(children: [
            Container(width: 8, height: 40, decoration: BoxDecoration(color: statusColor, borderRadius: BorderRadius.circular(4))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(b['purpose'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text('${b['vehicle']}  ·  ${b['date']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(b['status'] as String, style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700))),
          ]),
        );
      }),
    ],
  );

  Widget _logbookTab() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      const Text('RECENT ACTIVITY', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
      const SizedBox(height: 10),
      ..._logs.map((log) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(width: 36, height: 36,
            decoration: BoxDecoration(color: AppColors.bgDark, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
            child: Icon(log['icon'] as IconData, color: AppColors.primary, size: 18)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(log['event'] as String, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
            Text('${log['vehicle']}  ·  ${log['time']}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
        ]),
      )),
    ],
  );
}
