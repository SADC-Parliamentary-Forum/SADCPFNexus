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
