import 'dart:convert';

import 'package:dio/dio.dart';
import 'auth_storage.dart';
import '../network/api_client.dart';

class AuthRepository {
  AuthRepository({required ApiClient apiClient, required AuthStorage storage})
      : _dio = apiClient.dio,
        _storage = storage;

  final Dio _dio;
  final AuthStorage _storage;

  Future<AuthResult> login(String email, String password) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {
          'email': email,
          'password': password,
          'device_name': 'mobile',
        },
      );
      final data = response.data;
      if (data == null) throw Exception('Invalid response');
      final token = data['token'] as String?;
      final user = data['user'];
      if (token == null || token.isEmpty) throw Exception('No token received');
      await _storage.setToken(token);
      if (user != null) {
        final jsonStr = user is Map ? jsonEncode(Map<String, dynamic>.from(user)) : user.toString();
        await _storage.setUserJson(jsonStr);
      }
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
    return 'The request timed out. Check that the API is running and try again.';
  }
  if (e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.unknown ||
      msg.contains('xmlhttprequest') ||
      msg.contains('connection') ||
      msg.contains('network') ||
      msg.contains('onerror')) {
    return 'Cannot reach server. Check that the API is running and the app is using the correct API URL.';
  }
  return e.message ?? 'Login failed. Please try again.';
}

class AuthResult {
  const AuthResult._({this.user, this.error});
  final dynamic user;
  final String? error;

  factory AuthResult.success({dynamic user}) => AuthResult._(user: user);
  factory AuthResult.failure(String message) => AuthResult._(error: message);

  bool get isSuccess => error == null;
}
