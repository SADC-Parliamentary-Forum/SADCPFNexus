import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/auth/auth_result.dart';

void main() {
  group('AuthResult MFA path', () {
    test('mfaPending is not success and sets mfaRequired', () {
      final result = AuthResult.mfaPending();
      expect(result.mfaRequired, isTrue);
      expect(result.isSuccess, isFalse);
      expect(result.error, isNull);
    });

    test('success clears mfaRequired', () {
      final result = AuthResult.success(user: {'email': 'a@b.c'});
      expect(result.mfaRequired, isFalse);
      expect(result.isSuccess, isTrue);
      expect(result.user['email'], 'a@b.c');
    });

    test('failure is not MFA pending', () {
      final result = AuthResult.failure('Invalid email or password.');
      expect(result.mfaRequired, isFalse);
      expect(result.isSuccess, isFalse);
      expect(result.error, contains('Invalid'));
    });
  });

  group('AuthBootstrapResult', () {
    test('unauthenticated bootstrap', () {
      const result = AuthBootstrapResult.unauthenticated();
      expect(result.isAuthenticated, isFalse);
      expect(result.isStale, isFalse);
    });

    test('stale authenticated session keeps cached user', () {
      final result = AuthBootstrapResult.authenticated(
        user: {'id': 1},
        isStale: true,
      );
      expect(result.isAuthenticated, isTrue);
      expect(result.isStale, isTrue);
      expect(result.user?['id'], 1);
    });
  });
}
