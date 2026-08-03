import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/cache/cache_provider.dart';
import '../../../../../core/cache/cache_service.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';
import '../../../../../shared/widgets/stitch_card.dart';
import '../../../../../shared/widgets/stitch_screen.dart';
import '../../data/procurement_api_helpers.dart';

/// Procurement home: list/create entry + browse links (tenders, notices, vendors).
class ProcurementHubScreen extends ConsumerStatefulWidget {
  const ProcurementHubScreen({super.key});

  @override
  ConsumerState<ProcurementHubScreen> createState() =>
      _ProcurementHubScreenState();
}

class _ProcurementHubScreenState extends ConsumerState<ProcurementHubScreen> {
  bool _loading = true;
  String? _error;
  String _statusFilter = 'all';
  List<Map<String, dynamic>> _requests = [];

  static const _filters = <(String, String?)>[
    ('all', null),
    ('draft', 'draft'),
    ('submitted', 'submitted'),
    ('hod_approved', 'hod_approved'),
    ('budget_reserved', 'budget_reserved'),
    ('rfq_issued', 'rfq_issued'),
    ('awarded', 'awarded'),
    ('rejected', 'rejected'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool backgroundRefresh = false}) async {
    final cache = ref.read(cacheServiceProvider);
    final dio = ref.read(apiClientProvider).dio;

    if (!backgroundRefresh && _statusFilter == 'all') {
      final cached =
          await cache.get<List<dynamic>>(CacheKeys.procurementRequests);
      if (cached != null) {
        if (!mounted) return;
        setState(() {
          _requests =
              cached.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _loading = false;
          _error = null;
        });
        _load(backgroundRefresh: true);
        return;
      }
      setState(() {
        _loading = true;
        _error = null;
      });
    } else if (!backgroundRefresh) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final query = <String, dynamic>{'per_page': 100};
      final status = _filters
          .firstWhere((f) => f.$1 == _statusFilter, orElse: () => ('all', null))
          .$2;
      if (status != null) query['status'] = status;

      final res = await dio.get<Map<String, dynamic>>(
        '/procurement/requests',
        queryParameters: query,
      );
      final list = extractListData(res.data);
      if (status == null) {
        await cache.set(
          CacheKeys.procurementRequests,
          list,
          ttl: const Duration(minutes: 5),
        );
      }
      if (!mounted) return;
      setState(() {
        _requests = list;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted || backgroundRefresh) return;
      setState(() {
        _loading = false;
        _error = e.toString().contains('SocketException') ||
                e.toString().contains('Connection')
            ? 'Cannot reach server. Check your connection.'
            : 'Failed to load procurement requests.';
      });
    }
  }

  Future<void> _onFilter(String key) async {
    if (_statusFilter == key) return;
    setState(() => _statusFilter = key);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Procurement',
      fallbackRoute: '/dashboard',
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/procurement/form').then((_) => _load()),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.bgDark,
        icon: const Icon(Icons.add),
        label: const Text('New Requisition',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      actions: [
        StitchIconAction(
          tooltip: 'Refresh',
          icon: Icons.refresh,
          onPressed: _loading ? null : _load,
        ),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _QuickLinks(
            onVendors: () => context.push('/procurement/vendors'),
            onTenders: () => context.push('/procurement/tenders'),
            onNotices: () => context.push('/procurement/notices'),
          ),
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final key = _filters[i].$1;
                final selected = _statusFilter == key;
                return ChoiceChip(
                  label: Text(_filterLabel(key)),
                  selected: selected,
                  onSelected: (_) => _onFilter(key),
                  selectedColor: AppColors.primary.withValues(alpha: 0.2),
                  labelStyle: TextStyle(
                    color: selected
                        ? AppColors.primaryDark
                        : AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  side: BorderSide(
                    color: selected ? AppColors.primary : AppColors.border,
                  ),
                  backgroundColor: AppColors.bgSurface,
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const StitchLoadingState(
                    label: 'Loading procurement requests')
                : _error != null
                    ? StitchErrorState(message: _error!, onRetry: _load)
                    : RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: _load,
                        child: _requests.isEmpty
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: const [
                                  SizedBox(height: 80),
                                  StitchEmptyState(
                                    icon: Icons.receipt_long_outlined,
                                    title: 'No procurement requests yet',
                                    message:
                                        'New requisitions will appear here.',
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 8, 16, 100),
                                itemCount: _requests.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (context, i) {
                                  final r = _requests[i];
                                  return _RequestTile(
                                    request: r,
                                    onTap: () => context
                                        .push(
                                            '/procurement/detail?id=${r['id']}')
                                        .then((_) => _load()),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }

  String _filterLabel(String key) {
    switch (key) {
      case 'all':
        return 'All';
      case 'hod_approved':
        return 'HOD Approved';
      case 'budget_reserved':
        return 'Budget Reserved';
      case 'rfq_issued':
        return 'RFQ Issued';
      default:
        return key[0].toUpperCase() + key.substring(1).replaceAll('_', ' ');
    }
  }
}

class _QuickLinks extends StatelessWidget {
  const _QuickLinks({
    required this.onVendors,
    required this.onTenders,
    required this.onNotices,
  });

  final VoidCallback onVendors;
  final VoidCallback onTenders;
  final VoidCallback onNotices;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Row(
        children: [
          Expanded(
              child: _LinkChip(
                  icon: Icons.storefront_outlined,
                  label: 'Vendors',
                  onTap: onVendors)),
          const SizedBox(width: 8),
          Expanded(
              child: _LinkChip(
                  icon: Icons.gavel_outlined,
                  label: 'Tenders',
                  onTap: onTenders)),
          const SizedBox(width: 8),
          Expanded(
              child: _LinkChip(
                  icon: Icons.campaign_outlined,
                  label: 'Notices',
                  onTap: onNotices)),
        ],
      ),
    );
  }
}

class _LinkChip extends StatelessWidget {
  const _LinkChip(
      {required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return StitchCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        children: [
          Icon(icon, size: 18, color: AppColors.primaryDark),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request, required this.onTap});
  final Map<String, dynamic> request;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = (request['status'] as String? ?? 'draft').toLowerCase();
    final cfg = procurementStatusConfig(status);
    final currency = request['currency'] as String? ?? 'NAD';
    final value = (request['estimated_value'] as num?)?.toDouble();
    final refNo = request['reference_number'] as String? ?? '';
    final title = request['title'] as String? ?? 'Untitled';
    final budgetLine = request['budget_line'] as String?;
    final submitted = request['submitted_at'] as String?;

    return StitchCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(refNo.isEmpty ? 'Draft' : refNo,
                    style: const TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: cfg.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(cfg.label,
                    style: TextStyle(
                        color: cfg.color,
                        fontSize: 10,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(title,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Row(
            children: [
              if (budgetLine != null && budgetLine.isNotEmpty) ...[
                const Icon(Icons.account_balance_outlined,
                    size: 12, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(budgetLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11)),
                ),
              ] else
                const Spacer(),
              if (value != null && value > 0)
                Text('$currency ${value.toStringAsFixed(2)}',
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
            ],
          ),
          if (submitted != null) ...[
            const SizedBox(height: 4),
            Text('Submitted ${AppDateFormatter.short(submitted)}',
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 10)),
          ],
        ],
      ),
    );
  }
}
