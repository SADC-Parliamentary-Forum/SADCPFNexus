import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../shared/widgets/searchable_list_filter.dart';
import '../../../../../shared/widgets/stitch_card.dart';
import '../../../../../shared/widgets/stitch_screen.dart';

class VendorDirectoryScreen extends ConsumerStatefulWidget {
  const VendorDirectoryScreen({super.key});

  @override
  ConsumerState<VendorDirectoryScreen> createState() =>
      _VendorDirectoryScreenState();
}

class _VendorDirectoryScreenState extends ConsumerState<VendorDirectoryScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _vendors = [];
  List<Map<String, dynamic>> _filtered = [];
  String _searchQuery = '';
  String _statusFilter = 'approved';

  @override
  void initState() {
    super.initState();
    _loadVendors();
  }

  Future<void> _loadVendors() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      // NOTE: `GET /procurement/vendors` (VendorController::index) does not
      // currently support `per_page`/`page` — it always returns the full,
      // unpaginated vendor collection via `->get()`. Adding pagination here
      // on the client would have no effect until the backend endpoint is
      // updated to paginate; that is a backend change, tracked separately
      // from this mobile UI/UX pass.
      final res = await dio.get<Map<String, dynamic>>(
        '/procurement/vendors',
        queryParameters: {'status': _statusFilter},
      );
      if (!mounted) return;
      final data = res.data?['data'] as List<dynamic>?;
      final list =
          (data ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      setState(() {
        _vendors = list;
        _loading = false;
      });
      _filter();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load vendors.';
        _loading = false;
      });
    }
  }

  void _filter() {
    setState(() {
      _filtered = _searchQuery.trim().isEmpty
          ? List.from(_vendors)
          : _vendors.where((v) {
              return matchesSearchText(
                v,
                _searchQuery,
                const ['name', 'category', 'country', 'contact_email'],
              );
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
    final canManage = session.roles.any((r) => [
          'Procurement Officer',
          'System Admin',
          'Secretary General',
          'super-admin'
        ].contains(r));

    return StitchScreen(
      title: 'Vendor Directory',
      fallbackRoute: '/procurement',
      actions: [
        StitchIconAction(
          tooltip: 'Refresh vendors',
          icon: Icons.refresh_rounded,
          onPressed: _loadVendors,
        ),
      ],
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.bgDark,
              icon: const Icon(Icons.add_business_rounded),
              label: const Text('Add Vendor',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              onPressed: () => context.push('/procurement/vendors/new'),
            )
          : null,
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: DebouncedSearchField(
              value: _searchQuery,
              hintText: 'Search vendors...',
              onChanged: (value) {
                _searchQuery = value;
                _filter();
              },
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
                  {'key': 'approved', 'label': 'Approved'},
                  {'key': 'pending', 'label': 'Pending'},
                  {'key': 'inactive', 'label': 'Inactive'},
                  {'key': 'blacklisted', 'label': 'Blacklisted'},
                  {'key': 'all', 'label': 'All'},
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
                        color: _statusFilter == f['key']
                            ? AppColors.primary
                            : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      side: BorderSide(
                        color: _statusFilter == f['key']
                            ? AppColors.primary
                            : Colors.transparent,
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
                ? const StitchLoadingState(label: 'Loading vendors')
                : _error != null
                    ? StitchErrorState(message: _error!, onRetry: _loadVendors)
                    : _filtered.isEmpty
                        ? const StitchEmptyState(
                            icon: Icons.storefront_outlined,
                            title: 'No vendors found',
                            message: 'Try adjusting your search or filter.',
                          )
                        : RefreshIndicator(
                            color: AppColors.primary,
                            backgroundColor: AppColors.bgSurface,
                            onRefresh: _loadVendors,
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 8, 16, 100),
                              itemCount: _filtered.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 10),
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

    return StitchCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                            color: statusColor,
                            fontSize: 10,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (category != null) ...[
                      const Icon(Icons.category_outlined,
                          size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 3),
                      Text(category,
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 11)),
                      const SizedBox(width: 8),
                    ],
                    if (country != null) ...[
                      const Icon(Icons.public_outlined,
                          size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 3),
                      Text(country,
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 11)),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    if (isSme)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        margin: const EdgeInsets.only(right: 6),
                        decoration: BoxDecoration(
                          color: AppColors.info.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('SME',
                            style: TextStyle(
                                color: AppColors.info,
                                fontSize: 10,
                                fontWeight: FontWeight.w700)),
                      ),
                    const Icon(Icons.request_quote_outlined,
                        size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 3),
                    Text('$quotesCount quotes',
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 11)),
                    if (avg != null) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.star_rounded,
                          size: 13, color: Color(0xFFFBBC04)),
                      const SizedBox(width: 2),
                      Text(avg.toStringAsFixed(1),
                          style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded,
              color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}
