import 'dart:convert';
import 'dart:math';

import 'draft_sync_outcome.dart';

/// Owner key for drafts: `tenantId:userId`, or null when no account is known.
String? draftOwnerKey(Map<String, dynamic>? user) {
  if (user == null) return null;
  final id = user['id'];
  if (id == null || '$id'.isEmpty) return null;
  final tenant = user['tenant_id'];
  return '${tenant ?? '-'}:$id';
}

/// RFC 4122 v4 UUID for a draft's sync operation.
String newDraftOperationId([Random? random]) {
  final rnd = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// The fields of a stored draft the sync engine needs (decoupled from Drift).
class SyncDraft {
  const SyncDraft({
    required this.id,
    required this.type,
    required this.payload,
    this.operationId,
    this.serverId,
  });

  final int id;
  final String type;
  final String payload;
  final String? operationId;
  final String? serverId;
}

/// Persistence the engine needs between steps so an interrupted sync resumes.
abstract class DraftSyncStore {
  Future<void> markCreated(int draftId, String serverId);
  Future<void> markFailed(int draftId, String error);
  Future<void> complete(int draftId);
}

/// A failed HTTP call, with a message the user can act on.
class DraftSyncHttpException implements Exception {
  const DraftSyncHttpException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

abstract class DraftSyncTransport {
  /// POST [body] to [path] with an `Idempotency-Key` header and return the
  /// decoded JSON body. Throws [DraftSyncHttpException] on failure.
  Future<Map<String, dynamic>?> post(
    String path,
    Map<String, dynamic>? body, {
    required String idempotencyKey,
  });
}

class DraftSyncTarget {
  const DraftSyncTarget(this.createPath, this.body, {this.submitPath});

  final String createPath;
  final Map<String, dynamic> body;

  /// Second step that submits the created record for approval, if any.
  final String Function(String serverId)? submitPath;
}

/// Where each draft type is created (and submitted). Null = unsupported.
DraftSyncTarget? draftSyncTarget(String type, Map<String, dynamic> payload) {
  switch (type.toLowerCase()) {
    case 'travel':
      return DraftSyncTarget('/travel/requests', payload);
    case 'leave':
      return DraftSyncTarget('/leave/requests', payload);
    case 'imprest':
      return DraftSyncTarget('/imprest/requests', payload);
    case 'procurement':
      return DraftSyncTarget('/procurement/requests', payload);
    case 'salary_advance':
      return DraftSyncTarget(
        '/finance/advances',
        {
          'advance_type':
              _purposeToAdvanceType(payload['purpose']?.toString() ?? 'Other'),
          'amount': payload['amount'],
          'currency': 'NAD',
          'repayment_months': payload['repayment_months'] ?? 3,
          'purpose': payload['purpose'] ?? 'Other',
          'justification': 'Offline salary advance draft submission.',
        },
        // No auto-submit: submission requires the employee's explicit
        // deduction-authority consent, given on the Preview & Sign screen.
      );
    case 'pif':
      return DraftSyncTarget(
        '/programmes',
        {
          'title': payload['title'],
          'background': payload['background'],
          'overall_objective': payload['overall_objective'],
          'primary_currency': 'NAD',
          'total_budget': _sumBudgetLines(payload['budget_lines']),
          'funding_source': 'SADC PF',
          'member_states': payload['location'] == null ||
                  payload['location'].toString().isEmpty
              ? []
              : [payload['location'].toString()],
          'budget_lines': payload['budget_lines'] ?? [],
        },
        // No auto-submit: submission requires an explicit declaration
        // (declaration_confirmed) the requester must make themselves.
      );
    case 'incident':
      return DraftSyncTarget('/hr/incidents', payload);
    case 'expense_retirement':
      final requestId = payload['request_id'];
      if (requestId == null) return null;
      return DraftSyncTarget(
        '/imprest/requests/$requestId/retire',
        Map<String, dynamic>.from(payload)..remove('request_id'),
      );
    case 'asset_request':
      return DraftSyncTarget('/asset-requests', payload);
    case 'condition_report':
      return DraftSyncTarget('/support/tickets', payload);
    case 'overtime_claim':
      return DraftSyncTarget(
        '/hr/timesheets',
        payload,
        submitPath: (id) => '/hr/timesheets/$id/submit',
      );
    case 'assignment':
      return DraftSyncTarget('/assignments', payload);
    default:
      return null;
  }
}

/// Resumable two-step sync: create (once) → persist server id → submit →
/// remove the local draft. Each step carries a stable idempotency key, so a
/// retry after a lost response replays the server's stored result rather
/// than creating a second record.
class DraftSyncEngine {
  DraftSyncEngine({required this.transport, required this.store});

  final DraftSyncTransport transport;
  final DraftSyncStore store;

  Future<DraftSyncOutcome> syncAll(Iterable<SyncDraft> drafts) async {
    var synced = 0;
    var failed = 0;
    for (final draft in drafts) {
      if (await syncOne(draft)) {
        synced++;
      } else {
        failed++;
      }
    }
    return DraftSyncOutcome(synced: synced, failed: failed);
  }

  Future<bool> syncOne(SyncDraft draft) async {
    Map<String, dynamic>? payload;
    try {
      final decoded = jsonDecode(draft.payload);
      if (decoded is Map) payload = Map<String, dynamic>.from(decoded);
    } catch (_) {}
    if (payload == null) {
      await store.markFailed(draft.id, 'Draft data is unreadable. Delete it and re-enter the request.');
      return false;
    }

    final target = draftSyncTarget(draft.type, payload);
    if (target == null) {
      await store.markFailed(draft.id, 'This draft type cannot be synced from the app.');
      return false;
    }

    final operation = draft.operationId ?? 'draft-${draft.id}';
    var serverId = draft.serverId;
    try {
      if (serverId == null) {
        final created = await transport.post(
          target.createPath,
          target.body,
          idempotencyKey: '$operation:create',
        );
        final data = created?['data'];
        final id = data is Map ? data['id'] : null;
        if (id != null) {
          serverId = '$id';
          await store.markCreated(draft.id, serverId);
        } else if (target.submitPath != null) {
          await store.markFailed(draft.id, 'The server did not confirm the created record. Sync again to retry.');
          return false;
        }
      }

      final submitPath = target.submitPath;
      if (submitPath != null) {
        await transport.post(
          submitPath(serverId!),
          null,
          idempotencyKey: '$operation:submit',
        );
      }

      await store.complete(draft.id);
      return true;
    } on DraftSyncHttpException catch (e) {
      await store.markFailed(draft.id, e.message);
      return false;
    } catch (_) {
      await store.markFailed(draft.id, 'Sync was interrupted. It will resume from where it stopped.');
      return false;
    }
  }
}

String _purposeToAdvanceType(String purpose) {
  const map = {
    'Personal Emergency': 'other',
    'Medical Expenses': 'medical',
    'Education': 'school',
    'Home Repair': 'other',
    'Other': 'other',
  };
  return map[purpose] ?? 'other';
}

double _sumBudgetLines(dynamic rawLines) {
  if (rawLines is! List) return 0;
  return rawLines.fold<double>(0, (sum, item) {
    if (item is! Map) return sum;
    final amount = double.tryParse('${item['amount']}') ?? 0;
    return sum + amount;
  });
}
