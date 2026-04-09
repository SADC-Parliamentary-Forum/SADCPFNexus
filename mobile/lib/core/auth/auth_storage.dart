import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'browser_storage_stub.dart'
    if (dart.library.html) 'browser_storage_web.dart' as browser_storage;

const _kTokenKey = 'sadcpf_token';
const _kUserKey = 'sadcpf_user';

class AuthStorage {
  AuthStorage()
      : _storage = kIsWeb
            ? const FlutterSecureStorage()
            : const FlutterSecureStorage(
                aOptions: AndroidOptions(encryptedSharedPreferences: true),
              );

  final FlutterSecureStorage _storage;
  static final Map<String, String> _sessionCache = <String, String>{};

  Future<String?> getToken() => _readValue(_kTokenKey);

  Future<void> setToken(String token, {bool rememberMe = true}) =>
      _writeValue(_kTokenKey, token, rememberMe: rememberMe);

  Future<String?> getUserJson() => _readValue(_kUserKey);

  Future<void> setUserJson(String json, {bool rememberMe = true}) =>
      _writeValue(_kUserKey, json, rememberMe: rememberMe);

  Future<Map<String, dynamic>?> getUserMap() async {
    final jsonStr = await getUserJson();
    if (jsonStr == null || jsonStr.isEmpty) {
      return null;
    }
    try {
      final decoded = jsonDecode(jsonStr);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}
    return null;
  }

  Future<void> saveSession({
    required String token,
    String? userJson,
    required bool rememberMe,
  }) async {
    await clear();
    await setToken(token, rememberMe: rememberMe);
    if (userJson != null && userJson.isNotEmpty) {
      await setUserJson(userJson, rememberMe: rememberMe);
    }
  }

  Future<bool> isSessionOnlyActive() async {
    final sessionToken = _readSessionOnly(_kTokenKey);
    return sessionToken != null && sessionToken.isNotEmpty;
  }

  Future<void> clear() async {
    await _deletePersistent(_kTokenKey);
    await _deletePersistent(_kUserKey);
    _deleteSessionOnly(_kTokenKey);
    _deleteSessionOnly(_kUserKey);
  }

  Future<String?> _readValue(String key) async {
    final sessionValue = _readSessionOnly(key);
    if (sessionValue != null && sessionValue.isNotEmpty) {
      return sessionValue;
    }
    return _readPersistent(key);
  }

  Future<void> _writeValue(
    String key,
    String value, {
    required bool rememberMe,
  }) async {
    if (rememberMe) {
      _deleteSessionOnly(key);
      await _writePersistent(key, value);
      return;
    }
    await _deletePersistent(key);
    _writeSessionOnly(key, value);
  }

  String? _readSessionOnly(String key) {
    if (kIsWeb) {
      return browser_storage.readSessionValue(key);
    }
    return _sessionCache[key];
  }

  void _writeSessionOnly(String key, String value) {
    if (kIsWeb) {
      browser_storage.writeSessionValue(key, value);
      return;
    }
    _sessionCache[key] = value;
  }

  void _deleteSessionOnly(String key) {
    if (kIsWeb) {
      browser_storage.deleteSessionValue(key);
      return;
    }
    _sessionCache.remove(key);
  }

  Future<String?> _readPersistent(String key) async {
    if (kIsWeb) {
      return browser_storage.readLocalValue(key);
    }
    return _storage.read(key: key);
  }

  Future<void> _writePersistent(String key, String value) async {
    if (kIsWeb) {
      browser_storage.writeLocalValue(key, value);
      return;
    }
    await _storage.write(key: key, value: value);
  }

  Future<void> _deletePersistent(String key) async {
    if (kIsWeb) {
      browser_storage.deleteLocalValue(key);
      return;
    }
    await _storage.delete(key: key);
  }
}
