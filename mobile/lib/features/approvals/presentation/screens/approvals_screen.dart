import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

const _typeConfig = {
  'Travel':  _TypeConfig(icon: Icons.flight_takeoff,         color: AppColors.primary,  bg: Color(0x1A1D85ED)),
  'Leave':   _TypeConfig(icon: Icons.event_available,        color: AppColors.success,  bg: Color(0x1A13EC80)),
  'Imprest': _TypeConfig(icon: Icons.account_balance_wallet, color: AppColors.warning,  bg: Color(0x1AD4AF37)),
};

class _TypeConfig {
  final IconData icon;
  final Color color;
  final Color bg;
  const _TypeConfig({required this.icon, required this.color, required this.bg});
}

class ApprovalsScreen extends ConsumerStatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  ConsumerState<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends ConsumerState<ApprovalsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _submitted = [];
  String _activeFilter = 'All';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        dio.get<Map<String, dynamic>>('/travel/requests',  queryParameters: {'status': 'submitted'}),
        dio.get<Map<String, dynamic>>('/leave/requests',   queryParameters: {'status': 'submitted'}),
        dio.get<Map<String, dynamic>>('/imprest/requests', queryParameters: {'status': 'submitted'}),
      ]);
      final t = (results[0].data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final l = (results[1].data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final i = (results[2].data?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (!mounted) return;
      setState(() {
        _submitted = [
          ...t.map((e) => {...e, 'type': 'Travel'}),
          ...l.map((e) => {...e, 'type': 'Leave'}),
          ...i.map((e) => {...e, 'type': 'Imprest'}),
        ];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().contains('SocketException') || e.toString().contains('Connection')
            ? 'Cannot reach server. Check your connection.'
            : 'Failed to load pending approvals.';
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filtered => _activeFilter == 'All'
      ? _submitted
      : _submitted.where((e) => e['type'] == _activeFilter).toList();

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Header
            SliverAppBar(
              pinned: true,
              floating: true,
              backgroundColor: AppColors.bgDark.withValues(alpha: 0.96),
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
                          Text('Pending Approvals',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary)),
                          Text('Review and action requests',
                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    // Count badge
                    if (!_loading && _submitted.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha:0.15),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.warning.withValues(alpha:0.3)),
                        ),
                        child: Text('${_submitted.length} pending',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                            color: AppColors.warning)),
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
                        icon: Icon(
                          _loading ? Icons.hourglass_top : Icons.refresh,
                          size: 18, color: AppColors.textSecondary),
                        onPressed: _loading ? null : _load,
                      ),
                    ),
                  ],
                ),
              ),
              // Filter chips
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(52),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: ['All', 'Travel', 'Leave', 'Imprest'].map((f) {
                        final isActive = _activeFilter == f;
                        int count = 0;
                        if (f == 'All') {
                          count = _submitted.length;
                        } else {
                          count = _submitted.where((e) => e['type'] == f).length;
                        }
                        return GestureDetector(
                          onTap: () => setState(() => _activeFilter = f),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: isActive ? AppColors.primary : AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isActive ? AppColors.primary : AppColors.border),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(f,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isActive ? AppColors.bgDark : AppColors.textSecondary,
                                  )),
                                if (!_loading && count > 0) ...[
                                  const SizedBox(width: 5),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: isActive
                                          ? AppColors.bgDark.withValues(alpha:0.2)
                                          : AppColors.primary.withValues(alpha:0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text('$count',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        color: isActive ? AppColors.bgDark : AppColors.primary,
                                      )),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),

            // Body
            if (_loading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
              )
            else if (_error != null)
              SliverFillRemaining(
                child: Center(
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
                          child: const Icon(Icons.cloud_off_outlined, color: AppColors.textMuted, size: 28),
                        ),
                        const SizedBox(height: 16),
                        Text(_error!, textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh, size: 16),
                          label: const Text('Retry'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: AppColors.bgDark,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (filtered.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 72, height: 72,
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(Icons.check_circle_outline,
                          color: AppColors.success, size: 36),
                      ),
                      const SizedBox(height: 16),
                      const Text('All caught up!',
                        style: TextStyle(color: AppColors.textPrimary,
                          fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text(
                        _activeFilter == 'All'
                          ? 'No pending approvals at this time.'
                          : 'No pending $_activeFilter approvals.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final e = filtered[index];
                      final type = e['type'] as String? ?? 'Travel';
                      final ref = e['reference_number']?.toString() ?? '—';
                      final desc = (e['purpose'] ?? e['reason'] ?? e['title'])?.toString() ?? '—';
                      final tc = _typeConfig[type] ?? _typeConfig['Travel']!;

                      // Date (friendly format)
                      final submittedAt = e['submitted_at']?.toString() ?? e['created_at']?.toString();
                      final dateStr = (submittedAt != null && submittedAt.isNotEmpty)
                          ? AppDateFormatter.short(submittedAt)
                          : '';

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
                                width: 44, height: 44,
                                decoration: BoxDecoration(
                                  color: tc.bg,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(tc.icon, color: tc.color, size: 22),
                              ),
                              const SizedBox(width: 12),
                              // Content
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: tc.color.withValues(alpha:0.1),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(type,
                                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800,
                                              color: tc.color, letterSpacing: 0.3)),
                                        ),
                                        if (dateStr.isNotEmpty) ...[
                                          const SizedBox(width: 6),
                                          Text(dateStr,
                                            style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(desc,
                                      style: const TextStyle(color: AppColors.textPrimary,
                                        fontSize: 13, fontWeight: FontWeight.w600),
                                      maxLines: 1, overflow: TextOverflow.ellipsis),
                                    const SizedBox(height: 2),
                                    Text(ref,
                                      style: const TextStyle(color: AppColors.textSecondary,
                                        fontSize: 11, fontFamily: 'monospace')),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Pending badge + chevron
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: AppColors.warning.withValues(alpha:0.12),
                                      borderRadius: BorderRadius.circular(7),
                                      border: Border.all(color: AppColors.warning.withValues(alpha:0.3)),
                                    ),
                                    child: const Text('Pending',
                                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                                        color: AppColors.warning)),
                                  ),
                                  const SizedBox(height: 8),
                                  const Icon(Icons.chevron_right,
                                    color: AppColors.textMuted, size: 18),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                    childCount: filtered.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
