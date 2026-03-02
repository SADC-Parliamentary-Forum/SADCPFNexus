/// API base URL from build/runtime configuration.
/// Set via: flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
/// Default is Android emulator host; use 10.0.2.2 for Android, localhost for iOS simulator.
String get apiBaseUrl =>
    const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:8000/api/v1',
    );
