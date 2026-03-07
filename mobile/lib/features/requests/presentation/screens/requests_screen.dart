import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

// Status config
const _statusColors = {
  'approved':   AppColors.success,
  'submitted':  AppColors.warning,
  'rejected':   AppColors.danger,
  'draft':      AppColors.textMuted,
  'liquidated': AppColors.info,
  'cancelled':  AppColors.textMuted,
};
const _statusLabels = {
  'approved':   'Approved',
  'submitted':  'Pending',
  'rejected':   'Rejected',
  'draft':      'Draft',
  'liquidated': 'Liquidated',
  'cancelled':  'Cancelled',
};

class _Tab {
  final String label;
  final IconData icon;
  final String endpoint;
  final String descKey;
  final Color color;
  const _Tab({required this.label, required this.icon, required this.endpoint, required this.descKey, required this.color});
}

const _tabs = [
  _Tab(label: 'Travel',  icon: Icons.flight_takeoff,         endpoint: '/travel/requests',  descKey: 'purpose', color: AppColors.primary),
  _Tab(label: 'Leave',   icon: Icons.event_available,        endpoint: '/leave/requests',   descKey: 'reason',  color: AppColors.success),
  _Tab(label: 'Imprest', icon: Icons.account_balance_wallet, endpoint: '/imprest/requests', descKey: 'purpose', color: AppColors.warning),
];

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  bool _loading = true;
  String? _error;
  final List<List<Map<String, dynamic>>> _data = [[], [], []];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait<List<Map<String, dynamic>>>(
        _tabs.map((t) => dio.get<Map<String, dynamic>>(t.endpoint)
          .then((r) => (r.data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [])),
      );
      if (!mounted) return;
      setState(() {
        for (var i = 0; i < results.length; i++) {
          _data[i] = results[i];
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().contains('SocketException') || e.toString().contains('Connection')
            ? 'Cannot reach server. Check your connection.'
            : 'Failed to load requests.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      floatingActionButton: _NewRequestFab(
        onTravelTap: () => context.push('/requests/travel/new').then((_) => _load()),
        onLeaveTap:  () => context.push('/requests/leave/new').then((_) => _load()),
        onImprestTap: () => context.push('/imprest/form').then((_) => _load()),
      ),
      body: SafeArea(
        child: NestedScrollView(
          headerSliverBuilder: (context, innerBoxIsScrolled) => [
            SliverAppBar(
              pinned: true,
              floating: true,
              backgroundColor: AppColors.bgDark,
              elevation: 0,
              automaticallyImplyLeading: false,
              toolbarHeight: 60,
              flexibleSpace: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('My Requests',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary)),
                          Text('All your submitted requests',
                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    Container(
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.bgSurface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: IconButton(
                        padding: EdgeInsets.zero,
                        icon: const Icon(Icons.refresh, size: 18, color: AppColors.textSecondary),
                        onPressed: _loading ? null : _load,
                      ),
                    ),
                  ],
                ),
              ),
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(48),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: AppColors.border.withValues(alpha:0.5))),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    indicatorColor: AppColors.primary,
                    indicatorWeight: 2,
                    labelColor: AppColors.primary,
                    unselectedLabelColor: AppColors.textSecondary,
                    labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                    unselectedLabelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                    tabs: _tabs.asMap().entries.map((entry) {
                      final i = entry.key;
                      final t = entry.value;
                      final count = _data[i].length;
                      return Tab(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(t.icon, size: 14),
                            const SizedBox(width: 6),
                            Text(t.label),
                            if (!_loading && count > 0) ...[
                              const SizedBox(width: 5),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha:0.2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text('$count',
                                  style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.primary)),
                              ),
                            ],
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ),
          ],
          body: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _error != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 64, height: 64,
                              decoration: BoxDecoration(
                                color: AppColors.bgSurface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: const Icon(Icons.cloud_off_outlined, color: AppColors.textMuted, size: 32),
                            ),
                            const SizedBox(height: 16),
                            Text(_error!, textAlign: TextAlign.center,
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: _load,
                              icon: const Icon(Icons.refresh, size: 16),
                              label: const Text('Try Again'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: AppColors.bgDark,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : TabBarView(
                      controller: _tabController,
                      children: _tabs.asMap().entries.map((entry) {
                        final i = entry.key;
                        final t = entry.value;
                        final items = _data[i];
                        return RefreshIndicator(
                          onRefresh: _load,
                          color: AppColors.primary,
                          child: items.isEmpty
                              ? ListView(
                                  children: [
                                    SizedBox(
                                      height: 300,
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Container(
                                            width: 64, height: 64,
                                            decoration: BoxDecoration(
                                              color: AppColors.bgSurface,
                                              borderRadius: BorderRadius.circular(16),
                                              border: Border.all(color: AppColors.border),
                                            ),
                                            child: Icon(t.icon, color: AppColors.textMuted, size: 28),
                                          ),
                                          const SizedBox(height: 16),
                                          Text('No ${t.label} requests yet',
                                            style: const TextStyle(color: AppColors.textPrimary,
                                              fontSize: 14, fontWeight: FontWeight.w600)),
                                          const SizedBox(height: 4),
                                          const Text('Your submitted requests will appear here.',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                                        ],
                                      ),
                                    ),
                                  ],
                                )
                              : ListView.builder(
                                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                                  itemCount: items.length,
                                  itemBuilder: (context, idx) {
                                    final item = items[idx];
                                    final ref = item['reference_number']?.toString() ?? '—';
                                    final desc = item[t.descKey]?.toString() ?? item['purpose']?.toString() ?? '—';
                                    final status = item['status']?.toString() ?? 'draft';
                                    final statusColor = _statusColors[status] ?? AppColors.textMuted;
                                    final statusLabel = _statusLabels[status] ?? status;
                                    final detailRoute = i == 0
                                        ? '/requests/travel/detail'
                                        : i == 1
                                            ? '/requests/leave/detail'
                                            : '/requests/imprest/detail';
                                    return GestureDetector(
                                      onTap: () => context.push(detailRoute),
                                      child: _RequestCard(
                                        ref: ref,
                                        desc: desc,
                                        status: statusLabel,
                                        statusColor: statusColor,
                                        icon: t.icon,
                                        iconColor: t.color,
                                        item: item,
                                      ),
                                    );
                                  },
                                ),
                        );
                      }).toList(),
                    ),
        ),
      ),
    );
  }
}

