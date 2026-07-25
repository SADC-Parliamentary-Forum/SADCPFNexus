import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';
import '../../data/procurement_api_helpers.dart';

class ProcurementNoticesScreen extends ConsumerStatefulWidget {
  const ProcurementNoticesScreen({super.key});

  @override
  ConsumerState<ProcurementNoticesScreen> createState() =>
      _ProcurementNoticesScreenState();
}

class _ProcurementNoticesScreenState
    extends ConsumerState<ProcurementNoticesScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _notices = [];

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
          await dio.get<Map<String, dynamic>>('/procurement/notice-board');
      if (!mounted) return;
      setState(() {
        _notices = extractListData(res.data);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final forbidden = e.toString().contains('403');
      setState(() {
        _error = forbidden
            ? 'You do not have access to the staff notice board.'
            : 'Failed to load notices.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: const Text('Tender Notices',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(_error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: AppColors.textSecondary)),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _load,
                        style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary),
                        child: const Text('Retry',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: _notices.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: const [
                            SizedBox(height: 80),
                            Center(
                              child: Text('No published notices.',
                                  style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 14)),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _notices.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, i) {
                            final n = _notices[i];
                            final sealed = n['sealed_mode'] == true;
                            final notice = n['notice'] as String?;
                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.bgSurface,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              n['title'] as String? ?? '',
                                              style: const TextStyle(
                                                  color:
                                                      AppColors.textPrimary,
                                                  fontSize: 14,
                                                  fontWeight:
                                                      FontWeight.w700),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              n['reference_number']
                                                      as String? ??
                                                  '',
                                              style: const TextStyle(
                                                  color: AppColors.textMuted,
                                                  fontSize: 11,
                                                  fontFamily: 'monospace'),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        (n['status'] as String? ?? '')
                                            .toUpperCase(),
                                        style: const TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700),
                                      ),
                                    ],
                                  ),
                                  if (notice != null &&
                                      notice.isNotEmpty) ...[
                                    const SizedBox(height: 8),
                                    Text(notice,
                                        style: const TextStyle(
                                            color: AppColors.textSecondary,
                                            fontSize: 13)),
                                  ],
                                  const SizedBox(height: 8),
                                  Text(
                                    'Deadline: ${n['submission_deadline'] != null ? AppDateFormatter.short(n['submission_deadline'] as String) : '—'}'
                                    '  ·  Sealed: ${sealed ? 'Yes' : 'No'}',
                                    style: const TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 11),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
    );
  }
}
