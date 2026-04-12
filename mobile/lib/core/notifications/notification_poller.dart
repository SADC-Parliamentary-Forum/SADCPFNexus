import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_providers.dart';

// ---------------------------------------------------------------------------
// Unread count poller
// ---------------------------------------------------------------------------

/// Polls `/notifications/unread-count` every [_interval] and exposes the
/// current count.  The provider auto-cancels on dispose.
class NotificationCountNotifier extends AsyncNotifier<int> {
  static const _interval = Duration(seconds: 30);
  Timer? _timer;

  @override
  Future<int> build() async {
    ref.onDispose(() {
      _timer?.cancel();
    });

    // Only poll when authenticated.
    final session = ref.watch(authSessionControllerProvider).state;
    if (!session.isAuthenticated) return 0;

    final count = await _fetch();
    _startPolling();
    return count;
  }

  void _startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) async {
      final count = await _fetch();
      state = AsyncData(count);
    });
  }

  Future<int> _fetch() async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/notifications/unread-count',
      );
      return (res.data?['count'] as num?)?.toInt() ?? 0;
    } catch (_) {
      return state.valueOrNull ?? 0;
    }
  }

  /// Force a refresh (e.g. after marking a notification as read).
  Future<void> refresh() async {
    final count = await _fetch();
    state = AsyncData(count);
  }
}

final notificationCountProvider =
    AsyncNotifierProvider<NotificationCountNotifier, int>(
  NotificationCountNotifier.new,
);

// ---------------------------------------------------------------------------
// Latest notifications list (for banner)
// ---------------------------------------------------------------------------

class AppNotification {
  const AppNotification({
    required this.id,
    required this.subject,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.triggerKey,
    this.meta,
  });

  final String id;
  final String subject;
  final String body;
  final bool isRead;
  final DateTime createdAt;
  final String? triggerKey;
  final Map<String, dynamic>? meta;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'].toString(),
      subject: json['subject'] as String? ?? '',
      body: json['body'] as String? ?? '',
      isRead: json['is_read'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['created_at'] as String? ?? '') ??
          DateTime.now(),
      triggerKey: json['trigger_key'] as String?,
      meta: json['meta'] as Map<String, dynamic>?,
    );
  }
}

/// Tracks the most recent unread notification for the in-app banner.
/// Compares by ID — when a new ID appears after a poll cycle, the banner fires.
class NewNotificationNotifier extends Notifier<AppNotification?> {
  String? _lastSeenId;
  Timer? _timer;
  static const _interval = Duration(seconds: 30);

  @override
  AppNotification? build() {
    ref.onDispose(() => _timer?.cancel());

    // Only poll when authenticated.
    final session = ref.watch(authSessionControllerProvider).state;
    if (!session.isAuthenticated) return null;

    _startPolling();
    return null;
  }

  void _startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) => _poll());
  }

  Future<void> _poll() async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      final res = await dio.get<Map<String, dynamic>>(
        '/notifications',
        queryParameters: {'filter': 'unread', 'per_page': 5},
      );

      final list = (res.data?['data'] as List?) ?? [];
      if (list.isEmpty) return;

      final latest = AppNotification.fromJson(
        Map<String, dynamic>.from(list.first as Map),
      );

      if (_lastSeenId == null) {
        // First poll — just record the baseline, don't show banner.
        _lastSeenId = latest.id;
        return;
      }

      if (latest.id != _lastSeenId) {
        _lastSeenId = latest.id;
        state = latest;
      }
    } catch (_) {}
  }

  void dismiss() => state = null;
}

final newNotificationProvider =
    NotifierProvider<NewNotificationNotifier, AppNotification?>(
  NewNotificationNotifier.new,
);
