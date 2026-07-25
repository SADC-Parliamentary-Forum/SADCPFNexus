import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/auth/auth_storage.dart';
import 'package:sadcpf_nexus/core/cache/cache_provider.dart';
import 'package:sadcpf_nexus/core/cache/cache_service.dart';
import 'package:sadcpf_nexus/core/network/api_client.dart';
import 'package:sadcpf_nexus/features/approvals/presentation/screens/approvals_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MemoryAuthStorage extends AuthStorage {
  @override
  Future<String?> getToken() async => null;

  @override
  Future<void> clear() async {}
}

ApiClient _fastFailApiClient() {
  final client = ApiClient(
    authStorage: _MemoryAuthStorage(),
    onUnauthorized: () {},
  );
  client.dio.options
    ..connectTimeout = const Duration(milliseconds: 100)
    ..receiveTimeout = const Duration(milliseconds: 100);
  client.dio.interceptors.insert(
    0,
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.reject(
          DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
            message: 'offline',
          ),
        );
      },
    ),
  );
  return client;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ApprovalsScreen smoke', () {
    testWidgets('renders pending list from cache with filters', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final cache = CacheService();
      await cache.init();
      await cache.set(
        'approvals_pending_combined',
        [
          {
            'id': 42,
            'type': 'Travel',
            'reference_number': 'TR-2026-001',
            'purpose': 'Lusaka plenary',
            'submitted_at': '2026-07-01T10:00:00Z',
          },
          {
            'id': 7,
            'type': 'Leave',
            'reference_number': 'LV-2026-014',
            'reason': 'Annual leave',
            'submitted_at': '2026-07-02T09:00:00Z',
          },
        ],
        ttl: const Duration(hours: 1),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            cacheServiceProvider.overrideWithValue(cache),
            apiClientProvider.overrideWithValue(_fastFailApiClient()),
          ],
          child: const MaterialApp(home: ApprovalsScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pending Approvals'), findsOneWidget);
      expect(find.text('Review and action requests'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Travel'), findsWidgets);
      expect(find.text('Leave'), findsWidgets);
      expect(find.text('TR-2026-001'), findsOneWidget);
      expect(find.text('Lusaka plenary'), findsOneWidget);
      expect(find.text('LV-2026-014'), findsOneWidget);
      expect(find.textContaining('pending'), findsOneWidget);

      // Filter smoke: Leave only.
      await tester.tap(find.text('Leave').first);
      await tester.pumpAndSettle();
      expect(find.text('LV-2026-014'), findsOneWidget);
      expect(find.text('TR-2026-001'), findsNothing);
    });

    testWidgets('empty cache list shows all-caught-up state', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final cache = CacheService();
      await cache.init();
      await cache.set(
        'approvals_pending_combined',
        <dynamic>[],
        ttl: const Duration(hours: 1),
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            cacheServiceProvider.overrideWithValue(cache),
            apiClientProvider.overrideWithValue(_fastFailApiClient()),
          ],
          child: const MaterialApp(home: ApprovalsScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pending Approvals'), findsOneWidget);
      expect(find.text('All caught up!'), findsOneWidget);
      expect(find.text('No pending approvals at this time.'), findsOneWidget);
    });
  });
}
