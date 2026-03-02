import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_repository.dart';
import 'auth_storage.dart';
import 'unauthorized_callback.dart';
import '../network/api_client.dart';

final authStorageProvider = Provider<AuthStorage>((ref) => AuthStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(authStorageProvider);
  return ApiClient(
    authStorage: storage,
    onUnauthorized: () => onUnauthorizedCallback?.call(),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    apiClient: ref.watch(apiClientProvider),
    storage: ref.watch(authStorageProvider),
  );
});
