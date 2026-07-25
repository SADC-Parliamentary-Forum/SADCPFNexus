import 'dart:convert';

import 'package:dio/dio.dart';
import 'auth_result.dart';
import 'auth_storage.dart';
import '../network/api_client.dart';

export 'auth_result.dart';

class AuthRepository {
  AuthRepository({required ApiClient apiClient, required AuthStorage storage})
      : _dio = apiClient.dio,
        _storage = storage;

  final Dio _dio;
  final AuthStorage _storage;

  Future<AuthResult> login(
    String email,
    String password, {
    bool rememberMe = true,
    String? code,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
          if (code != null && code.isNotEmpty) 'code': code,
          'client_type': 'mobile',
          'device_name': 'mobile',
        },
      );
      final data = response.data;
      if (data == null) throw Exception('Invalid response');
      if (data['mfa_required'] == true) {
        return AuthResult.mfaPending();
      }
      final token = data['token'] as String?;
      final user = data['user'];
      if (token == null || token.isEmpty) throw Exception('No token received');
      String? jsonStr;
      if (user != null) {
        jsonStr = user is Map
            ? jsonEncode(Map<String, dynamic>.from(user))
            : user.toString();
      }
      await _storage.saveSession(
        token: token,
        userJson: jsonStr,
        rememberMe: rememberMe,
      );
      return AuthResult.success(user: user);
    } on DioException catch (e) {
      if (e.response?.statusCode == 422 || e.response?.statusCode == 401) {
        return AuthResult.failure('Invalid email or password.');
      }
      return AuthResult.failure(_networkErrorMessage(e));
    } catch (e) {
      final msg = e.toString();
      final isNetwork = msg.contains('SocketException') ||
          msg.contains('Connection') ||
          msg.contains('XMLHttpRequest') ||
          msg.contains('onError') ||
          msg.contains('network');
      return AuthResult.failure(
        isNetwork ? 'Cannot reach server. Check that the API is running and the app is using the correct API URL.' : 'Login failed. Please try again.',
      );
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {}
    await _storage.clear();
  }

  Future<void> clearSession() => _storage.clear();

  Future<Map<String, dynamic>?> getStoredUserMap() => _storage.getUserMap();

  Future<AuthBootstrapResult> restoreSession() async {
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      return const AuthBootstrapResult.unauthenticated();
    }

    final cachedUser = await _storage.getUserMap();

    try {
      final response = await _dio.get<Map<String, dynamic>>('/auth/me');
      final user = response.data;
      if (user == null) {
        return AuthBootstrapResult.authenticated(user: cachedUser);
      }
      await _storage.setUserJson(
        jsonEncode(user),
        rememberMe: !(await _storage.isSessionOnlyActive()),
      );
      return AuthBootstrapResult.authenticated(user: user);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await _storage.clear();
        return const AuthBootstrapResult.unauthenticated();
      }
      return AuthBootstrapResult.authenticated(user: cachedUser, isStale: true);
    } catch (_) {
      return AuthBootstrapResult.authenticated(user: cachedUser, isStale: true);
    }
  }

  Future<String?> getStoredUserEmail() async {
    final jsonStr = await _storage.getUserJson();
    if (jsonStr == null) return null;
    try {
      final map = jsonDecode(jsonStr) as Map<String, dynamic>?;
      return map?['email'] as String?;
    } catch (_) {
      return null;
    }
  }

  Future<String?> getStoredUserName() async {
    final jsonStr = await _storage.getUserJson();
    if (jsonStr == null) return null;
    try {
      final map = jsonDecode(jsonStr) as Map<String, dynamic>?;
      return map?['name'] as String?;
    } catch (_) {
      return null;
    }
  }

  /// Stored user permissions from login/me (empty if none).
  Future<List<String>> getStoredPermissions() async {
    final jsonStr = await _storage.getUserJson();
    if (jsonStr == null) return [];
    try {
      final map = jsonDecode(jsonStr) as Map<String, dynamic>?;
      final list = map?['permissions'];
      if (list is List) {
        return list.map((e) => e?.toString() ?? '').where((s) => s.isNotEmpty).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Stored user role names from login/me (empty if none).
  Future<List<String>> getStoredRoles() async {
    final jsonStr = await _storage.getUserJson();
    if (jsonStr == null) return [];
    try {
      final map = jsonDecode(jsonStr) as Map<String, dynamic>?;
      final list = map?['roles'];
      if (list is List) {
        return list.map((e) => e?.toString() ?? '').where((s) => s.isNotEmpty).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}

/// Returns a user-friendly message for connection/network errors and timeouts.
String _networkErrorMessage(DioException e) {
  final msg = (e.message ?? e.type.name).toLowerCase();
  final isTimeout = e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout ||
      e.type == DioExceptionType.connectionTimeout ||
      msg.contains('timeout') ||
      msg.contains('aborted');
  if (isTimeout) {
    return 'Request timed out — the server did not respond in time. '
        'Ensure the backend is running (docker compose up) and try again.';
  }
  if (e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.unknown ||
      msg.contains('xmlhttprequest') ||
      msg.contains('connection') ||
      msg.contains('network') ||
      msg.contains('onerror')) {
    return 'Cannot reach the server. '
        'Ensure the backend is running on port 8000 and try again.';
  }
  return e.message ?? 'Login failed. Please try again.';
}
