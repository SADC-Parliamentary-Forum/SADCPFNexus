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
}
