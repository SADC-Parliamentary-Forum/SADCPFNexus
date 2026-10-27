import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/offline/draft_sync_engine.dart';

class _Call {
  _Call(this.path, this.key);
  final String path;
  final String key;
}

/// Scripted transport: each POST pops the next response (or throws it).
class _FakeTransport implements DraftSyncTransport {
  _FakeTransport(this.script);

  final List<Object?> script;
  final calls = <_Call>[];

  @override
  Future<Map<String, dynamic>?> post(String path, Map<String, dynamic>? body,
      {required String idempotencyKey}) async {
    calls.add(_Call(path, idempotencyKey));
    final next = script.removeAt(0);
    if (next is Exception) throw next;
    return next as Map<String, dynamic>?;
  }
}

class _FakeStore implements DraftSyncStore {
  final created = <int, String>{};
  final errors = <int, String>{};
  final completed = <int>{};

  @override
  Future<void> markCreated(int draftId, String serverId) async => created[draftId] = serverId;

  @override
  Future<void> markFailed(int draftId, String error) async => errors[draftId] = error;

  @override
  Future<void> complete(int draftId) async => completed.add(draftId);
}

const _offline = DraftSyncHttpException('No connection to the server. The draft will resume on the next sync.');

/// Overtime claims are created then submitted (two server calls).
SyncDraft _overtime({String? serverId}) => SyncDraft(
      id: 7,
      type: 'overtime_claim',
      payload: jsonEncode({'week_start': '2026-10-19', 'hours': 6}),
      operationId: 'op-123',
      serverId: serverId,
    );

void main() {
  group('resumable two-step sync', () {
    test('network failure after creation keeps the server id and resumes at submit', () async {
      final store = _FakeStore();

      // Run 1: create succeeds, submit fails offline.
      final first = DraftSyncEngine(
        transport: _FakeTransport([
          {'data': {'id': 42}},
          _offline,
        ]),
        store: store,
      );
      expect(await first.syncOne(_overtime()), isFalse);
      expect(store.created[7], '42');
      expect(store.completed, isEmpty);
      expect(store.errors[7], contains('No connection'));

      // Run 2 (draft reloaded with its persisted server id): no second create.
      final transport = _FakeTransport([
        {'data': {'id': 42, 'status': 'submitted'}},
      ]);
      final second = DraftSyncEngine(transport: transport, store: store);
      expect(await second.syncOne(_overtime(serverId: store.created[7])), isTrue);
      expect(transport.calls.map((c) => c.path), ['/hr/timesheets/42/submit']);
      expect(transport.calls.single.key, 'op-123:submit');
      expect(store.completed, {7});
    });

    test('a lost create response is retried with the same idempotency key', () async {
      final store = _FakeStore();
      final transport = _FakeTransport([
        _offline, // response lost — the server may already have created it
        {'data': {'id': 42}}, // server replays the stored response for the key
        {'data': {'id': 42}},
      ]);
      final engine = DraftSyncEngine(transport: transport, store: store);

      expect(await engine.syncOne(_overtime()), isFalse);
      expect(store.created, isEmpty);
      expect(await engine.syncOne(_overtime()), isTrue);

      final createKeys = transport.calls.where((c) => c.path == '/hr/timesheets').map((c) => c.key);
      expect(createKeys, ['op-123:create', 'op-123:create']);
      expect(store.completed, {7});
    });

    test('single-step drafts complete without a submit call', () async {
      final store = _FakeStore();
      final transport = _FakeTransport([
        {'data': {'id': 9}},
      ]);
      final ok = await DraftSyncEngine(transport: transport, store: store).syncOne(
        SyncDraft(id: 1, type: 'leave', payload: jsonEncode({'leave_type': 'annual'}), operationId: 'op-l'),
      );
      expect(ok, isTrue);
      expect(transport.calls.single.key, 'op-l:create');
    });

    test('validation errors are preserved per draft for correction', () async {
      final store = _FakeStore();
      final engine = DraftSyncEngine(
        transport: _FakeTransport([
          const DraftSyncHttpException('Needs correction: The amount field is required.', statusCode: 422),
        ]),
        store: store,
      );
      expect(await engine.syncOne(_overtime()), isFalse);
      expect(store.errors[7], 'Needs correction: The amount field is required.');
    });

    test('unreadable payloads and unsupported types fail with a reason, not silently', () async {
      final store = _FakeStore();
      final engine = DraftSyncEngine(transport: _FakeTransport([]), store: store);
      await engine.syncOne(const SyncDraft(id: 1, type: 'leave', payload: 'not json'));
      await engine.syncOne(SyncDraft(id: 2, type: 'mystery', payload: jsonEncode({})));
      expect(store.errors[1], contains('unreadable'));
      expect(store.errors[2], contains('cannot be synced'));
    });

    test('consent-gated types (salary advance, PIF) are created but never auto-submitted', () async {
      for (final type in ['salary_advance', 'pif']) {
        final store = _FakeStore();
        final transport = _FakeTransport([
          {'data': {'id': 5}},
        ]);
        final ok = await DraftSyncEngine(transport: transport, store: store).syncOne(
          SyncDraft(id: 3, type: type, payload: jsonEncode({'purpose': 'Education', 'amount': 10}), operationId: 'op-c'),
        );
        expect(ok, isTrue, reason: type);
        expect(transport.calls.length, 1, reason: '$type must not call /submit');
      }
    });

    test('syncAll reports per-draft outcome counts', () async {
      final store = _FakeStore();
      final engine = DraftSyncEngine(
        transport: _FakeTransport([
          {'data': {'id': 1}},
          _offline,
        ]),
        store: store,
      );
      final outcome = await engine.syncAll([
        SyncDraft(id: 1, type: 'leave', payload: jsonEncode({}), operationId: 'a'),
        SyncDraft(id: 2, type: 'leave', payload: jsonEncode({}), operationId: 'b'),
      ]);
      expect(outcome.synced, 1);
      expect(outcome.failed, 1);
    });
  });

  group('draft ownership', () {
    test('owner key binds tenant and user', () {
      expect(draftOwnerKey({'id': 5, 'tenant_id': 2}), '2:5');
      expect(draftOwnerKey({'id': 5, 'tenant_id': 3}), isNot(draftOwnerKey({'id': 5, 'tenant_id': 2})));
      expect(draftOwnerKey({'id': 6, 'tenant_id': 2}), isNot(draftOwnerKey({'id': 5, 'tenant_id': 2})));
    });

    test('no signed-in account means no owner (drafts are not saved)', () {
      expect(draftOwnerKey(null), isNull);
      expect(draftOwnerKey({'name': 'no id'}), isNull);
    });

    test('operation ids are unique v4 UUIDs', () {
      final a = newDraftOperationId();
      final b = newDraftOperationId();
      expect(a, isNot(b));
      expect(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$').hasMatch(a), isTrue);
    });
  });
}
