import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class FinanceCommandCenterScreen extends ConsumerStatefulWidget {
  const FinanceCommandCenterScreen({super.key});

  @override
  ConsumerState<FinanceCommandCenterScreen> createState() =>
      _FinanceCommandCenterScreenState();
}

class _FinanceCommandCenterScreenState
    extends ConsumerState<FinanceCommandCenterScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _summary = const {};
  List<Map<String, dynamic>> _advances = const [];
  List<Map<String, dynamic>> _budgets = const [];

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

    final dio = ref.read(apiClientProvider).dio;

    try {
      final summaryRes = await dio.get<Map<String, dynamic>>('/finance/summary');
      final advancesRes = await dio.get<Map<String, dynamic>>(
        '/finance/advances',
        queryParameters: {'per_page': 20},
      );
      final budgetsRes = await dio.get<Map<String, dynamic>>(
        '/finance/budgets',
        queryParameters: {'per_page': 20},
      );

      if (!mounted) return;

      setState(() {
        _summary = summaryRes.data ?? const {};
        _advances = ((advancesRes.data?['data'] as List<dynamic>?) ?? const [])
            .map(
              (item) => item is Map
                  ? Map<String, dynamic>.from(item)
                  : <String, dynamic>{},
            )
            .toList();
        _budgets = ((budgetsRes.data?['data'] as List<dynamic>?) ?? const [])
            .map(
              (item) => item is Map
                  ? Map<String, dynamic>.from(item)
                  : <String, dynamic>{},
            )
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load finance data.';
        _loading = false;
      });
    }
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  String _money(double value, [String? currency]) {
    final ccy = currency == null || currency.isEmpty ? 'NAD' : currency;
    return '$ccy ${value.toStringAsFixed(2)}';
  }

  double get _currentNetSalary => _asDouble(_summary['current_net_salary']);

  double get _currentGrossSalary => _asDouble(_summary['current_gross_salary']);

  double get _ytdGross => _asDouble(_summary['ytd_gross']);

  String get _currency => _summary['currency']?.toString() ?? 'NAD';

  double get _activeAdvanceAmount {
    return _advances
        .where((item) => item['status']?.toString() != 'rejected')
        .fold<double>(0, (sum, item) => sum + _asDouble(item['amount']));
  }

  double get _advanceCap => _currentNetSalary * 0.5;

  double get _advanceCapUtilization {
    if (_advanceCap <= 0) return 0;
    return (_activeAdvanceAmount / _advanceCap).clamp(0, 1);
  }

  List<_BudgetPressure> get _budgetPressure {
    final pressures = <_BudgetPressure>[];
    for (final budget in _budgets) {
      final budgetName = budget['name']?.toString() ?? 'Budget';
      final lines = (budget['lines'] as List<dynamic>? ?? const []);
      for (final rawLine in lines) {
        if (rawLine is! Map) continue;
        final line = Map<String, dynamic>.from(rawLine);
        final allocated = _asDouble(line['amount_allocated']);
        if (allocated <= 0) continue;
        final spent = _asDouble(line['amount_spent']);
        pressures.add(
          _BudgetPressure(
            budgetName: budgetName,
            lineName: line['category']?.toString() ?? 'Line Item',
            allocated: allocated,
            spent: spent,
          ),
        );
      }
    }
    pressures.sort((a, b) => b.ratio.compareTo(a.ratio));
    return pressures.take(5).toList();
  }

  double get _budgetAllocated {
    return _budgetPressure.fold<double>(0, (sum, item) => sum + item.allocated);
  }

  double get _budgetSpent {
    return _budgetPressure.fold<double>(0, (sum, item) => sum + item.spent);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Finance Command',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
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
              : RefreshIndicator(
                  onRefresh: _load,
                  color: AppColors.primary,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _metricCard(
                              title: 'Net Salary',
                              value: _money(_currentNetSalary, _currency),
                              subtitle: 'Latest payslip',
                              icon: Icons.account_balance_wallet_outlined,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _metricCard(
                              title: 'YTD Gross',
                              value: _money(_ytdGross, _currency),
                              subtitle: 'Current year',
                              icon: Icons.trending_up,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _metricCard(
                              title: 'Gross Salary',
                              value: _money(_currentGrossSalary, _currency),
                              subtitle: 'Latest payslip',
                              icon: Icons.payments_outlined,
                              color: AppColors.info,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _advanceCapCard(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const _SectionHeader(title: 'Budget Snapshot'),
                      const SizedBox(height: 12),
                      _budgetPortfolioCard(),
                      const SizedBox(height: 20),
                      const _SectionHeader(title: 'Budget Pressure'),
                      const SizedBox(height: 12),
                      _budgetPressureCard(),
                      const SizedBox(height: 20),
                      const _SectionHeader(title: 'Recent Salary Advances'),
                      const SizedBox(height: 12),
                      _advanceListCard(),
                    ],
                  ),
                ),
    );
  }

  Widget _metricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _advanceCapCard() {
    final pct = (_advanceCapUtilization * 100).round();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ADVANCE CAP',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 90,
                  height: 90,
                  child: CircularProgressIndicator(
                    value: _advanceCapUtilization,
                    strokeWidth: 10,
                    backgroundColor: AppColors.border,
                    valueColor: const AlwaysStoppedAnimation(AppColors.warning),
                  ),
                ),
                Text(
                  '$pct%',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Center(
            child: Text(
              '${_money(_activeAdvanceAmount, _currency)} active against ${_money(_advanceCap, _currency)} cap',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _budgetPortfolioCard() {
    final ratio = _budgetAllocated <= 0
        ? 0.0
        : (_budgetSpent / _budgetAllocated).clamp(0.0, 1.0).toDouble();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_budgets.length} budgets loaded',
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Allocated ${_money(_budgetAllocated, _currency)} · Spent ${_money(_budgetSpent, _currency)}',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 8,
              backgroundColor: AppColors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${(ratio * 100).round()}% utilization across the highest-pressure budget lines',
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _budgetPressureCard() {
    final pressure = _budgetPressure;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: pressure.isEmpty
          ? const Text(
              'No budget utilization lines are available yet.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            )
          : Column(
              children: pressure
                  .map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.lineName,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                '${(item.ratio * 100).round()}%',
                                style: const TextStyle(
                                  color: AppColors.warning,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.budgetName,
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 11,
                            ),
                          ),
                          const SizedBox(height: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: item.ratio.clamp(0, 1),
                              minHeight: 7,
                              backgroundColor: AppColors.border,
                              valueColor: AlwaysStoppedAnimation(
                                item.ratio >= 0.9
                                    ? AppColors.danger
                                    : item.ratio >= 0.75
                                        ? AppColors.warning
                                        : AppColors.success,
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Spent ${_money(item.spent, _currency)} of ${_money(item.allocated, _currency)}',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
    );
  }

  Widget _advanceListCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: _advances.isEmpty
          ? const Text(
              'No salary advances found.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            )
          : Column(
              children: _advances.take(5).map((advance) {
                final createdAt = advance['created_at']?.toString();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.account_balance_wallet_outlined,
                          color: AppColors.primary,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              advance['reference_number']?.toString() ?? 'Advance',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              advance['purpose']?.toString() ?? '-',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                            if (createdAt != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                AppDateFormatter.short(createdAt),
                                style: const TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            _money(_asDouble(advance['amount']), _currency),
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.info.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              advance['status']?.toString() ?? 'draft',
                              style: const TextStyle(
                                color: AppColors.info,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 15,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _BudgetPressure {
  const _BudgetPressure({
    required this.budgetName,
    required this.lineName,
    required this.allocated,
    required this.spent,
  });

  final String budgetName;
  final String lineName;
  final double allocated;
  final double spent;

  double get ratio => allocated <= 0 ? 0 : spent / allocated;
}
