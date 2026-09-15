import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/auth/auth_storage.dart';
import 'package:sadcpf_nexus/core/network/api_client.dart';
import 'package:sadcpf_nexus/features/assets/presentation/screens/asset_scan_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MemoryAuthStorage extends AuthStorage {
  @override
  Future<String?> getToken() async => null;

  @override
  Future<void> clear() async {}
}

ApiClient _client({required bool authenticatedHit}) {
  final client = ApiClient(
    authStorage: _MemoryAuthStorage(),
    onUnauthorized: () {},
  );
  client.dio.interceptors.insert(
    0,
    InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path.contains('/assets/qr/')) {
          if (authenticatedHit) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'id': 12,
                    'asset_tag': 'PF/ICT/LT/001',
                    'name': 'ThinkPad',
                  },
                },
              ),
            );
            return;
          }
          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.badResponse,
              response: Response(requestOptions: options, statusCode: 401),
            ),
          );
          return;
        }
        if (options.path.contains('/public/assets/')) {
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': {
                  'assetNumber': 'PF/ICT/LT/001',
                  'asset_name': 'ThinkPad',
                  'publicStatus': 'REGISTERED',
                  'notice': 'Property of SADC PF',
                },
              },
            ),
          );
          return;
        }
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

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('authenticated scan shows register fields', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_client(authenticatedHit: true)),
        ],
        child: const MaterialApp(home: AssetScanScreen()),
      ),
    );
    await tester.pump();
    expect(find.text('Scan Asset'), findsWidgets);
    await tester.enterText(find.byType(TextField).first, 'AbCdEfGhIjKlMnOpQrStUvWx');
    await tester.tap(find.text('Look up'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('PF/ICT/LT/001'), findsOneWidget);
    expect(find.text('Open register'), findsOneWidget);
  });

  testWidgets('guest scan falls back to the public payload', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_client(authenticatedHit: false)),
        ],
        child: const MaterialApp(home: AssetScanScreen()),
      ),
    );
    await tester.pump();
    await tester.enterText(find.byType(TextField).first, 'https://nexus.sadcpf.org/a/AbCdEfGhIjKlMnOpQrStUvWx');
    await tester.tap(find.text('Look up'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('PF/ICT/LT/001'), findsOneWidget);
    expect(find.text('Property of SADC PF'), findsOneWidget);
    expect(find.text('Open register'), findsNothing);
  });
}