// ── FAB ────────────────────────────────────────────────────────
class _NewRequestFab extends StatelessWidget {
  final VoidCallback onTravelTap;
  final VoidCallback onLeaveTap;
  final VoidCallback onImprestTap;
  const _NewRequestFab({required this.onTravelTap, required this.onLeaveTap, required this.onImprestTap});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.extended(
      onPressed: () {
        showModalBottomSheet(
          context: context,
          backgroundColor: AppColors.bgSurface,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
          builder: (_) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 36, height: 4, margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(2))),
                const Text('New Request', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                _fabOption(context, Icons.flight_takeoff, 'Travel Request', 'Mission, conference, workshop', AppColors.primary, onTravelTap),
                const SizedBox(height: 10),
                _fabOption(context, Icons.event_available, 'Leave Request', 'Annual, sick, study or LIL', AppColors.success, onLeaveTap),
                const SizedBox(height: 10),
                _fabOption(context, Icons.account_balance_wallet, 'Imprest Request', 'Petty cash advance', AppColors.warning, onImprestTap),
                const SizedBox(height: 8),
              ]),
            ),
          ),
        );
      },
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      icon: const Icon(Icons.add, size: 20),
      label: const Text('New Request', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
    );
  }

  Widget _fabOption(BuildContext ctx, IconData icon, String title, String sub, Color color, VoidCallback onTap) =>
    GestureDetector(
      onTap: () { Navigator.pop(ctx); onTap(); },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withValues(alpha: 0.2))),
        child: Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
            Text(sub, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ])),
          Icon(Icons.chevron_right, color: color, size: 20),
        ]),
      ),
    );
}

class _RequestCard extends StatelessWidget {
  final String ref;
  final String desc;
  final String status;
  final Color statusColor;
  final IconData icon;
  final Color iconColor;
  final Map<String, dynamic> item;

  const _RequestCard({
    required this.ref,
    required this.desc,
    required this.status,
    required this.statusColor,
    required this.icon,
    required this.iconColor,
    required this.item,
  });

  @override
  Widget build(BuildContext context) {
    final submittedAt = item['submitted_at']?.toString() ?? item['created_at']?.toString();
    final dateStr = submittedAt != null && submittedAt.isNotEmpty
        ? AppDateFormatter.short(submittedAt)
        : '';
    final rangeStr = (item['departure_date'] != null || item['start_date'] != null)
        ? AppDateFormatter.range(
            item['departure_date']?.toString() ?? item['start_date']?.toString(),
            item['return_date']?.toString() ?? item['end_date']?.toString(),
          )
        : dateStr;
    final displayDate = rangeStr != '—' ? rangeStr : dateStr;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Icon
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha:0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(desc,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(ref,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontFamily: 'monospace',
                        ),
                      ),
                      if (displayDate.isNotEmpty && displayDate != '—') ...[
                        const Text('  ·  ', style: TextStyle(color: AppColors.border, fontSize: 11)),
                        Text(displayDate,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha:0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: statusColor.withValues(alpha:0.3)),
              ),
              child: Text(status,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: statusColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
