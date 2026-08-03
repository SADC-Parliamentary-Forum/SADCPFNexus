import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/auth/auth_storage.dart';
import 'package:sadcpf_nexus/core/network/api_client.dart';
import 'package:sadcpf_nexus/features/assignments/presentation/screens/assignments_list_screen.dart';
import 'package:sadcpf_nexus/features/risk/presentation/screens/risk_register_screen.dart';
import 'package:sadcpf_nexus/features/stock/presentation/screens/stock_scan_screen.dart';

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

  testWidgets('AssignmentsListScreen smoke', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_fastFailApiClient()),
        ],
        child: const MaterialApp(home: AssignmentsListScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Accountability'), findsOneWidget);
  });

  testWidgets('RiskRegisterScreen smoke', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_fastFailApiClient()),
        ],
        child: const MaterialApp(home: RiskRegisterScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Risk register'), findsOneWidget);
  });

  testWidgets('StockScanScreen smoke', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_fastFailApiClient()),
        ],
        child: const MaterialApp(home: StockScanScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Stock scan'), findsOneWidget);
    expect(find.text('Lookup barcode'), findsOneWidget);
    expect(find.text('Draft stocktake queue'), findsOneWidget);
  });
}
