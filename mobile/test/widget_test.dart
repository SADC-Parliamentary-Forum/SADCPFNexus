import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/auth/auth_repository.dart';
import 'package:sadcpf_nexus/core/auth/auth_session_controller.dart';
import 'package:sadcpf_nexus/core/auth/auth_storage.dart';
import 'package:sadcpf_nexus/core/network/api_client.dart';
import 'package:sadcpf_nexus/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MemoryAuthStorage extends AuthStorage {
  @override
  Future<String?> getToken() async => null;

  @override
  Future<void> clear() async {}

  @override
  Future<bool> isSessionOnlyActive() async => false;
}

class _UnauthRepository extends AuthRepository {
  _UnauthRepository(AuthStorage storage)
      : super(
          apiClient: ApiClient(authStorage: storage, onUnauthorized: () {}),
          storage: storage,
        );

  @override
  Future<AuthBootstrapResult> restoreSession() async {
    return const AuthBootstrapResult.unauthenticated();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('App loads and shows login or dashboard', (WidgetTester tester) async {
    final storage = _MemoryAuthStorage();
    final repository = _UnauthRepository(storage);
    final session = AuthSessionController(repository: repository);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStorageProvider.overrideWithValue(storage),
          authRepositoryProvider.overrideWithValue(repository),
          authSessionControllerProvider.overrideWithValue(session),
        ],
        child: const SADCPFNexusApp(),
      ),
    );

    // Splash animation is 600ms; bootstrap is immediate (unauthenticated).
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));

    final signIn = find.text('Sign In');
    final dashboard = find.text('Home');
    final splash = find.text('SADCPFNexus');
    expect(
      signIn.evaluate().isNotEmpty ||
          dashboard.evaluate().isNotEmpty ||
          splash.evaluate().isNotEmpty,
      isTrue,
    );
  });
}
