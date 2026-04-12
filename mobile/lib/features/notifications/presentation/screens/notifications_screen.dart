import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/notifications/notification_poller.dart';

// ---------------------------------------------------------------------------
// Data & Provider
// ---------------------------------------------------------------------------

final _notificationsProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final dio = ref.watch(apiClientProvider).dio;
  final res = await dio.get<Map<String, dynamic>>(
    '/notifications',
    queryParameters: {'filter': 'all', 'per_page': 50},
  );
  final list = (res.data?['data'] as List?) ?? [];
  return list
      .map((e) => AppNotification.fromJson(Map<String, dynamic>.from(e as Map)))
      .toList();
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _markAllRead() async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/notifications/read-all');
      ref.invalidate(_notificationsProvider);
      ref.read(notificationCountProvider.notifier).refresh();
    } catch (_) {}
  }

  Future<void> _markRead(String id) async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/notifications/$id/read');
      ref.invalidate(_notificationsProvider);
      ref.read(notificationCountProvider.notifier).refresh();
    } catch (_) {}
  }

  Future<void> _delete(String id) async {
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.delete('/notifications/$id');
      ref.invalidate(_notificationsProvider);
      ref.read(notificationCountProvider.notifier).refresh();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final all = ref.watch(_notificationsProvider);

    final bg = isDark ? const Color(0xFF102219) : const Color(0xFFF6F7F8);
    final surface = isDark ? const Color(0xFF1A2C24) : Colors.white;
    const primary = Color(0xFF13ec80);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: surface,
        elevation: 0,
        title: Text(
          'Notifications',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: isDark ? const Color(0xFFE8F5F0) : const Color(0xFF0E2318),
          ),
        ),
        actions: [
          TextButton(
            onPressed: _markAllRead,
            child: Text(
              'Mark all read',
              style: TextStyle(color: primary, fontSize: 13),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: primary,
          unselectedLabelColor:
              isDark ? const Color(0xFF7BB89A) : const Color(0xFF64748B),
          indicatorColor: primary,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Unread'),
            Tab(text: 'Read'),
          ],
        ),
      ),
      body: all.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Failed to load notifications',
              style: TextStyle(color: theme.colorScheme.error)),
        ),
        data: (notifications) {
          return TabBarView(
            controller: _tabs,
            children: [
              _NotificationList(
                items: notifications,
                onMarkRead: _markRead,
                onDelete: _delete,
                emptyMessage: 'No notifications yet',
              ),
              _NotificationList(
                items: notifications.where((n) => !n.isRead).toList(),
                onMarkRead: _markRead,
                onDelete: _delete,
                emptyMessage: 'No unread notifications',
              ),
              _NotificationList(
                items: notifications.where((n) => n.isRead).toList(),
                onMarkRead: _markRead,
                onDelete: _delete,
                emptyMessage: 'No read notifications',
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------

class _NotificationList extends StatelessWidget {
  final List<AppNotification> items;
  final Future<void> Function(String id) onMarkRead;
  final Future<void> Function(String id) onDelete;
  final String emptyMessage;

  const _NotificationList({
    required this.items,
    required this.onMarkRead,
    required this.onDelete,
    required this.emptyMessage,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.notifications_none_rounded,
                size: 48, color: Color(0xFF7BB89A)),
            const SizedBox(height: 12),
            Text(emptyMessage,
                style: const TextStyle(
                    color: Color(0xFF7BB89A), fontSize: 14)),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) =>
          _NotificationCard(item: items[index], onMarkRead: onMarkRead, onDelete: onDelete),
    );
  }
}

// ---------------------------------------------------------------------------

class _NotificationCard extends StatelessWidget {
  final AppNotification item;
  final Future<void> Function(String id) onMarkRead;
  final Future<void> Function(String id) onDelete;

  const _NotificationCard({
    required this.item,
    required this.onMarkRead,
    required this.onDelete,
  });

  IconData _iconFor(String? trigger) {
    if (trigger == null) return Icons.notifications_rounded;
    if (trigger.startsWith('travel')) return Icons.flight_rounded;
    if (trigger.startsWith('leave')) return Icons.beach_access_rounded;
    if (trigger.startsWith('imprest')) return Icons.account_balance_wallet_rounded;
    if (trigger.startsWith('procurement')) return Icons.shopping_cart_rounded;
    if (trigger.startsWith('finance') || trigger.startsWith('budget')) {
      return Icons.bar_chart_rounded;
    }
    if (trigger.startsWith('hr') || trigger.startsWith('salary')) {
      return Icons.people_rounded;
    }
    if (trigger.startsWith('srhr')) return Icons.health_and_safety_rounded;
    if (trigger.startsWith('assignment')) return Icons.assignment_rounded;
    if (trigger.startsWith('risk')) return Icons.warning_amber_rounded;
    return Icons.notifications_rounded;
  }

  Color _colorFor(String? trigger) {
    if (trigger == null) return const Color(0xFF13ec80);
    if (trigger.startsWith('travel')) return const Color(0xFF3B82F6);
    if (trigger.startsWith('leave')) return const Color(0xFF10B981);
    if (trigger.startsWith('imprest')) return const Color(0xFFF59E0B);
    if (trigger.startsWith('procurement')) return const Color(0xFF8B5CF6);
    if (trigger.startsWith('finance') || trigger.startsWith('budget')) {
      return const Color(0xFFEF4444);
    }
    if (trigger.startsWith('hr') || trigger.startsWith('salary')) {
      return const Color(0xFF06B6D4);
    }
    if (trigger.startsWith('risk')) return const Color(0xFFF97316);
    return const Color(0xFF13ec80);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final color = _colorFor(item.triggerKey);
    final surface = isDark ? const Color(0xFF1A2C24) : Colors.white;

    final timeStr = DateFormat('d MMM, HH:mm').format(item.createdAt.toLocal());

    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFEF4444).withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Icon(Icons.delete_outline_rounded,
            color: Color(0xFFEF4444), size: 22),
      ),
      onDismissed: (_) => onDelete(item.id),
      child: GestureDetector(
        onTap: item.isRead ? null : () => onMarkRead(item.id),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: item.isRead
                  ? (isDark
                      ? const Color(0xFF2E4D3D)
                      : const Color(0xFFE2E8F0))
                  : color.withValues(alpha: 0.3),
              width: item.isRead ? 1 : 1.5,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_iconFor(item.triggerKey), size: 18, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.subject,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: item.isRead
                                  ? FontWeight.w500
                                  : FontWeight.w700,
                              color: isDark
                                  ? const Color(0xFFE8F5F0)
                                  : const Color(0xFF0E2318),
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (!item.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(left: 8, top: 4),
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.body,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? const Color(0xFF7BB89A)
                            : const Color(0xFF64748B),
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      timeStr,
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark
                            ? const Color(0xFF4A7B60)
                            : const Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
