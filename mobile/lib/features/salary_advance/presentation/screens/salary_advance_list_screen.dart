import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';
import '../../data/salary_advance_helpers.dart';

/// Employee lists: [queue] = `mine` (applications) or `history`.
class SalaryAdvanceListScreen extends ConsumerStatefulWidget {
  const SalaryAdvanceListScreen({
    super.key,
    required this.queue,
    required this.title,
    this.subtitle,
    this.emptyHint,
  });

  final String queue;
  final String title;
  final String? subtitle;
  final String? emptyHint;

  @override
  ConsumerState<SalaryAdvanceListScreen> createState() =>
      _SalaryAdvanceListScreenState();
}

class _SalaryAdvanceListScreenState
    extends ConsumerState<SalaryAdvanceListScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = const [];
  int _page = 1;
  int _lastPage = 1;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _load(1);
  }

  Future<void> _load(int page, {bool append = false}) async {
    setState(() {
      if (append) {
        _loadingMore = true;
      } else {
        _loading = true;
        _error = null;
      }
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/finance/advances',
        queryParameters: {
          'per_page': 20,
          'page': page,
          'queue': widget.queue,
        },
      );
      if (!mounted) return;
      final payload = res.data;
      final items = extractSalaryAdvanceList(payload);
      final metaLast = payload == null
          ? 1
          : int.tryParse('${payload['last_page'] ?? 1}') ?? 1;
      setState(() {
        _items = append ? [..._items, ...items] : items;
        _page = page;
        _lastPage = metaLast;
        _loading = false;
        _loadingMore = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load salary advances.';
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.safePopOrGoHome(),
        ),
        title: Text(
          widget.title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.danger)),
                      TextButton(
                          onPressed: () => _load(1), child: const Text('Retry')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => _load(1),
                  color: AppColors.primary,
                  child: _items.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(24),
                          children: [
                            if (widget.subtitle != null) ...[
                              Text(widget.subtitle!,
                                  style: const TextStyle(
                                      fontSize: 13, color: Color(0xFF666666))),
                              const SizedBox(height: 24),
                            ],
                            Text(
                              widget.emptyHint ?? 'No advances found.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  fontSize: 14, color: Color(0xFF888888)),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                          itemCount:
                              _items.length + (_page < _lastPage ? 1 : 0),
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            if (index >= _items.length) {
                              return TextButton(
                                onPressed: _loadingMore
                                    ? null
                                    : () => _load(_page + 1, append: true),
                                child: Text(
                                    _loadingMore ? 'Loading…' : 'Load more'),
                              );
                            }
                            return _AdvanceTile(item: _items[index]);
                          },
                        ),
                ),
    );
  }
}

class _AdvanceTile extends StatelessWidget {
  const _AdvanceTile({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final status = salaryAdvanceStatusConfig(item['status']?.toString());
    final createdAt = item['created_at']?.toString();
    return InkWell(
      onTap: () => context.push('/salary/advances/${item['id']}'),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: status.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(status.icon, color: status.color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item['reference_number']?.toString() ?? 'Advance',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    item['purpose']?.toString() ??
                        (item['advance_type']?.toString() ?? '—')
                            .replaceAll('_', ' '),
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF666666)),
                  ),
                  if (createdAt != null) ...[
                    const SizedBox(height: 2),
                    Text(AppDateFormatter.short(createdAt),
                        style: const TextStyle(
                            fontSize: 11, color: Color(0xFFAAAAAA))),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatSaCurrency(item['amount'],
                      currency: item['currency']?.toString() ?? 'NAD'),
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: status.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(status.label,
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: status.color)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
