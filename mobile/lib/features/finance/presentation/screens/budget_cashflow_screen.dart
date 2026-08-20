import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

/// Read-only budget cashflow / availability depth.
class BudgetCashflowScreen extends ConsumerStatefulWidget {
  const BudgetCashflowScreen({super.key});

  @override
  ConsumerState<BudgetCashflowScreen> createState() =>
      _BudgetCashflowScreenState();
}

class _BudgetCashflowScreenState extends ConsumerState<BudgetCashflowScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _forecast;
  Map<String, dynamic>? _availability;

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
      final results = await Future.wait([
        dio.get('/budget/cashflow/forecast'),
        dio.get('/finance/budgets', queryParameters: {'per_page': 20}),
      ]);
      if (!mounted) return;
      setState(() {
        _forecast = extractObjectData(results[0].data) ??
            (results[0].data is Map
                ? Map<String, dynamic>.from(results[0].data as Map)
                : null);
        _availability = extractObjectData(results[1].data) ??
            {'items': extractListData(results[1].data)};
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load budget views (read-only).';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final budgets = extractListData(
        _availability?['items'] ?? _availability?['data'] ?? _availability);
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('Budget (read-only)',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Text(_error!,
                      style: const TextStyle(color: AppColors.textSecondary)))
              : RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      const Text('Cashflow forecast',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.bgSurface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          _forecast == null
                              ? 'No forecast payload.'
                              : 'Horizon: ${_forecast!['horizon'] ?? _forecast!['period'] ?? '—'}\n'
                                  'Opening: ${_forecast!['opening_balance'] ?? _forecast!['opening'] ?? '—'}\n'
                                  'Closing: ${_forecast!['closing_balance'] ?? _forecast!['closing'] ?? '—'}',
                          style: const TextStyle(
                              color: AppColors.textSecondary, height: 1.4),
                        ),
                      ),
                      if (_periodBars().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        const Text('Closing balance by period',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 12)),
                        const SizedBox(height: 8),
                        SizedBox(
                          key: const Key('cashflow-period-chart'),
                          height: 140,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: _periodBars().map((bar) {
                              return Expanded(
                                child: Padding(
                                  padding:
                                      const EdgeInsets.symmetric(horizontal: 2),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      Expanded(
                                        child: Align(
                                          alignment: Alignment.bottomCenter,
                                          child: FractionallySizedBox(
                                            heightFactor: bar.height,
                                            widthFactor: 1,
                                            child: DecoratedBox(
                                              decoration: BoxDecoration(
                                                color: bar.negative
                                                    ? AppColors.danger
                                                    : AppColors.success,
                                                borderRadius:
                                                    const BorderRadius.vertical(
                                                        top: Radius.circular(4)),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        bar.label,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 9),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      const Text('Budget availability',
                          style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      if (budgets.isEmpty)
                        const Text('No budget lines returned.',
                            style: TextStyle(color: AppColors.textMuted))
                      else
                        ...budgets.take(30).map((b) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: ListTile(
                                tileColor: AppColors.bgSurface,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side:
                                      const BorderSide(color: AppColors.border),
                                ),
                                title: Text(
                                  b['name']?.toString() ??
                                      b['title']?.toString() ??
                                      b['code']?.toString() ??
                                      'Budget',
                                  style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  'Available: ${b['available'] ?? b['remaining'] ?? b['amount'] ?? '—'}',
                                  style: const TextStyle(
                                      color: AppColors.textMuted, fontSize: 12),
                                ),
                              ),
                            )),
                    ],
                  ),
                ),
    );
  }

  List<_PeriodBar> _periodBars() {
    final raw = _forecast?['periods'];
    if (raw is! List) return const [];
    final periods = raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    if (periods.isEmpty) return const [];
    final max = periods.fold<double>(0, (acc, p) {
      final v = (p['closing_balance'] as num?)?.abs().toDouble() ?? 0;
      return v > acc ? v : acc;
    });
    final denom = max <= 0 ? 1.0 : max;
    return periods.map((p) {
      final closing = (p['closing_balance'] as num?)?.toDouble() ?? 0;
      final period = p['period']?.toString() ?? '';
      return _PeriodBar(
        label: period.length > 7 ? period.substring(5) : period,
        height: (closing.abs() / denom).clamp(0.04, 1.0),
        negative: closing < 0,
      );
    }).toList();
  }
}

class _PeriodBar {
  const _PeriodBar({
    required this.label,
    required this.height,
    required this.negative,
  });

  final String label;
  final double height;
  final bool negative;
}
