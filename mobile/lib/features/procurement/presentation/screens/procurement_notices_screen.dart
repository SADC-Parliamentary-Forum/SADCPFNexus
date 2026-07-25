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
  Map<String, int> _tenderIdByRef = {};
  String _query = '';

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
      final notices = extractListData(res.data);

      // Public notice board omits IDs; map reference → tender id when allowed.
      final Map<String, int> byRef = {};
      try {
        final tendersRes =
            await dio.get<Map<String, dynamic>>('/procurement/tenders');
        for (final t in extractListData(tendersRes.data)) {
          final ref = t['reference_number'] as String?;
          final id = (t['id'] as num?)?.toInt();
          if (ref != null && id != null) byRef[ref] = id;
        }
      } catch (_) {
        // Tenders list may be forbidden; notices still usable read-only.
      }

      if (!mounted) return;
      setState(() {
        _notices = notices;
        _tenderIdByRef = byRef;
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

  List<Map<String, dynamic>> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _notices;
    return _notices.where((n) {
      final title = (n['title'] as String? ?? '').toLowerCase();
      final ref = (n['reference_number'] as String? ?? '').toLowerCase();
      final notice = (n['notice'] as String? ?? '').toLowerCase();
      return title.contains(q) || ref.contains(q) || notice.contains(q);
    }).toList();
  }

  String? _deadlineHint(Map<String, dynamic> n) {
    final raw = n['submission_deadline'] as String?;
    if (raw == null) return null;
    final deadline = DateTime.tryParse(raw);
    if (deadline == null) return null;
    final today = DateTime.now();
    final end = DateTime(deadline.year, deadline.month, deadline.day);
    final days = end.difference(DateTime(today.year, today.month, today.day)).inDays;
    if (days < 0) return 'Closed';
    if (days == 0) return 'Due today';
    if (days == 1) return 'Due tomorrow';
    if (days <= 7) return '$days days left';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
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
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _loading ? null : _load,
          ),
        ],
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
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                      child: TextField(
                        style: const TextStyle(
                            color: AppColors.textPrimary, fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'Search notices…',
                          hintStyle: const TextStyle(
                              color: AppColors.textMuted, fontSize: 13),
                          prefixIcon: const Icon(Icons.search,
                              color: AppColors.textMuted, size: 18),
                          filled: true,
                          fillColor: AppColors.bgSurface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                        ),
                        onChanged: (v) => setState(() => _query = v),
                      ),
                    ),
                    Expanded(
                      child: RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: _load,
                        child: filtered.isEmpty
                            ? ListView(
                                physics:
                                    const AlwaysScrollableScrollPhysics(),
                                children: [
                                  const SizedBox(height: 80),
                                  Center(
                                    child: Text(
                                      _notices.isEmpty
                                          ? 'No published notices.'
                                          : 'No notices match your search.',
                                      style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 14),
                                    ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.all(16),
                                itemCount: filtered.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (context, i) {
                                  final n = filtered[i];
                                  final sealed = n['sealed_mode'] == true;
                                  final notice = n['notice'] as String?;
                                  final ref =
                                      n['reference_number'] as String? ?? '';
                                  final tenderId = _tenderIdByRef[ref];
                                  final deadlineHint = _deadlineHint(n);
                                  return Material(
                                    color: AppColors.bgSurface,
                                    borderRadius: BorderRadius.circular(14),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(14),
                                      onTap: tenderId == null
                                          ? null
                                          : () => context.push(
                                              '/procurement/tenders/$tenderId'),
                                      child: Container(
                                        padding: const EdgeInsets.all(14),
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(14),
                                          border: Border.all(
                                              color: AppColors.border),
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(
                                                        n['title']
                                                                as String? ??
                                                            '',
                                                        style: const TextStyle(
                                                            color: AppColors
                                                                .textPrimary,
                                                            fontSize: 14,
                                                            fontWeight:
                                                                FontWeight
                                                                    .w700),
                                                      ),
                                                      const SizedBox(
                                                          height: 2),
                                                      Text(
                                                        ref,
                                                        style: const TextStyle(
                                                            color: AppColors
                                                                .textMuted,
                                                            fontSize: 11,
                                                            fontFamily:
                                                                'monospace'),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.end,
                                                  children: [
                                                    Text(
                                                      (n['status']
                                                                  as String? ??
                                                              '')
                                                          .toUpperCase(),
                                                      style: const TextStyle(
                                                          color: AppColors
                                                              .textMuted,
                                                          fontSize: 10,
                                                          fontWeight:
                                                              FontWeight.w700),
                                                    ),
                                                    if (deadlineHint != null) ...[
                                                      const SizedBox(height: 4),
                                                      Text(
                                                        deadlineHint,
                                                        style: const TextStyle(
                                                            color: AppColors
                                                                .warning,
                                                            fontSize: 10,
                                                            fontWeight:
                                                                FontWeight.w700),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                              ],
                                            ),
                                            if (notice != null &&
                                                notice.isNotEmpty) ...[
                                              const SizedBox(height: 8),
                                              Text(notice,
                                                  maxLines: 4,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                      color: AppColors
                                                          .textSecondary,
                                                      fontSize: 13)),
                                            ],
                                            const SizedBox(height: 8),
                                            Wrap(
                                              spacing: 8,
                                              runSpacing: 6,
                                              children: [
                                                _MetaChip(
                                                  Icons.event_outlined,
                                                  'Deadline: ${n['submission_deadline'] != null ? AppDateFormatter.short(n['submission_deadline'] as String) : '—'}',
                                                ),
                                                if (n['published_at'] != null)
                                                  _MetaChip(
                                                    Icons.campaign_outlined,
                                                    'Published ${AppDateFormatter.short(n['published_at'] as String)}',
                                                  ),
                                                _MetaChip(
                                                  sealed
                                                      ? Icons.lock_outline
                                                      : Icons.lock_open_outlined,
                                                  sealed
                                                      ? 'Sealed bids'
                                                      : 'Open amounts',
                                                ),
                                                if (tenderId != null)
                                                  const _MetaChip(
                                                    Icons.arrow_forward,
                                                    'Open tender',
                                                  ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: AppColors.textMuted),
          const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
