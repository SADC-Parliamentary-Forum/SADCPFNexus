import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../auth/auth_storage.dart';
import '../config/api_config.dart';

class ApiClient {
  /// Base URL from api_config (dart-define or default). Not hardcoded.
  static String get kApiBaseUrl => apiBaseUrl;

  ApiClient({
    required AuthStorage authStorage,
    required VoidCallback onUnauthorized,
    String? baseUrl,
  })  : _authStorage = authStorage,
        _onUnauthorized = onUnauthorized,
        _dio = Dio(BaseOptions(
          baseUrl: baseUrl ?? apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          sendTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authStorage.getToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await _authStorage.clear();
          _onUnauthorized();
        }
        return handler.next(error);
      },
    ));
  }

  final AuthStorage _authStorage;
  final VoidCallback _onUnauthorized;
  final Dio _dio;

  Dio get dio => _dio;
}
