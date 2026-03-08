import 'package:flutter/foundation.dart' show kIsWeb;

/// API base URL from build/runtime configuration.
/// On web (Chrome): uses localhost so the browser can reach the API on the host.
/// On Android: 10.0.2.2 is the emulator alias for host; on device use your machine's IP or dart-define.
/// Set via: flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
String get apiBaseUrl {
  if (kIsWeb) {
    return 'http://localhost:8000/api/v1';
  }
  return const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );
}
