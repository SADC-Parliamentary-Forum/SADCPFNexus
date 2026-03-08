import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'draft_database.g.dart';

class DraftEntries extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get type => text()(); // travel, leave, imprest, procurement
  TextColumn get title => text()();
  TextColumn get payload => text()(); // JSON map
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get syncedAt => dateTime().nullable()();
}

@DriftDatabase(tables: [DraftEntries])
class DraftDatabase extends _$DraftDatabase {
  DraftDatabase([QueryExecutor? e]) : super(e ?? driftDatabaseConnection());

  @override
  int get schemaVersion => 1;

  static LazyDatabase driftDatabaseConnection() {
    return driftDatabase(name: 'drafts');
  }
}
