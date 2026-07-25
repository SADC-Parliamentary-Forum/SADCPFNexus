import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/auth/auth_repository.dart';
import 'package:sadcpf_nexus/core/auth/auth_session_controller.dart';
import 'package:sadcpf_nexus/core/auth/auth_storage.dart';
import 'package:sadcpf_nexus/core/network/api_client.dart';
import 'package:sadcpf_nexus/features/auth/presentation/screens/login_screen.dart';

/// In-memory storage so widget tests never touch platform secure storage.
class _MemoryAuthStorage extends AuthStorage {
  final Map<String, String> _data = {};

  @override
  Future<String?> getToken() async => _data['token'];

  @override
  Future<void> setToken(String token, {bool rememberMe = true}) async {
    _data['token'] = token;
  }

  @override
  Future<String?> getUserJson() async => _data['user'];

  @override
  Future<void> setUserJson(String json, {bool rememberMe = true}) async {
    _data['user'] = json;
  }

  @override
  Future<void> clear() async => _data.clear();

  @override
  Future<void> saveSession({
    required String token,
    String? userJson,
    required bool rememberMe,
  }) async {
    _data['token'] = token;
    if (userJson != null) _data['user'] = userJson;
  }

  @override
  Future<bool> isSessionOnlyActive() async => false;
}

class _ScriptedAuthRepository extends AuthRepository {
  _ScriptedAuthRepository({
    required AuthStorage storage,
    required this.onLogin,
  }) : super(
          apiClient: ApiClient(authStorage: storage, onUnauthorized: () {}),
          storage: storage,
        );

  final Future<AuthResult> Function(
    String email,
    String password, {
    bool rememberMe,
    String? code,
  }) onLogin;

  @override
  Future<AuthResult> login(
    String email,
    String password, {
    bool rememberMe = true,
    String? code,
  }) {
    return onLogin(email, password, rememberMe: rememberMe, code: code);
  }

  @override
  Future<AuthBootstrapResult> restoreSession() async {
    return const AuthBootstrapResult.unauthenticated();
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Future<void> pumpLogin(
    WidgetTester tester, {
    required Future<AuthResult> Function(
      String email,
      String password, {
      bool rememberMe,
      String? code,
    }) onLogin,
  }) async {
    final storage = _MemoryAuthStorage();
    final repository =
        _ScriptedAuthRepository(storage: storage, onLogin: onLogin);
    final session = AuthSessionController(repository: repository);

    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStorageProvider.overrideWithValue(storage),
          authRepositoryProvider.overrideWithValue(repository),
          authSessionControllerProvider.overrideWithValue(session),
        ],
        child: const MaterialApp(home: LoginScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> submitCredentials(WidgetTester tester) async {
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), 'user@sadcpf.org');
    await tester.enterText(fields.at(1), 'password123');
    final signInButton = find.widgetWithText(ElevatedButton, 'Sign In');
    await tester.ensureVisible(signInButton);
    await tester.tap(signInButton);
    await tester.pumpAndSettle();
  }

  group('LoginScreen MFA required UI', () {
    testWidgets('shows TOTP step when login returns mfaRequired', (tester) async {
      await pumpLogin(
        tester,
        onLogin: (email, password, {rememberMe = true, code}) async {
          if (code == null || code.isEmpty) {
            return AuthResult.mfaPending();
          }
          return AuthResult.success(user: {'email': email});
        },
      );

      expect(find.widgetWithText(ElevatedButton, 'Sign In'), findsOneWidget);

      await submitCredentials(tester);

      expect(find.text('Two-Factor Authentication'), findsOneWidget);
      expect(
        find.text(
          'Enter the 6-digit code from your authenticator app to continue.',
        ),
        findsOneWidget,
      );
      expect(find.text('Verify Code'), findsOneWidget);
      expect(find.text('Back to Sign In'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Sign In'), findsNothing);
    });

    testWidgets('shows error on invalid TOTP and allows back to sign-in',
        (tester) async {
      await pumpLogin(
        tester,
        onLogin: (email, password, {rememberMe = true, code}) async {
          if (code == null || code.isEmpty) {
            return AuthResult.mfaPending();
          }
          return AuthResult.failure('Invalid authentication code.');
        },
      );

      await submitCredentials(tester);
      expect(find.text('Two-Factor Authentication'), findsOneWidget);

      // MFA step uses a single TextField (not TextFormField).
      await tester.enterText(find.byType(TextField), '123456');
      await tester.pump();
      final verify = find.widgetWithText(ElevatedButton, 'Verify Code');
      await tester.ensureVisible(verify);
      await tester.tap(verify);
      await tester.pumpAndSettle();

      expect(find.text('Invalid authentication code.'), findsOneWidget);

      await tester.tap(find.text('Back to Sign In'));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(ElevatedButton, 'Sign In'), findsOneWidget);
      expect(find.text('Two-Factor Authentication'), findsNothing);
    });
  });
}
