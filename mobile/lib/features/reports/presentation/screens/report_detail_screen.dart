import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';

class ReportDetailScreen extends ConsumerStatefulWidget {
  const ReportDetailScreen({
    super.key,
    required this.reportType,
    this.reportTitle,
  });

  final String reportType;
  final String? reportTitle;

  @override
  ConsumerState<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends ConsumerState<ReportDetailScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _endpoint {
    switch (widget.reportType) {
      case 'travel':
        return '/reports/travel';
      case 'leave':
        return '/reports/leave';
      case 'dsa':
        return '/reports/dsa';
      case 'assets':
        return '/reports/assets';
      case 'imprest':
        return '/imprest/requests';
      case 'procurement':
        return '/procurement';
      case 'finance':
        return '/finance/advances';
      case 'hr':
        return '/hr/timesheets';
      default:
        return '/reports/travel';
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        _endpoint,
        queryParameters: {'per_page': 50},
      );
      final data = res.data;
      if (!mounted) return;
      final list = (data != null && data['data'] is List)
          ? data['data'] as List<dynamic>
          : <dynamic>[];
      setState(() {
        _items = list
            .map(
              (e) => e is Map
                  ? Map<String, dynamic>.from(e)
                  : <String, dynamic>{},
            )
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load report data.';
        _loading = false;
      });
    }
  }

  String _itemTitle(Map<String, dynamic> item) {
    return item['reference_number']?.toString() ??
        item['reference']?.toString() ??
        item['asset_tag']?.toString() ??
        item['title']?.toString() ??
        item['name']?.toString() ??
        item['purpose']?.toString() ??
        item['reason']?.toString() ??
        '-';
  }

  /// Maps a report item to its module detail route, if one exists.
  String? _detailRoute(Map<String, dynamic> item) {
    final id = item['id'];
    if (id == null) return null;
    switch (widget.reportType) {
      case 'travel':
        return '/requests/travel/detail?id=$id';
      case 'leave':
        return '/requests/leave/detail?id=$id';
      case 'imprest':
        return '/requests/imprest/detail?id=$id';
      case 'procurement':
        return '/procurement/detail?id=$id';
      case 'finance':
        return '/salary/advances/$id';
      default:
        return null;
    }
  }

  void _openItem(Map<String, dynamic> item) {
    final route = _detailRoute(item);
    if (route != null) {
      context.push(route);
      return;
    }
    // No dedicated detail screen for this report type — show a summary sheet.
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _itemTitle(item),
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              ...item.entries
                  .where((e) => e.value != null && e.value.toString().isNotEmpty)
                  .map(
                    (e) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 120,
                            child: Text(
                              e.key.replaceAll('_', ' '),
                              style: const TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              e.value.toString(),
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }

  String _itemSubtitle(Map<String, dynamic> item) {
    final parts = <String>[];
    if (item['purpose'] != null) {
      parts.add(item['purpose'].toString());
    } else if (item['title'] != null) {
      parts.add(item['title'].toString());
    } else if (item['category'] != null) {
      parts.add(item['category'].toString());
    }

    final start =
        item['start_date'] ?? item['departure_date'] ?? item['created_at'];
    final end = item['end_date'] ?? item['return_date'];
    if (start != null) {
      final dateStr = (end != null && end != start)
          ? AppDateFormatter.range(start.toString(), end.toString())
          : AppDateFormatter.short(start.toString());
      parts.add(dateStr);
    }

    if (item['currency'] != null && item['amount'] != null) {
      parts.add('${item['currency']} ${item['amount']}');
    }

    if (item['status'] != null) {
      parts.add('Status: ${item['status']}');
    }

    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.reportTitle ?? 'Report';
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new,
            color: AppColors.textPrimary,
            size: 18,
          ),
          onPressed: () => context.pop(),
        ),
        title: Text(
          title,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.danger),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _items.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.inbox_outlined,
                            size: 48,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'No data for this report.',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: AppColors.primary,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: _items.length,
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              color: AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: () => _openItem(item),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        _itemTitle(item),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: AppColors.textPrimary,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      if (_itemSubtitle(item).isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          _itemSubtitle(item),
                                          style: const TextStyle(
                                            color: AppColors.textSecondary,
                                            fontSize: 12,
                                          ),
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
