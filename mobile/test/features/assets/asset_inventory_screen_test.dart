import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/auth/auth_storage.dart';
import 'package:sadcpf_nexus/core/network/api_client.dart';
import 'package:sadcpf_nexus/features/assets/presentation/screens/asset_inventory_screen.dart';
import 'package:sadcpf_nexus/features/assets/presentation/screens/asset_request_screen.dart';

class _MemoryAuthStorage extends AuthStorage {
  @override
  Future<String?> getToken() async => null;

  @override
  Future<void> clear() async {}
}

ApiClient _emptyInventoryApiClient() {
  final client = ApiClient(
    authStorage: _MemoryAuthStorage(),
    onUnauthorized: () {},
  );
  client.dio.interceptors.insert(
    0,
    InterceptorsWrapper(
      onRequest: (options, handler) {
        handler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 200,
            data: {'data': <Map<String, dynamic>>[]},
          ),
        );
      },
    ),
  );
  return client;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Storekeeper reorder action opens a prefilled asset request',
      (tester) async {
    final router = GoRouter(
      initialLocation: '/assets',
      routes: [
        GoRoute(
          path: '/assets',
          builder: (context, state) => const AssetInventoryScreen(),
        ),
        GoRoute(
          path: '/assets/request',
          builder: (context, state) {
            final extra = state.extra is Map<String, dynamic>
                ? state.extra as Map<String, dynamic>
                : null;
            final itemName = extra?['itemName'] as String?;
            return AssetRequestScreen(
              initialJustification: itemName == null
                  ? null
                  : 'Request stock reorder for ${itemName.trim()}.',
            );
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_emptyInventoryApiClient()),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Reorder').first);
    await tester.pump();

    expect(
      find.text('Reorder request started for Printer Toner (BK).'),
      findsOneWidget,
    );

    await tester.pumpAndSettle();
    expect(find.text('Request Asset'), findsOneWidget);
    expect(
      find.text('Request stock reorder for Printer Toner (BK).'),
      findsOneWidget,
    );
  });
}
