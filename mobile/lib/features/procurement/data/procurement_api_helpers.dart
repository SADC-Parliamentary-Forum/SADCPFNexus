import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// Unwraps Laravel list payloads (`{ data: [...] }` or bare arrays).
List<Map<String, dynamic>> extractListData(dynamic payload) {
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
Map<String, dynamic>? extractObjectData(dynamic payload) {
  if (payload is Map) {
    final nested = payload['data'];
    if (nested is Map) {
      return Map<String, dynamic>.from(nested);
    }
    return Map<String, dynamic>.from(payload);
  }
  return null;
}

class ProcurementStatusConfig {
  const ProcurementStatusConfig(this.color, this.icon, this.label);
  final Color color;
  final IconData icon;
  final String label;
}

ProcurementStatusConfig procurementStatusConfig(String status) {
  switch (status) {
    case 'draft':
      return const ProcurementStatusConfig(
          AppColors.textMuted, Icons.edit_outlined, 'Draft');
    case 'submitted':
      return const ProcurementStatusConfig(
          AppColors.warning, Icons.hourglass_empty, 'Pending HOD');
    case 'hod_approved':
      return const ProcurementStatusConfig(
          AppColors.info, Icons.thumb_up_outlined, 'HOD Approved');
    case 'budget_reserved':
      return const ProcurementStatusConfig(
          AppColors.info, Icons.account_balance_outlined, 'Budget Reserved');
    case 'rfq_issued':
      return const ProcurementStatusConfig(
          AppColors.info, Icons.send_outlined, 'RFQ Issued');
    case 'evaluated':
      return const ProcurementStatusConfig(
          AppColors.primary, Icons.compare_outlined, 'Evaluated');
    case 'awarded':
      return const ProcurementStatusConfig(
          AppColors.success, Icons.emoji_events_outlined, 'Awarded');
    case 'po_issued':
      return const ProcurementStatusConfig(
          AppColors.success, Icons.receipt_long_outlined, 'PO Issued');
    case 'completed':
      return const ProcurementStatusConfig(
          AppColors.success, Icons.check_circle_outlined, 'Completed');
    case 'rejected':
      return const ProcurementStatusConfig(
          AppColors.danger, Icons.cancel_outlined, 'Rejected');
    case 'cancelled':
      return const ProcurementStatusConfig(
          AppColors.textMuted, Icons.block_outlined, 'Cancelled');
    case 'returned':
      return const ProcurementStatusConfig(
          AppColors.warning, Icons.undo_outlined, 'Returned');
    default:
      final label = status
          .split('_')
          .where((w) => w.isNotEmpty)
          .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
          .join(' ');
      return ProcurementStatusConfig(
          AppColors.textMuted, Icons.inventory_2_outlined, label);
  }
}

/// True when sealed financials must stay hidden (client-side guard).
bool isTenderFinanciallySealed(Map<String, dynamic> tender) {
  final sealed = tender['sealed_mode'] == true;
  final openedAt = tender['bids_opened_at'];
  return sealed && (openedAt == null || '$openedAt'.isEmpty);
}

/// Mirrors API [SealedBidService::isFinanciallySealed] for request payloads.
bool isRequestFinanciallySealed(
  Map<String, dynamic> request, {
  DateTime? now,
}) {
  final tender = request['tender'];
  if (tender is Map) {
    return isTenderFinanciallySealed(Map<String, dynamic>.from(tender));
  }

  final method = (request['procurement_method'] as String? ?? '').toLowerCase();
  final deadlineRaw = request['rfq_deadline'] as String?;
  if (method == 'tender' && deadlineRaw != null && deadlineRaw.isNotEmpty) {
    final deadline = DateTime.tryParse(deadlineRaw);
    if (deadline != null) {
      final endOfDay = DateTime(
        deadline.year,
        deadline.month,
        deadline.day,
        23,
        59,
        59,
      );
      final clock = now ?? DateTime.now();
      return !clock.isAfter(endOfDay);
    }
  }

  return false;
}

/// Never returns competitor amounts while sealed (API flag or request sealed).
num? quoteAmountForDisplay(
  Map<String, dynamic> quote, {
  bool requestSealed = false,
}) {
  if (requestSealed || quote['financials_sealed'] == true) {
    return null;
  }
  final amount =
      quote['quoted_amount'] ?? quote['total_amount'] ?? quote['amount'];
  if (amount is num) return amount;
  return null;
}

String budgetReservationStatusLabel(Map<String, dynamic> reservation) {
  final released = reservation['released_at'];
  if (released != null && '$released'.isNotEmpty) {
    return 'Released';
  }
  return 'Active';
}

enum VendorDocExpiryStatus { ok, expiringSoon, expired, unknown }

VendorDocExpiryStatus vendorDocumentExpiryStatus(
  String? expiresAt, {
  DateTime? now,
  int warnDays = 30,
}) {
  if (expiresAt == null || expiresAt.isEmpty) {
    return VendorDocExpiryStatus.unknown;
  }
  final parsed = DateTime.tryParse(expiresAt);
  if (parsed == null) return VendorDocExpiryStatus.unknown;

  final clock = now ?? DateTime.now();
  final end = DateTime(parsed.year, parsed.month, parsed.day);
  final today = DateTime(clock.year, clock.month, clock.day);
  if (end.isBefore(today)) return VendorDocExpiryStatus.expired;
  final warnUntil = today.add(Duration(days: warnDays));
  if (!end.isAfter(warnUntil)) return VendorDocExpiryStatus.expiringSoon;
  return VendorDocExpiryStatus.ok;
}

/// Matches API issue-rfq permission gate.
bool canIssueProcurementRfq({
  required List<String> permissions,
  required List<String> roles,
}) {
  const adminRoles = ['System Admin', 'System Administrator', 'super-admin'];
  if (roles.any(adminRoles.contains)) return true;
  const allowed = {
    'procurement.create',
    'procurement.approve',
    'procurement.admin',
  };
  return permissions.any(allowed.contains);
}
