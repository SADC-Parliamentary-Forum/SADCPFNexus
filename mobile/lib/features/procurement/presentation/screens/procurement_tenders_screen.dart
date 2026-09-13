import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';
import '../../../../../shared/widgets/stitch_screen.dart';
import '../../data/procurement_api_helpers.dart';

class ProcurementTendersScreen extends ConsumerStatefulWidget {
  const ProcurementTendersScreen({super.key});

  @override
  ConsumerState<ProcurementTendersScreen> createState() =>
      _ProcurementTendersScreenState();
}

class _ProcurementTendersScreenState
    extends ConsumerState<ProcurementTendersScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _tenders = [];

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
      final res =
          await dio.get<Map<String, dynamic>>('/procurement/tenders');
      if (!mounted) return;
      setState(() {
        _tenders = extractListData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load tenders.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return StitchScreen(
      title: 'Tenders',
      fallbackRoute: '/procurement',
      actions: [
        StitchIconAction(
          tooltip: 'Refresh',
          icon: Icons.refresh,
          onPressed: _load,
        ),
      ],
      body: _loading
          ? const StitchLoadingState(label: 'Loading tenders')
          : _error != null
              ? StitchErrorState(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: _tenders.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            StitchEmptyState(
                              icon: Icons.gavel_outlined,
                              title: 'No tenders yet',
                              message:
                                  'Browse is read-only — lifecycle actions stay on web.',
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _tenders.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, i) {
                            final t = _tenders[i];
                            final sealed = isTenderFinanciallySealed(t);
                            final status =
                                (t['status'] as String? ?? '').toLowerCase();
                            return Material(
                              color: AppColors.bgSurface,
                              borderRadius: BorderRadius.circular(14),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => context.push(
                                    '/procurement/tenders/${t['id']}'),
                                child: Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(14),
                                    border:
                                        Border.all(color: AppColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              t['reference_number']
                                                      as String? ??
                                                  '',
                                              style: const TextStyle(
                                                  color: AppColors.textMuted,
                                                  fontSize: 11,
                                                  fontWeight:
                                                      FontWeight.w600),
                                            ),
                                          ),
                                          Text(
                                            status.toUpperCase(),
                                            style: const TextStyle(
                                                color:
                                                    AppColors.textSecondary,
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        t['title'] as String? ?? '',
                                        style: const TextStyle(
                                            color: AppColors.textPrimary,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'Deadline: ${t['submission_deadline'] != null ? AppDateFormatter.short(t['submission_deadline'] as String) : '—'}'
                                        '${sealed ? '  ·  Financial envelope sealed' : ''}',
                                        style: const TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 11),
                                      ),
                                    ],
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
