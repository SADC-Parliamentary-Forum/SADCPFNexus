import 'package:flutter/foundation.dart' show kIsWeb, kReleaseMode;

/// Production API base URL — used automatically in release builds.
const String kProductionApiUrl = 'https://nexus-api.sadcpf.org/api/v1';

/// API base URL resolved at runtime.
///
/// Priority:
///   1. `--dart-define=API_BASE_URL=<url>` passed at build/run time
///   2. Production URL (`kProductionApiUrl`) in release mode
///   3. Android emulator alias (`10.0.2.2`) in debug mode
///   4. `localhost` for Flutter Web
///
/// Examples:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000/api/v1
///   flutter build apk --dart-define=API_BASE_URL=https://nexus-api.sadcpf.org/api/v1
String get apiBaseUrl {
  if (kIsWeb) {
    return 'http://localhost:8000/api/v1';
  }

  const configured = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  if (configured.isNotEmpty) return configured;

  // Release builds default to production — no dart-define required.
  return kReleaseMode ? kProductionApiUrl : 'http://10.0.2.2:8000/api/v1';
}
