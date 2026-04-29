import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';

class VendorDirectoryScreen extends ConsumerStatefulWidget {
  const VendorDirectoryScreen({super.key});

  @override
  ConsumerState<VendorDirectoryScreen> createState() =>
      _VendorDirectoryScreenState();
}

class _VendorDirectoryScreenState
    extends ConsumerState<VendorDirectoryScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _vendors = [];
  List<Map<String, dynamic>> _filtered = [];
  final _searchCtrl = TextEditingController();
  String _statusFilter = 'approved';

  @override
  void initState() {
    super.initState();
    _loadVendors();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.removeListener(_filter);
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadVendors() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/procurement/vendors',
        queryParameters: {'status': _statusFilter},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      final list = (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {
        _vendors = list;
        _loading = false;
      });
      _filter();
    } catch (_) {
      if (!mounted) return;
      setState(() { _error = 'Failed to load vendors.'; _loading = false; });
    }
  }

  void _filter() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? List.from(_vendors)
          : _vendors.where((v) {
              return (v['name'] as String? ?? '').toLowerCase().contains(q) ||
                  (v['category'] as String? ?? '').toLowerCase().contains(q) ||
                  (v['country'] as String? ?? '').toLowerCase().contains(q) ||
                  (v['contact_email'] as String? ?? '').toLowerCase().contains(q);
            }).toList();
    });
  }

  Color _statusColor(Map<String, dynamic> v) {
    if (v['is_blacklisted'] == true) return AppColors.danger;
    if (v['is_approved'] == true) return AppColors.success;
    return AppColors.warning;
  }

  String _statusLabel(Map<String, dynamic> v) {
    if (v['is_blacklisted'] == true) return 'Blacklisted';
    if (v['is_approved'] == true) return 'Approved';
    if (v['is_active'] == false) return 'Inactive';
    return 'Pending';
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionControllerProvider).state;
    final canManage = session.roles.any((r) =>
        ['Procurement Officer', 'System Admin', 'Secretary General', 'super-admin'].contains(r));

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Vendor Directory',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary),
            onPressed: _loadVendors,
          ),
        ],
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgDark,
              icon: const Icon(Icons.add_business_rounded),
              label: const Text('Add Vendor', style: TextStyle(fontWeight: FontWeight.w700)),
              onPressed: () => context.push('/procurement/vendors/new'),
            )
          : null,
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search vendors…',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, color: AppColors.textMuted, size: 18),
                        onPressed: () { _searchCtrl.clear(); _filter(); },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.bgSurface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
              ),
            ),
          ),
          // Status filter chips
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              children: [
                for (final f in [
                  {'key': 'approved',    'label': 'Approved'},
                  {'key': 'pending',     'label': 'Pending'},
                  {'key': 'inactive',    'label': 'Inactive'},
                  {'key': 'blacklisted', 'label': 'Blacklisted'},
                  {'key': 'all',         'label': 'All'},
                ])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: FilterChip(
                      label: Text(f['label']!),
                      selected: _statusFilter == f['key'],
                      onSelected: (_) {
                        setState(() => _statusFilter = f['key']!);
                        _loadVendors();
                      },
                      backgroundColor: AppColors.bgSurface,
                      selectedColor: AppColors.primary.withValues(alpha: 0.18),
                      labelStyle: TextStyle(
                        color: _statusFilter == f['key'] ? AppColors.primary : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      side: BorderSide(
                        color: _statusFilter == f['key'] ? AppColors.primary : Colors.transparent,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                    ),
                  ),
              ],
            ),
          ),
          // Body
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _error != null
                    ? _ErrorState(message: _error!, onRetry: _loadVendors)
                    : _filtered.isEmpty
                        ? const _EmptyState()
                        : RefreshIndicator(
                            color: AppColors.primary,
                            backgroundColor: AppColors.bgSurface,
                            onRefresh: _loadVendors,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                              itemCount: _filtered.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (ctx, i) => _VendorCard(
                                vendor: _filtered[i],
                                statusColor: _statusColor(_filtered[i]),
                                statusLabel: _statusLabel(_filtered[i]),
                                onTap: () => context.push(
                                  '/procurement/vendors/${_filtered[i]['id']}',
                                ),
                              ),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _VendorCard extends StatelessWidget {
  final Map<String, dynamic> vendor;
  final Color statusColor;
  final String statusLabel;
  final VoidCallback onTap;

  const _VendorCard({
    required this.vendor,
    required this.statusColor,
    required this.statusLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = vendor['name'] as String? ?? 'Unknown';
    final category = vendor['category'] as String?;
    final country = vendor['country'] as String?;
    final isSme = vendor['is_sme'] == true;
    final avg = (vendor['ratings_avg_rating'] as num?)?.toDouble();
    final quotesCount = vendor['quotes_count'] as int? ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Avatar
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Text(
                name[0].toUpperCase(),
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          name,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      // Status badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          statusLabel,
                          style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (category != null) ...[
                        const Icon(Icons.category_outlined, size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 3),
                        Text(category, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                        const SizedBox(width: 8),
                      ],
                      if (country != null) ...[
                        const Icon(Icons.public_outlined, size: 12, color: AppColors.textMuted),
                        const SizedBox(width: 3),
                        Text(country, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (isSme)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          margin: const EdgeInsets.only(right: 6),
                          decoration: BoxDecoration(
                            color: AppColors.info.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('SME', style: TextStyle(color: AppColors.info, fontSize: 10, fontWeight: FontWeight.w700)),
                        ),
                      const Icon(Icons.request_quote_outlined, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 3),
                      Text('$quotesCount quotes', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      if (avg != null) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.star_rounded, size: 13, color: Color(0xFFFBBC04)),
                        const SizedBox(width: 2),
                        Text(avg.toStringAsFixed(1), style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.storefront_outlined, size: 52, color: AppColors.textMuted),
          SizedBox(height: 12),
          Text('No vendors found', style: TextStyle(color: AppColors.textSecondary, fontSize: 15, fontWeight: FontWeight.w600)),
          SizedBox(height: 4),
          Text('Try adjusting your search or filter', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline_rounded, size: 40, color: AppColors.danger),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.bgDark),
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w700)),
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}
