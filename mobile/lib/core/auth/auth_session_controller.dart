import 'package:flutter/foundation.dart';

import 'auth_repository.dart';

enum AuthSessionStatus { unknown, authenticated, unauthenticated }

class AuthSessionState {
  const AuthSessionState._({
    required this.status,
    this.user,
    this.isStale = false,
  });

  final AuthSessionStatus status;
  final Map<String, dynamic>? user;
  final bool isStale;

  const AuthSessionState.unknown()
      : this._(status: AuthSessionStatus.unknown);

  const AuthSessionState.unauthenticated()
      : this._(status: AuthSessionStatus.unauthenticated);

  factory AuthSessionState.authenticated({
    Map<String, dynamic>? user,
    bool isStale = false,
  }) {
    return AuthSessionState._(
      status: AuthSessionStatus.authenticated,
      user: user,
      isStale: isStale,
    );
  }

  bool get isAuthenticated => status == AuthSessionStatus.authenticated;

  List<String> get permissions {
    final values = user?['permissions'];
    if (values is List) {
      return values
          .map((value) => value?.toString() ?? '')
          .where((value) => value.isNotEmpty)
          .toList();
    }
    return const <String>[];
  }

  List<String> get roles {
    final values = user?['roles'];
    if (values is List) {
      return values
          .map((value) => value?.toString() ?? '')
          .where((value) => value.isNotEmpty)
          .toList();
    }
    return const <String>[];
  }
}

class AuthSessionController extends ChangeNotifier {
  AuthSessionController({required AuthRepository repository})
      : _repository = repository {
    bootstrap();
  }

  final AuthRepository _repository;

  AuthSessionState _state = const AuthSessionState.unknown();
  bool _isBootstrapping = false;

  AuthSessionState get state => _state;

  Future<void> bootstrap() async {
    if (_isBootstrapping) {
      return;
    }
    _isBootstrapping = true;
    _setState(const AuthSessionState.unknown());
    final restored = await _repository.restoreSession();
    if (restored.isAuthenticated) {
      _setState(
        AuthSessionState.authenticated(
          user: restored.user,
          isStale: restored.isStale,
        ),
      );
    } else {
      _setState(const AuthSessionState.unauthenticated());
    }
    _isBootstrapping = false;
  }

  Future<AuthResult> login(
    String email,
    String password, {
    bool rememberMe = true,
    String? code,
  }) async {
    final result = await _repository.login(
      email,
      password,
      rememberMe: rememberMe,
      code: code,
    );
    if (!result.isSuccess) {
      return result;
    }

    final user = result.user;
    Map<String, dynamic>? userMap;
    if (user is Map<String, dynamic>) {
      userMap = user;
    } else if (user is Map) {
      userMap = Map<String, dynamic>.from(user);
    } else {
      userMap = await _repository.getStoredUserMap();
    }

    _setState(AuthSessionState.authenticated(user: userMap));
    return result;
  }

  Future<void> logout() async {
    await _repository.logout();
    _setState(const AuthSessionState.unauthenticated());
  }

  Future<void> handleUnauthorized() async {
    await _repository.clearSession();
    _setState(const AuthSessionState.unauthenticated());
  }

  void _setState(AuthSessionState nextState) {
    _state = nextState;
    notifyListeners();
  }
}
