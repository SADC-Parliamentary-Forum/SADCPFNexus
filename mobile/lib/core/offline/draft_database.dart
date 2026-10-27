import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'draft_database.g.dart';

class DraftEntries extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get type => text()(); // travel, leave, imprest, procurement, pif, salary_advance
  TextColumn get title => text()();
  TextColumn get payload => text()(); // JSON map
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  // ── v2: ownership + resumable sync ──────────────────────────────────────
  /// `tenantId:userId` of the account that saved the draft. NULL for drafts
  /// written before v2: those are quarantined (never listed or synced for
  /// any account) because their author cannot be proven.
  TextColumn get ownerKey => text().nullable()();

  /// Client operation UUID; sent as the Idempotency-Key prefix so a retried
  /// create/submit is recognised by the server instead of duplicated.
  TextColumn get operationId => text().nullable()();

  /// Server record id once the create call succeeded — resume skips create.
  TextColumn get serverId => text().nullable()();

  /// pending | created | failed
  TextColumn get syncState => text().withDefault(const Constant('pending'))();
  TextColumn get lastError => text().nullable()();
  IntColumn get attempts => integer().withDefault(const Constant(0))();
}

@DriftDatabase(tables: [DraftEntries])
class DraftDatabase extends _$DraftDatabase {
  DraftDatabase([QueryExecutor? e]) : super(e ?? driftDatabaseConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            // Existing rows keep owner_key NULL → quarantined, never
            // reassigned to whoever happens to be signed in.
            await m.addColumn(draftEntries, draftEntries.ownerKey);
            await m.addColumn(draftEntries, draftEntries.operationId);
            await m.addColumn(draftEntries, draftEntries.serverId);
            await m.addColumn(draftEntries, draftEntries.syncState);
            await m.addColumn(draftEntries, draftEntries.lastError);
            await m.addColumn(draftEntries, draftEntries.attempts);
          }
        },
      );

  static QueryExecutor driftDatabaseConnection() {
    return driftDatabase(name: 'drafts');
  }
}
