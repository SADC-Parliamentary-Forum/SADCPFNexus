// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'draft_database.dart';

// ignore_for_file: type=lint
class $DraftEntriesTable extends DraftEntries
    with TableInfo<$DraftEntriesTable, DraftEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DraftEntriesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
      'id', aliasedName, false,
      hasAutoIncrement: true,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('PRIMARY KEY AUTOINCREMENT'));
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
      'type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
      'title', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _payloadMeta =
      const VerificationMeta('payload');
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
      'payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
      'created_at', aliasedName, false,
      type: DriftSqlType.dateTime, requiredDuringInsert: true);
  static const VerificationMeta _syncedAtMeta =
      const VerificationMeta('syncedAt');
  @override
  late final GeneratedColumn<DateTime> syncedAt = GeneratedColumn<DateTime>(
      'synced_at', aliasedName, true,
      type: DriftSqlType.dateTime, requiredDuringInsert: false);
  static const VerificationMeta _ownerKeyMeta =
      const VerificationMeta('ownerKey');
  @override
  late final GeneratedColumn<String> ownerKey = GeneratedColumn<String>(
      'owner_key', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _operationIdMeta =
      const VerificationMeta('operationId');
  @override
  late final GeneratedColumn<String> operationId = GeneratedColumn<String>(
      'operation_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _serverIdMeta =
      const VerificationMeta('serverId');
  @override
  late final GeneratedColumn<String> serverId = GeneratedColumn<String>(
      'server_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _syncStateMeta =
      const VerificationMeta('syncState');
  @override
  late final GeneratedColumn<String> syncState = GeneratedColumn<String>(
      'sync_state', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('pending'));
  static const VerificationMeta _lastErrorMeta =
      const VerificationMeta('lastError');
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
      'last_error', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _attemptsMeta =
      const VerificationMeta('attempts');
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
      'attempts', aliasedName, false,
      type: DriftSqlType.int,
      requiredDuringInsert: false,
      defaultValue: const Constant(0));
  @override
  List<GeneratedColumn> get $columns => [
        id,
        type,
        title,
        payload,
        createdAt,
        syncedAt,
        ownerKey,
        operationId,
        serverId,
        syncState,
        lastError,
        attempts
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'draft_entries';
  @override
  VerificationContext validateIntegrity(Insertable<DraftEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('type')) {
      context.handle(
          _typeMeta, type.isAcceptableOrUnknown(data['type']!, _typeMeta));
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
          _titleMeta, title.isAcceptableOrUnknown(data['title']!, _titleMeta));
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(_payloadMeta,
          payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta));
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('synced_at')) {
      context.handle(_syncedAtMeta,
          syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta));
    }
    if (data.containsKey('owner_key')) {
      context.handle(_ownerKeyMeta,
          ownerKey.isAcceptableOrUnknown(data['owner_key']!, _ownerKeyMeta));
    }
    if (data.containsKey('operation_id')) {
      context.handle(
          _operationIdMeta,
          operationId.isAcceptableOrUnknown(
              data['operation_id']!, _operationIdMeta));
    }
    if (data.containsKey('server_id')) {
      context.handle(_serverIdMeta,
          serverId.isAcceptableOrUnknown(data['server_id']!, _serverIdMeta));
    }
    if (data.containsKey('sync_state')) {
      context.handle(_syncStateMeta,
          syncState.isAcceptableOrUnknown(data['sync_state']!, _syncStateMeta));
    }
    if (data.containsKey('last_error')) {
      context.handle(_lastErrorMeta,
          lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta));
    }
    if (data.containsKey('attempts')) {
      context.handle(_attemptsMeta,
          attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DraftEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DraftEntry(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}id'])!,
      type: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}type'])!,
      title: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}title'])!,
      payload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payload'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}created_at'])!,
      syncedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.dateTime, data['${effectivePrefix}synced_at']),
      ownerKey: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}owner_key']),
      operationId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}operation_id']),
      serverId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}server_id']),
      syncState: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}sync_state'])!,
      lastError: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}last_error']),
      attempts: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}attempts'])!,
    );
  }

  @override
  $DraftEntriesTable createAlias(String alias) {
    return $DraftEntriesTable(attachedDatabase, alias);
  }
}

