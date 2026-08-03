import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';
import '../../../../shared/widgets/stitch_screen.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/finance/advances',
        queryParameters: {
          'per_page': 100,
          'queue': widget.queue,
        },
      );
      if (!mounted) return;
      setState(() {
        _items = extractSalaryAdvanceList(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load salary advances.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: widget.title,
      fallbackRoute: '/salary/advances',
      body: _loading
          ? const StitchLoadingState(label: 'Loading salary advances')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
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
                          itemCount: _items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) {
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
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF666666)),
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
