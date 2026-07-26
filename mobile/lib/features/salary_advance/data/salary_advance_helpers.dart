import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Unwraps Laravel list payloads (`{ data: [...] }` or bare arrays).
List<Map<String, dynamic>> extractSalaryAdvanceList(dynamic payload) {
  if (payload is List) {
    return payload
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  if (payload is Map) {
    final nested = payload['data'];
    if (nested is List) {
      return nested
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
  }
  return const [];
}

/// Unwraps `{ data: {...} }` or returns the map itself.
Map<String, dynamic>? extractSalaryAdvanceObject(dynamic payload) {
  if (payload is Map) {
    final nested = payload['data'];
    if (nested is Map) {
      return Map<String, dynamic>.from(nested);
    }
    return Map<String, dynamic>.from(payload);
  }
  return null;
}

double asSaDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? 0;
}

String formatSaCurrency(dynamic amount, {String currency = 'NAD'}) {
  final value = asSaDouble(amount);
  final ccy = currency.isEmpty ? 'NAD' : currency;
  return '$ccy ${value.toStringAsFixed(2)}';
}

class SalaryAdvanceStatusConfig {
  const SalaryAdvanceStatusConfig(this.color, this.icon, this.label);
  final Color color;
  final IconData icon;
  final String label;
}

SalaryAdvanceStatusConfig salaryAdvanceStatusConfig(String? status) {
  switch ((status ?? '').toLowerCase()) {
    case 'draft':
      return const SalaryAdvanceStatusConfig(
          AppColors.textMuted, Icons.edit_outlined, 'Draft');
    case 'submitted':
      return const SalaryAdvanceStatusConfig(
          AppColors.warning, Icons.hourglass_empty, 'Pending Finance Certify');
    case 'resubmitted':
      return const SalaryAdvanceStatusConfig(
          AppColors.warning, Icons.refresh, 'Resubmitted');
    case 'finance_certified':
      return const SalaryAdvanceStatusConfig(
          AppColors.info, Icons.verified_outlined, 'Finance Certified');
    case 'finance_returned':
      return const SalaryAdvanceStatusConfig(
          AppColors.warning, Icons.undo, 'Returned by Finance');
    case 'returned_for_correction':
      return const SalaryAdvanceStatusConfig(
          AppColors.warning, Icons.undo, 'Returned for Correction');
    case 'not_eligible':
      return const SalaryAdvanceStatusConfig(
          AppColors.danger, Icons.block, 'Not Eligible');
    case 'approved':
      return const SalaryAdvanceStatusConfig(
          AppColors.success, Icons.check_circle_outlined, 'Approved');
    case 'approved_for_payment':
      return const SalaryAdvanceStatusConfig(
          AppColors.success, Icons.payments_outlined, 'Approved for Payment');
    case 'rejected':
      return const SalaryAdvanceStatusConfig(
          AppColors.danger, Icons.cancel_outlined, 'Rejected');
    case 'paid':
      return const SalaryAdvanceStatusConfig(
          AppColors.info, Icons.payments_outlined, 'Paid');
    case 'recovery_scheduled':
      return const SalaryAdvanceStatusConfig(
          AppColors.info, Icons.event_outlined, 'Recovery Scheduled');
    case 'recovered':
      return const SalaryAdvanceStatusConfig(
          AppColors.success, Icons.check_circle_outlined, 'Recovered');
    case 'reconciliation_required':
      return const SalaryAdvanceStatusConfig(
          AppColors.warning, Icons.warning_amber_outlined, 'Needs Reconciliation');
    case 'closed':
      return const SalaryAdvanceStatusConfig(
          AppColors.textMuted, Icons.lock_outlined, 'Closed');
    case 'withdrawn':
      return const SalaryAdvanceStatusConfig(
          AppColors.textMuted, Icons.block_outlined, 'Withdrawn');
    case 'cancelled':
      return const SalaryAdvanceStatusConfig(
          AppColors.textMuted, Icons.cancel_outlined, 'Cancelled');
    default:
      return SalaryAdvanceStatusConfig(
        AppColors.textMuted,
        Icons.info_outline,
        status == null || status.isEmpty ? 'Unknown' : status.replaceAll('_', ' '),
      );
  }
}

const _financeQueueRoles = [
  'Finance Controller',
  'Finance Officer',
  'Secretary General',
  'Director',
  'System Admin',
  'System Administrator',
  'super-admin',
];

const _financeQueuePermissions = [
  'finance.approve',
  'finance.admin',
  'salary_advance.certify',
  'salary_advance.approve',
  'salary_advance.pay',
  'salary_advance.recover',
  'salary_advance.admin',
];

/// Read-only finance queue visibility (no certify/pay/recover write actions on mobile).
bool canViewSalaryAdvanceFinanceQueues({
  required List<String> permissions,
  required List<String> roles,
}) {
  if (roles.any(_financeQueueRoles.contains)) return true;
  return permissions.any(_financeQueuePermissions.contains);
}

double outstandingBalanceFromRegister(Map<String, dynamic>? advance) {
  if (advance == null) return 0;
  final register = advance['balance_register'] ?? advance['balanceRegister'];
  if (register is Map) {
    return asSaDouble(register['balance']);
  }
  return asSaDouble(advance['outstanding_balance']);
}

class SalaryAdvanceEligibilitySnapshot {
  const SalaryAdvanceEligibilitySnapshot({
    required this.eligible,
    required this.netSalary,
    required this.maxEligible,
    required this.outstandingBalance,
    required this.blocked,
    required this.reasons,
    this.reason,
    this.policyVersion,
    this.recoveryRule,
    this.intendedRecoveryPayrollDate,
  });

  final bool eligible;
  final double netSalary;
  final double maxEligible;
  final double outstandingBalance;
  final bool blocked;
  final List<String> reasons;
  final String? reason;
  final String? policyVersion;
  final String? recoveryRule;
  final String? intendedRecoveryPayrollDate;
}

class SalaryAdvanceEmployeeSummary {
  const SalaryAdvanceEmployeeSummary({
    required this.eligibility,
    required this.currentRequest,
    required this.activeAdvance,
    required this.history,
  });

  final SalaryAdvanceEligibilitySnapshot eligibility;
  final Map<String, dynamic>? currentRequest;
  final Map<String, dynamic>? activeAdvance;
  final List<Map<String, dynamic>> history;
}

SalaryAdvanceEmployeeSummary parseEmployeeSummary(dynamic payload) {
  final root = extractSalaryAdvanceObject(payload) ?? const <String, dynamic>{};
  final eligibilityRaw = root['eligibility'];
  final eligibilityMap = eligibilityRaw is Map
      ? Map<String, dynamic>.from(eligibilityRaw)
      : <String, dynamic>{};
  final exposureRaw = eligibilityMap['exposure'];
  final exposure = exposureRaw is Map
      ? Map<String, dynamic>.from(exposureRaw)
      : <String, dynamic>{};
  final policyRaw = eligibilityMap['policy'];
  final policy =
      policyRaw is Map ? Map<String, dynamic>.from(policyRaw) : <String, dynamic>{};
  final reasons = (exposure['reasons'] as List?)
          ?.map((e) => e.toString())
          .toList() ??
      const <String>[];

  final current = root['current_request'];
  final active = root['active_advance'];
  final historyRaw = root['history'];

  return SalaryAdvanceEmployeeSummary(
    eligibility: SalaryAdvanceEligibilitySnapshot(
      eligible: eligibilityMap['eligible'] == true && exposure['blocked'] != true,
      netSalary: asSaDouble(eligibilityMap['net_salary']),
      maxEligible: asSaDouble(eligibilityMap['max_eligible']),
      outstandingBalance: asSaDouble(exposure['outstanding_balance']),
      blocked: exposure['blocked'] == true,
      reasons: reasons,
      reason: eligibilityMap['reason']?.toString(),
      policyVersion: policy['version']?.toString(),
      recoveryRule: policy['recovery_rule']?.toString(),
      intendedRecoveryPayrollDate:
          eligibilityMap['intended_recovery_payroll_date']?.toString(),
    ),
    currentRequest: current is Map ? Map<String, dynamic>.from(current) : null,
    activeAdvance: active is Map ? Map<String, dynamic>.from(active) : null,
    history: extractSalaryAdvanceList(historyRaw is List ? historyRaw : {'data': historyRaw}),
  );
}