class DraftEntry extends DataClass implements Insertable<DraftEntry> {
  final int id;
  final String type;
  final String title;
  final String payload;
  final DateTime createdAt;
  final DateTime? syncedAt;

  /// `tenantId:userId` of the account that saved the draft. NULL for drafts
  /// written before v2: those are quarantined (never listed or synced for
  /// any account) because their author cannot be proven.
  final String? ownerKey;

  /// Client operation UUID; sent as the Idempotency-Key prefix so a retried
  /// create/submit is recognised by the server instead of duplicated.
  final String? operationId;

  /// Server record id once the create call succeeded — resume skips create.
  final String? serverId;

  /// pending | created | failed
  final String syncState;
  final String? lastError;
  final int attempts;
  const DraftEntry(
      {required this.id,
      required this.type,
      required this.title,
      required this.payload,
      required this.createdAt,
      this.syncedAt,
      this.ownerKey,
      this.operationId,
      this.serverId,
      required this.syncState,
      this.lastError,
      required this.attempts});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['type'] = Variable<String>(type);
    map['title'] = Variable<String>(title);
    map['payload'] = Variable<String>(payload);
    map['created_at'] = Variable<DateTime>(createdAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<DateTime>(syncedAt);
    }
    if (!nullToAbsent || ownerKey != null) {
      map['owner_key'] = Variable<String>(ownerKey);
    }
    if (!nullToAbsent || operationId != null) {
      map['operation_id'] = Variable<String>(operationId);
    }
    if (!nullToAbsent || serverId != null) {
      map['server_id'] = Variable<String>(serverId);
    }
    map['sync_state'] = Variable<String>(syncState);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['attempts'] = Variable<int>(attempts);
    return map;
  }

  DraftEntriesCompanion toCompanion(bool nullToAbsent) {
    return DraftEntriesCompanion(
      id: Value(id),
      type: Value(type),
      title: Value(title),
      payload: Value(payload),
      createdAt: Value(createdAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
      ownerKey: ownerKey == null && nullToAbsent
          ? const Value.absent()
          : Value(ownerKey),
      operationId: operationId == null && nullToAbsent
          ? const Value.absent()
          : Value(operationId),
      serverId: serverId == null && nullToAbsent
          ? const Value.absent()
          : Value(serverId),
      syncState: Value(syncState),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      attempts: Value(attempts),
    );
  }

  factory DraftEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DraftEntry(
      id: serializer.fromJson<int>(json['id']),
      type: serializer.fromJson<String>(json['type']),
      title: serializer.fromJson<String>(json['title']),
      payload: serializer.fromJson<String>(json['payload']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      syncedAt: serializer.fromJson<DateTime?>(json['syncedAt']),
      ownerKey: serializer.fromJson<String?>(json['ownerKey']),
      operationId: serializer.fromJson<String?>(json['operationId']),
      serverId: serializer.fromJson<String?>(json['serverId']),
      syncState: serializer.fromJson<String>(json['syncState']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      attempts: serializer.fromJson<int>(json['attempts']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'type': serializer.toJson<String>(type),
      'title': serializer.toJson<String>(title),
      'payload': serializer.toJson<String>(payload),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'syncedAt': serializer.toJson<DateTime?>(syncedAt),
      'ownerKey': serializer.toJson<String?>(ownerKey),
      'operationId': serializer.toJson<String?>(operationId),
      'serverId': serializer.toJson<String?>(serverId),
      'syncState': serializer.toJson<String>(syncState),
      'lastError': serializer.toJson<String?>(lastError),
      'attempts': serializer.toJson<int>(attempts),
    };
  }

  DraftEntry copyWith(
          {int? id,
          String? type,
          String? title,
          String? payload,
          DateTime? createdAt,
          Value<DateTime?> syncedAt = const Value.absent(),
          Value<String?> ownerKey = const Value.absent(),
          Value<String?> operationId = const Value.absent(),
          Value<String?> serverId = const Value.absent(),
          String? syncState,
          Value<String?> lastError = const Value.absent(),
          int? attempts}) =>
      DraftEntry(
        id: id ?? this.id,
        type: type ?? this.type,
        title: title ?? this.title,
        payload: payload ?? this.payload,
        createdAt: createdAt ?? this.createdAt,
        syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
        ownerKey: ownerKey.present ? ownerKey.value : this.ownerKey,
        operationId: operationId.present ? operationId.value : this.operationId,
        serverId: serverId.present ? serverId.value : this.serverId,
        syncState: syncState ?? this.syncState,
        lastError: lastError.present ? lastError.value : this.lastError,
        attempts: attempts ?? this.attempts,
      );
  DraftEntry copyWithCompanion(DraftEntriesCompanion data) {
    return DraftEntry(
      id: data.id.present ? data.id.value : this.id,
      type: data.type.present ? data.type.value : this.type,
      title: data.title.present ? data.title.value : this.title,
      payload: data.payload.present ? data.payload.value : this.payload,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
      ownerKey: data.ownerKey.present ? data.ownerKey.value : this.ownerKey,
      operationId:
          data.operationId.present ? data.operationId.value : this.operationId,
      serverId: data.serverId.present ? data.serverId.value : this.serverId,
      syncState: data.syncState.present ? data.syncState.value : this.syncState,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DraftEntry(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('title: $title, ')
          ..write('payload: $payload, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('ownerKey: $ownerKey, ')
          ..write('operationId: $operationId, ')
          ..write('serverId: $serverId, ')
          ..write('syncState: $syncState, ')
          ..write('lastError: $lastError, ')
          ..write('attempts: $attempts')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, type, title, payload, createdAt, syncedAt,
      ownerKey, operationId, serverId, syncState, lastError, attempts);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DraftEntry &&
          other.id == this.id &&
          other.type == this.type &&
          other.title == this.title &&
          other.payload == this.payload &&
          other.createdAt == this.createdAt &&
          other.syncedAt == this.syncedAt &&
          other.ownerKey == this.ownerKey &&
          other.operationId == this.operationId &&
          other.serverId == this.serverId &&
          other.syncState == this.syncState &&
          other.lastError == this.lastError &&
          other.attempts == this.attempts);
}

class DraftEntriesCompanion extends UpdateCompanion<DraftEntry> {
  final Value<int> id;
  final Value<String> type;
  final Value<String> title;
  final Value<String> payload;
  final Value<DateTime> createdAt;
  final Value<DateTime?> syncedAt;
  final Value<String?> ownerKey;
  final Value<String?> operationId;
  final Value<String?> serverId;
  final Value<String> syncState;
  final Value<String?> lastError;
  final Value<int> attempts;
  const DraftEntriesCompanion({
    this.id = const Value.absent(),
    this.type = const Value.absent(),
    this.title = const Value.absent(),
    this.payload = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.ownerKey = const Value.absent(),
    this.operationId = const Value.absent(),
    this.serverId = const Value.absent(),
    this.syncState = const Value.absent(),
    this.lastError = const Value.absent(),
    this.attempts = const Value.absent(),
  });
  DraftEntriesCompanion.insert({
    this.id = const Value.absent(),
    required String type,
    required String title,
    required String payload,
    required DateTime createdAt,
    this.syncedAt = const Value.absent(),
    this.ownerKey = const Value.absent(),
    this.operationId = const Value.absent(),
    this.serverId = const Value.absent(),
    this.syncState = const Value.absent(),
    this.lastError = const Value.absent(),
    this.attempts = const Value.absent(),
  })  : type = Value(type),
        title = Value(title),
        payload = Value(payload),
        createdAt = Value(createdAt);
  static Insertable<DraftEntry> custom({
    Expression<int>? id,
    Expression<String>? type,
    Expression<String>? title,
    Expression<String>? payload,
    Expression<DateTime>? createdAt,
    Expression<DateTime>? syncedAt,
    Expression<String>? ownerKey,
    Expression<String>? operationId,
    Expression<String>? serverId,
    Expression<String>? syncState,
    Expression<String>? lastError,
    Expression<int>? attempts,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (type != null) 'type': type,
      if (title != null) 'title': title,
      if (payload != null) 'payload': payload,
      if (createdAt != null) 'created_at': createdAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (ownerKey != null) 'owner_key': ownerKey,
      if (operationId != null) 'operation_id': operationId,
      if (serverId != null) 'server_id': serverId,
      if (syncState != null) 'sync_state': syncState,
      if (lastError != null) 'last_error': lastError,
      if (attempts != null) 'attempts': attempts,
    });
  }

  DraftEntriesCompanion copyWith(
      {Value<int>? id,
      Value<String>? type,
      Value<String>? title,
      Value<String>? payload,
      Value<DateTime>? createdAt,
      Value<DateTime?>? syncedAt,
      Value<String?>? ownerKey,
      Value<String?>? operationId,
      Value<String?>? serverId,
      Value<String>? syncState,
      Value<String?>? lastError,
      Value<int>? attempts}) {
    return DraftEntriesCompanion(
      id: id ?? this.id,
      type: type ?? this.type,
      title: title ?? this.title,
      payload: payload ?? this.payload,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      ownerKey: ownerKey ?? this.ownerKey,
      operationId: operationId ?? this.operationId,
      serverId: serverId ?? this.serverId,
      syncState: syncState ?? this.syncState,
      lastError: lastError ?? this.lastError,
      attempts: attempts ?? this.attempts,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<DateTime>(syncedAt.value);
    }
    if (ownerKey.present) {
      map['owner_key'] = Variable<String>(ownerKey.value);
    }
    if (operationId.present) {
      map['operation_id'] = Variable<String>(operationId.value);
    }
    if (serverId.present) {
      map['server_id'] = Variable<String>(serverId.value);
    }
    if (syncState.present) {
      map['sync_state'] = Variable<String>(syncState.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DraftEntriesCompanion(')
          ..write('id: $id, ')
          ..write('type: $type, ')
          ..write('title: $title, ')
          ..write('payload: $payload, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('ownerKey: $ownerKey, ')
          ..write('operationId: $operationId, ')
          ..write('serverId: $serverId, ')
          ..write('syncState: $syncState, ')
          ..write('lastError: $lastError, ')
          ..write('attempts: $attempts')
          ..write(')'))
        .toString();
  }
}

abstract class _$DraftDatabase extends GeneratedDatabase {
  _$DraftDatabase(QueryExecutor e) : super(e);
  $DraftDatabaseManager get managers => $DraftDatabaseManager(this);
  late final $DraftEntriesTable draftEntries = $DraftEntriesTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [draftEntries];
}

typedef $$DraftEntriesTableCreateCompanionBuilder = DraftEntriesCompanion
    Function({
  Value<int> id,
  required String type,
  required String title,
  required String payload,
  required DateTime createdAt,
  Value<DateTime?> syncedAt,
  Value<String?> ownerKey,
  Value<String?> operationId,
  Value<String?> serverId,
  Value<String> syncState,
  Value<String?> lastError,
  Value<int> attempts,
});
typedef $$DraftEntriesTableUpdateCompanionBuilder = DraftEntriesCompanion
    Function({
  Value<int> id,
  Value<String> type,
  Value<String> title,
  Value<String> payload,
  Value<DateTime> createdAt,
  Value<DateTime?> syncedAt,
  Value<String?> ownerKey,
  Value<String?> operationId,
  Value<String?> serverId,
  Value<String> syncState,
  Value<String?> lastError,
  Value<int> attempts,
});

class $$DraftEntriesTableFilterComposer
    extends Composer<_$DraftDatabase, $DraftEntriesTable> {
  $$DraftEntriesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get title => $composableBuilder(
      column: $table.title, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<DateTime> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ownerKey => $composableBuilder(
      column: $table.ownerKey, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get serverId => $composableBuilder(
      column: $table.serverId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get syncState => $composableBuilder(
      column: $table.syncState, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get attempts => $composableBuilder(
      column: $table.attempts, builder: (column) => ColumnFilters(column));
}

class $$DraftEntriesTableOrderingComposer
    extends Composer<_$DraftDatabase, $DraftEntriesTable> {
  $$DraftEntriesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get title => $composableBuilder(
      column: $table.title, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get payload => $composableBuilder(
      column: $table.payload, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<DateTime> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ownerKey => $composableBuilder(
      column: $table.ownerKey, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get serverId => $composableBuilder(
      column: $table.serverId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get syncState => $composableBuilder(
      column: $table.syncState, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get lastError => $composableBuilder(
      column: $table.lastError, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get attempts => $composableBuilder(
      column: $table.attempts, builder: (column) => ColumnOrderings(column));
}

class $$DraftEntriesTableAnnotationComposer
    extends Composer<_$DraftDatabase, $DraftEntriesTable> {
  $$DraftEntriesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);

  GeneratedColumn<String> get ownerKey =>
      $composableBuilder(column: $table.ownerKey, builder: (column) => column);

  GeneratedColumn<String> get operationId => $composableBuilder(
      column: $table.operationId, builder: (column) => column);

  GeneratedColumn<String> get serverId =>
      $composableBuilder(column: $table.serverId, builder: (column) => column);

  GeneratedColumn<String> get syncState =>
      $composableBuilder(column: $table.syncState, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);
}

class $$DraftEntriesTableTableManager extends RootTableManager<
    _$DraftDatabase,
    $DraftEntriesTable,
    DraftEntry,
    $$DraftEntriesTableFilterComposer,
    $$DraftEntriesTableOrderingComposer,
    $$DraftEntriesTableAnnotationComposer,
    $$DraftEntriesTableCreateCompanionBuilder,
    $$DraftEntriesTableUpdateCompanionBuilder,
    (
      DraftEntry,
      BaseReferences<_$DraftDatabase, $DraftEntriesTable, DraftEntry>
    ),
    DraftEntry,
    PrefetchHooks Function()> {
  $$DraftEntriesTableTableManager(_$DraftDatabase db, $DraftEntriesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DraftEntriesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DraftEntriesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DraftEntriesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<int> id = const Value.absent(),
            Value<String> type = const Value.absent(),
            Value<String> title = const Value.absent(),
            Value<String> payload = const Value.absent(),
            Value<DateTime> createdAt = const Value.absent(),
            Value<DateTime?> syncedAt = const Value.absent(),
            Value<String?> ownerKey = const Value.absent(),
            Value<String?> operationId = const Value.absent(),
            Value<String?> serverId = const Value.absent(),
            Value<String> syncState = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<int> attempts = const Value.absent(),
          }) =>
              DraftEntriesCompanion(
            id: id,
            type: type,
            title: title,
            payload: payload,
            createdAt: createdAt,
            syncedAt: syncedAt,
            ownerKey: ownerKey,
            operationId: operationId,
            serverId: serverId,
            syncState: syncState,
            lastError: lastError,
            attempts: attempts,
          ),
          createCompanionCallback: ({
            Value<int> id = const Value.absent(),
            required String type,
            required String title,
            required String payload,
            required DateTime createdAt,
            Value<DateTime?> syncedAt = const Value.absent(),
            Value<String?> ownerKey = const Value.absent(),
            Value<String?> operationId = const Value.absent(),
            Value<String?> serverId = const Value.absent(),
            Value<String> syncState = const Value.absent(),
            Value<String?> lastError = const Value.absent(),
            Value<int> attempts = const Value.absent(),
          }) =>
              DraftEntriesCompanion.insert(
            id: id,
            type: type,
            title: title,
            payload: payload,
            createdAt: createdAt,
            syncedAt: syncedAt,
            ownerKey: ownerKey,
            operationId: operationId,
            serverId: serverId,
            syncState: syncState,
            lastError: lastError,
            attempts: attempts,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$DraftEntriesTableProcessedTableManager = ProcessedTableManager<
    _$DraftDatabase,
    $DraftEntriesTable,
    DraftEntry,
    $$DraftEntriesTableFilterComposer,
    $$DraftEntriesTableOrderingComposer,
    $$DraftEntriesTableAnnotationComposer,
    $$DraftEntriesTableCreateCompanionBuilder,
    $$DraftEntriesTableUpdateCompanionBuilder,
    (
      DraftEntry,
      BaseReferences<_$DraftDatabase, $DraftEntriesTable, DraftEntry>
    ),
    DraftEntry,
    PrefetchHooks Function()>;

class $DraftDatabaseManager {
  final _$DraftDatabase _db;
  $DraftDatabaseManager(this._db);
  $$DraftEntriesTableTableManager get draftEntries =>
      $$DraftEntriesTableTableManager(_db, _db.draftEntries);
}
