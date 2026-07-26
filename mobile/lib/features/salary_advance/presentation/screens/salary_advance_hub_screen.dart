import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/router/safe_back.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_format.dart';
import '../../data/salary_advance_helpers.dart';

class SalaryAdvanceHubScreen extends ConsumerStatefulWidget {
  const SalaryAdvanceHubScreen({super.key});

  @override
  ConsumerState<SalaryAdvanceHubScreen> createState() =>
      _SalaryAdvanceHubScreenState();
}

class _SalaryAdvanceHubScreenState extends ConsumerState<SalaryAdvanceHubScreen> {
  bool _loading = true;
  String? _error;
  SalaryAdvanceEmployeeSummary? _summary;
  bool _showFinanceLink = false;

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
      final repo = ref.read(authRepositoryProvider);
      final perms = await repo.getStoredPermissions();
      final roles = await repo.getStoredRoles();
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/finance/advances/employee-summary',
      );
      if (!mounted) return;
      setState(() {
        _summary = parseEmployeeSummary(res.data);
        _showFinanceLink = canViewSalaryAdvanceFinanceQueues(
          permissions: perms,
          roles: roles,
        );
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load salary advance dashboard.';
        _loading = false;
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
        title: const Text(
          'Salary Advances',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
        actions: [
          if (_showFinanceLink)
            TextButton(
              onPressed: () => context.push('/finance/command-center'),
              child: const Text(
                'Finance',
                style: TextStyle(
                  color: AppColors.primaryDark,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppColors.danger)),
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
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 100),
                    children: [
                      const Text('Dashboard',
                          style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF1A1A1A))),
                      const SizedBox(height: 6),
                      const Text(
                        'Eligibility, current request, and outstanding balance.',
                        style: TextStyle(
                            fontSize: 13, color: Color(0xFF666666), height: 1.5),
                      ),
                      const SizedBox(height: 20),
                      _eligibilityCard(),
                      const SizedBox(height: 12),
                      _currentRequestCard(),
                      const SizedBox(height: 12),
                      _activeAdvanceCard(),
                      const SizedBox(height: 20),
                      _navTile(
                        icon: Icons.list_alt_outlined,
                        title: 'My applications',
                        subtitle: 'Open and in-progress requests',
                        onTap: () =>
                            context.push('/salary/advances/applications'),
                      ),
                      const SizedBox(height: 10),
                      _navTile(
                        icon: Icons.history,
                        title: 'History',
                        subtitle: 'Closed, recovered, rejected, withdrawn',
                        onTap: () => context.push('/salary/advances/history'),
                      ),
                      if (_summary != null && _summary!.history.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            const Expanded(
                              child: Text('Recent history',
                                  style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700)),
                            ),
                            TextButton(
                              onPressed: () =>
                                  context.push('/salary/advances/history'),
                              child: const Text('View all'),
                            ),
                          ],
                        ),
                        ..._summary!.history.take(5).map(_historyRow),
                      ],
                    ],
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/salary/advance/new'),
        backgroundColor: const Color(0xFF13EC80),
        foregroundColor: const Color(0xFF102219),
        icon: const Icon(Icons.add),
        label: const Text('Apply'),
      ),
    );
  }

  Widget _eligibilityCard() {
    final elig = _summary?.eligibility;
    final eligible = elig?.eligible ?? false;
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.verified_user_outlined,
                size: 18,
                color: eligible ? AppColors.success : AppColors.warning),
            const SizedBox(width: 8),
            const Text('Eligibility',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 10),
          Text(
            eligible
                ? 'You are eligible to apply'
                : 'Application currently blocked',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: eligible ? AppColors.success : const Color(0xFF9A3412),
            ),
          ),
          const SizedBox(height: 10),
          _kv('Confirmed net', formatSaCurrency(elig?.netSalary)),
          _kv('Max eligible (50%)', formatSaCurrency(elig?.maxEligible)),
          _kv('Outstanding', formatSaCurrency(elig?.outstandingBalance)),
          _kv('Policy',
              '${elig?.policyVersion ?? '—'} · ${elig?.recoveryRule ?? 'full_eom'}'),
          if (elig?.intendedRecoveryPayrollDate != null &&
              elig!.intendedRecoveryPayrollDate!.isNotEmpty)
            _kv('Recovery payroll',
                AppDateFormatter.short(elig.intendedRecoveryPayrollDate!)),
          if (!eligible && (elig?.reasons.isNotEmpty ?? false)) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'Reasons: ${elig!.reasons.join(', ').replaceAll('_', ' ')}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF9A3412)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _currentRequestCard() {
    final current = _summary?.currentRequest;
    final status = salaryAdvanceStatusConfig(current?['status']?.toString());
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.pending_actions_outlined, size: 18, color: AppColors.info),
            SizedBox(width: 8),
            Text('Current request',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 10),
          if (current == null)
            const Text('No open request. You can apply if eligible.',
                style: TextStyle(fontSize: 13, color: Color(0xFF666666)))
          else ...[
            Text(current['reference_number']?.toString() ?? 'Advance',
                style: const TextStyle(fontSize: 12, color: Color(0xFF888888))),
            const SizedBox(height: 4),
            Text(
              formatSaCurrency(current['amount'],
                  currency: current['currency']?.toString() ?? 'NAD'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            _statusChip(status),
            TextButton(
              onPressed: () =>
                  context.push('/salary/advances/${current['id']}'),
              child: const Text('Open request →'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _activeAdvanceCard() {
    final active = _summary?.activeAdvance;
    final status = salaryAdvanceStatusConfig(active?['status']?.toString());
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.account_balance_wallet_outlined,
                size: 18, color: AppColors.primaryDark),
            SizedBox(width: 8),
            Text('Active advance',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 10),
          if (active == null)
            const Text('No active advance on your account.',
                style: TextStyle(fontSize: 13, color: Color(0xFF666666)))
          else ...[
            Text(active['reference_number']?.toString() ?? 'Advance',
                style: const TextStyle(fontSize: 12, color: Color(0xFF888888))),
            const SizedBox(height: 4),
            Text(formatSaCurrency(active['amount']),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            _statusChip(status),
            TextButton(
              onPressed: () =>
                  context.push('/salary/advances/${active['id']}'),
              child: const Text('View advance →'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _historyRow(Map<String, dynamic> item) {
    final status = salaryAdvanceStatusConfig(item['status']?.toString());
    return InkWell(
      onTap: () => context.push('/salary/advances/${item['id']}'),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['reference_number']?.toString() ?? 'Advance',
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  formatSaCurrency(item['amount'],
                      currency: item['currency']?.toString() ?? 'NAD'),
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF666666)),
                ),
              ],
            ),
          ),
          _statusChip(status),
        ]),
      ),
    );
  }

  Widget _navTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.primaryDark, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w700)),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF666666))),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFFAAAAAA)),
        ]),
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: child,
      );

  Widget _kv(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(children: [
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF666666)))),
          Text(value,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF1A1A1A))),
        ]),
      );

  Widget _statusChip(SalaryAdvanceStatusConfig status) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: status.color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(status.label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: status.color)),
      );
}
