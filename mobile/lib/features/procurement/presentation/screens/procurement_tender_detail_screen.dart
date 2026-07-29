import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';
import '../../data/procurement_api_helpers.dart';

/// Browse-only tender detail. Does not publish/open/evaluate (web retains those).
/// Never shows sealed financial amounts.
class ProcurementTenderDetailScreen extends ConsumerStatefulWidget {
  const ProcurementTenderDetailScreen({super.key, required this.tenderId});
  final int tenderId;

  @override
  ConsumerState<ProcurementTenderDetailScreen> createState() =>
      _ProcurementTenderDetailScreenState();
}

class _ProcurementTenderDetailScreenState
    extends ConsumerState<ProcurementTenderDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _tender;
  Map<String, dynamic>? _comparison;
  bool _aiBusy = false;
  bool _aiConfirmed = false;

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
      final res = await dio
          .get<Map<String, dynamic>>('/procurement/tenders/${widget.tenderId}');
      if (!mounted) return;
      setState(() {
        _tender = extractObjectData(res.data);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load tender.';
        _loading = false;
      });
    }
  }

  Future<void> _runComparison() async {
    setState(() => _aiBusy = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.post(
          '/procurement/tenders/${widget.tenderId}/comparison-summary');
      if (!mounted) return;
      setState(() {
        _comparison = extractObjectData(res.data);
        _aiConfirmed = false;
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'AI comparison unavailable. Enable in settings or open bids first.')),
        );
      }
    } finally {
      if (mounted) setState(() => _aiBusy = false);
    }
  }

  Future<void> _confirmComparison() async {
    setState(() => _aiBusy = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post(
        '/procurement/tenders/${widget.tenderId}/comparison-summary/confirm',
        data: {
          'confirm': true,
          'summary_fingerprint':
              (_comparison?['summary']?.toString() ?? '').substring(
                  0,
                  ((_comparison?['summary']?.toString() ?? '').length)
                      .clamp(0, 64)),
        },
      );
      if (!mounted) return;
      setState(() => _aiConfirmed = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Human review confirmed. No award action taken.')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Confirm failed.')),
        );
      }
    } finally {
      if (mounted) setState(() => _aiBusy = false);
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
        title: const Text('Tender',
            style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null || _tender == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error ?? 'Tender not found.',
                          style: const TextStyle(
                              color: AppColors.textSecondary)),
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
                  child: _buildBody(_tender!),
                ),
    );
  }

  Widget _buildBody(Map<String, dynamic> t) {
    final sealed = isTenderFinanciallySealed(t);
    final notice = t['notice'] as String?;
    final status = (t['status'] as String? ?? '').toLowerCase();
    final techW = t['technical_weight'] ?? 80;
    final finW = t['financial_weight'] ?? 20;
    final minTech = t['min_technical_score'] ?? 70;
    final pr = t['procurement_request'] as Map<String, dynamic>?;
    final quotes = (pr?['quotes'] as List?)?.whereType<Map>().toList() ?? [];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(t['reference_number'] as String? ?? '',
                        style: const TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600)),
                  ),
                  Text(status.toUpperCase(),
                      style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 8),
              Text(t['title'] as String? ?? '',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w800)),
              if (notice != null && notice.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(notice,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 13)),
              ],
              const SizedBox(height: 12),
              Text(
                'Deadline: ${t['submission_deadline'] != null ? AppDateFormatter.short(t['submission_deadline'] as String) : '—'}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12),
              ),
              const SizedBox(height: 4),
              Text(
                'Two-envelope: technical $techW% / financial $finW% · Min technical $minTech'
                '${sealed ? ' · Financial envelope sealed' : ''}',
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 11),
              ),
              if (sealed) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.warning.withValues(alpha: 0.35)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.lock_outline,
                          color: AppColors.warning, size: 16),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Bid amounts stay hidden until bids are opened. Open/evaluate actions are available on web only.',
                          style: TextStyle(
                              color: AppColors.warning,
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (quotes.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sealed ? 'Submissions (${quotes.length})' : 'Opened quotes',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700),
                ),
                if (sealed) ...[
                  const SizedBox(height: 6),
                  const Text(
                    'Vendor names only — amounts remain sealed until open.',
                    style: TextStyle(
                        color: AppColors.warning,
                        fontSize: 11,
                        fontWeight: FontWeight.w600),
                  ),
                ],
                const SizedBox(height: 10),
                ...quotes.map((q) {
                  final map = Map<String, dynamic>.from(q);
                  final vendor = map['vendor'] as Map<String, dynamic>?;
                  final name =
                      vendor?['name'] as String? ??
                          map['vendor_name'] as String? ??
                          'Vendor';
                  final amount = quoteAmountForDisplay(map, requestSealed: sealed);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(name,
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13)),
                        ),
                        Text(
                          amount == null
                              ? 'Sealed'
                              : amount.toStringAsFixed(2),
                          style: TextStyle(
                              color: amount == null
                                  ? AppColors.warning
                                  : AppColors.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              fontStyle: amount == null
                                  ? FontStyle.italic
                                  : FontStyle.normal),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
        if (['opened', 'evaluating'].contains(status) && !sealed) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('AI comparison (assistive)',
                    style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                const Text(
                  'Never auto-awards. Human confirm is audit-only.',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ElevatedButton(
                      onPressed: _aiBusy ? null : _runComparison,
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary),
                      child: Text(_aiBusy ? 'Working…' : 'Generate',
                          style: const TextStyle(color: Colors.white)),
                    ),
                    ElevatedButton(
                      onPressed: _aiBusy ||
                              _comparison == null ||
                              _aiConfirmed
                          ? null
                          : _confirmComparison,
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.bgSurface),
                      child: Text(
                          _aiConfirmed ? 'Review confirmed' : 'Confirm review',
                          style:
                              const TextStyle(color: AppColors.textPrimary)),
                    ),
                  ],
                ),
                if (_comparison != null) ...[
                  const SizedBox(height: 12),
                  Text(_comparison!['summary']?.toString() ?? '',
                      style: const TextStyle(
                          color: AppColors.textSecondary, height: 1.35)),
                  const SizedBox(height: 8),
                  Text(_comparison!['disclaimer']?.toString() ?? '',
                      style: const TextStyle(
                          color: AppColors.textMuted, fontSize: 11)),
                ],
              ],
            ),
          ),
        ],
        if (pr != null) ...[
          const SizedBox(height: 12),
          TextButton(
            onPressed: () {
              final reqId = pr['id'];
              if (reqId != null) {
                context.push('/procurement/detail?id=$reqId');
              }
            },
            child: const Text('Open linked request',
                style: TextStyle(color: AppColors.primary)),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}
