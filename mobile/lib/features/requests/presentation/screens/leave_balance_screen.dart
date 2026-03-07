import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/theme/app_theme.dart';
import '../../../../../core/utils/date_format.dart';

class LeaveBalanceScreen extends ConsumerStatefulWidget {
  const LeaveBalanceScreen({super.key});

  @override
  ConsumerState<LeaveBalanceScreen> createState() => _LeaveBalanceScreenState();
}

class _LeaveBalanceScreenState extends ConsumerState<LeaveBalanceScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _balances;
  List<dynamic> _lil = [];
  List<dynamic> _history = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final results = await Future.wait([
        dio.get<Map<String, dynamic>>('/leave/balances'),
        dio.get<Map<String, dynamic>>('/leave/lil-accruals'),
        dio.get<Map<String, dynamic>>('/leave/requests', queryParameters: {'per_page': 20}),
      ]);
      if (!mounted) return;
      setState(() {
        _balances = results[0].data;
        _lil = (results[1].data?['data'] as List<dynamic>?) ?? [];
        final reqData = results[2].data?['data'];
        _history = reqData is List ? List<dynamic>.from(reqData) : [];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load leave data.';
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
          icon: const Icon(Icons.arrow_back_ios_new, size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Leave Balances', style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.danger)),
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
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildSummaryCard(),
                      const SizedBox(height: 20),
                      const Text('LEAVE IN LIEU (LIL) ACCRUALS', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                      const SizedBox(height: 4),
                      const Text('Hours earned for work outside normal office hours.', style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                      const SizedBox(height: 10),
                      if (_lil.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                          child: const Center(child: Text('No LIL accruals', style: TextStyle(color: AppColors.textMuted, fontSize: 13))),
                        )
                      else
                        ..._lil.map((l) => _lilTile(l as Map<String, dynamic>)),
                      const SizedBox(height: 20),
                      const Text('LEAVE HISTORY', style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8)),
                      const SizedBox(height: 10),
                      if (_history.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: AppColors.bgSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                          child: const Center(child: Text('No leave requests yet', style: TextStyle(color: AppColors.textMuted, fontSize: 13))),
                        )
                      else
                        ..._history.map((h) => _historyTile(h as Map<String, dynamic>)),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/requests/leave/new'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add, size: 18),
        label: const Text('New Request', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _buildSummaryCard() {
    final year = _balances?['period_year'] ?? DateTime.now().year;
    final annual = (_balances?['annual_balance_days'] as num?)?.toInt() ?? 0;
    final lilHours = (_balances?['lil_hours_available'] as num?)?.toDouble() ?? 0.0;
    final sickUsed = (_balances?['sick_leave_used_days'] as num?)?.toInt() ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AppColors.primary.withValues(alpha: 0.12), AppColors.bgCard]),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Leave Year: 01 Jan – 31 Dec $year', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          const SizedBox(height: 12),
          Row(
            children: [
              _heroStat('Available', '$annual', 'Annual days', AppColors.success),
              const SizedBox(width: 8),
              _heroStat('Sick used', '$sickUsed', 'Days', AppColors.warning),
              const SizedBox(width: 8),
              _heroStat('LIL Hours', '${lilHours.toStringAsFixed(1)}h', 'In lieu', AppColors.primary),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String label, String val, String sub, Color color) => Expanded(
    child: Column(
      children: [
        Text(val, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 11, fontWeight: FontWeight.w600)),
        Text(sub, style: const TextStyle(color: AppColors.textMuted, fontSize: 9)),
      ],
    ),
  );

  Widget _lilTile(Map<String, dynamic> l) {
    final date = l['date']?.toString();
    final desc = l['description']?.toString() ?? l['code']?.toString() ?? '—';
    final hours = (l['hours'] as num?)?.toDouble() ?? 0.0;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.more_time, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(desc, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('Earned: ${AppDateFormatter.short(date)}', style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
              ],
            ),
          ),
          Text('${hours}h', style: const TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _historyTile(Map<String, dynamic> h) {
    final type = h['leave_type']?.toString() ?? 'Leave';
    final start = h['start_date']?.toString();
    final end = h['end_date']?.toString();
    final days = (h['days_requested'] as num?)?.toInt() ?? 0;
    final status = h['status']?.toString() ?? '—';
    final dateStr = AppDateFormatter.range(start, end);
    final typeLabel = type.length > 1 ? '${type[0].toUpperCase()}${type.substring(1)}' : type;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(typeLabel, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('$dateStr · $days day${days == 1 ? '' : 's'}', style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: (status == 'approved' ? AppColors.success : status == 'rejected' ? AppColors.danger : AppColors.warning).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              status == 'approved' ? 'Approved' : status == 'rejected' ? 'Rejected' : status,
              style: TextStyle(
                color: status == 'approved' ? AppColors.success : status == 'rejected' ? AppColors.danger : AppColors.warning,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
