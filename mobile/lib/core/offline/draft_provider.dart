import 'package:dio/dio.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';
import '../auth/auth_storage.dart';
import 'draft_database.dart';
import 'draft_sync_engine.dart';

final draftDatabaseProvider = Provider<DraftDatabase>((ref) {
  return DraftDatabase();
});

/// Owner-scoped access to offline drafts. Every read and write is filtered by
/// the signed-in account (`tenantId:userId`); ownerless drafts from before
/// schema v2 are quarantined and only ever counted or discarded.
final draftStoreProvider = Provider<DraftStore>((ref) {
  return DraftStore(
    ref.watch(draftDatabaseProvider),
    ref.watch(authStorageProvider),
  );
});

class DraftStore implements DraftSyncStore {
  DraftStore(this._db, this._authStorage);

  final DraftDatabase _db;
  final AuthStorage _authStorage;

  Future<String?> currentOwnerKey() async =>
      draftOwnerKey(await _authStorage.getUserMap());

  /// Saves a draft for the signed-in account. Returns null (nothing saved)
  /// when no account is signed in, so a draft can never be orphaned.
  Future<int?> save({
    required String type,
    required String title,
    required String payload,
  }) async {
    final owner = await currentOwnerKey();
    if (owner == null) return null;
    return _db.into(_db.draftEntries).insert(DraftEntriesCompanion.insert(
          type: type,
          title: title,
          payload: payload,
          createdAt: DateTime.now(),
          ownerKey: Value(owner),
          operationId: Value(newDraftOperationId()),
        ));
  }

  /// Unsynced drafts belonging to the signed-in account, newest first.
  Future<List<DraftEntry>> listForCurrentOwner() async {
    final owner = await currentOwnerKey();
    if (owner == null) return const [];
    return (_db.select(_db.draftEntries)
          ..where((t) => t.ownerKey.equals(owner) & t.syncedAt.isNull())
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .get();
  }

  /// Drafts written before ownership existed (author unknown).
  Future<int> quarantinedCount() async {
    final count = _db.draftEntries.id.count();
    final row = await (_db.selectOnly(_db.draftEntries)
          ..addColumns([count])
          ..where(_db.draftEntries.ownerKey.isNull()))
        .getSingle();
    return row.read(count) ?? 0;
  }

  Future<int> discardQuarantined() =>
      (_db.delete(_db.draftEntries)..where((t) => t.ownerKey.isNull())).go();

  /// Deletes a draft only if it belongs to the signed-in account.
  Future<void> deleteOwned(int draftId) async {
    final owner = await currentOwnerKey();
    if (owner == null) return;
    await (_db.delete(_db.draftEntries)
          ..where((t) => t.id.equals(draftId) & t.ownerKey.equals(owner)))
        .go();
  }

  @override
  Future<void> markCreated(int draftId, String serverId) =>
      (_db.update(_db.draftEntries)..where((t) => t.id.equals(draftId))).write(
        DraftEntriesCompanion(
          serverId: Value(serverId),
          syncState: const Value('created'),
          lastError: const Value(null),
        ),
      );

  @override
  Future<void> markFailed(int draftId, String error) async {
    await _db.customUpdate(
      'UPDATE draft_entries SET sync_state = ?, last_error = ?, attempts = attempts + 1 WHERE id = ?',
      variables: [Variable.withString('failed'), Variable.withString(error), Variable.withInt(draftId)],
      updates: {_db.draftEntries},
    );
  }

  @override
  Future<void> complete(int draftId) =>
      (_db.delete(_db.draftEntries)..where((t) => t.id.equals(draftId))).go();
}

SyncDraft toSyncDraft(DraftEntry entry) => SyncDraft(
      id: entry.id,
      type: entry.type,
      payload: entry.payload,
      operationId: entry.operationId,
      serverId: entry.serverId,
    );

/// [DraftSyncTransport] over the authenticated API client.
class DioDraftSyncTransport implements DraftSyncTransport {
  DioDraftSyncTransport(this._dio);

  final Dio _dio;

  @override
  Future<Map<String, dynamic>?> post(
    String path,
    Map<String, dynamic>? body, {
    required String idempotencyKey,
  }) async {
    try {
      final response = await _dio.post<dynamic>(
        path,
        data: body,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      );
      final data = response.data;
      return data is Map ? Map<String, dynamic>.from(data) : null;
    } on DioException catch (e) {
      throw DraftSyncHttpException(describeDraftSyncError(e), statusCode: e.response?.statusCode);
    }
  }
}

/// Turns an API failure into a message the user can act on.
String describeDraftSyncError(DioException e) {
  final response = e.response;
  if (response == null) {
    return 'No connection to the server. The draft will resume on the next sync.';
  }
  final data = response.data;
  if (response.statusCode == 422 && data is Map && data['errors'] is Map) {
    final messages = (data['errors'] as Map)
        .values
        .expand((v) => v is List ? v : [v])
        .map((v) => '$v')
        .where((v) => v.isNotEmpty)
        .take(3)
        .join(' ');
    if (messages.isNotEmpty) return 'Needs correction: $messages';
  }
  if (data is Map && data['message'] is String && (data['message'] as String).isNotEmpty) {
    return data['message'] as String;
  }
  return 'The server rejected the draft (HTTP ${response.statusCode}).';
}
