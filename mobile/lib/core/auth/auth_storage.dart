import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _kTokenKey = 'sadcpf_token';
const _kUserKey = 'sadcpf_user';

class AuthStorage {
  AuthStorage() : _storage = const FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));

  final FlutterSecureStorage _storage;

  Future<String?> getToken() => _storage.read(key: _kTokenKey);

  Future<void> setToken(String token) => _storage.write(key: _kTokenKey, value: token);

  Future<String?> getUserJson() => _storage.read(key: _kUserKey);

  Future<void> setUserJson(String json) => _storage.write(key: _kUserKey, value: json);

  Future<void> clear() async {
    await _storage.delete(key: _kTokenKey);
    await _storage.delete(key: _kUserKey);
  }
}
