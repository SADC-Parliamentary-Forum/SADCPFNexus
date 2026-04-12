import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'cache_service.dart';

/// Singleton CacheService available throughout the app.
/// Initialised once in _AppBootstrap before the router runs.
final cacheServiceProvider = Provider<CacheService>((ref) {
  return CacheService();
});
