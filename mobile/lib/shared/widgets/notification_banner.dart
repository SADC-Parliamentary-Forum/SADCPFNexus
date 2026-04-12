import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/notifications/notification_poller.dart';

/// Slide-down banner that appears at the top of the screen when a new
/// notification arrives (either via FCM foreground or polling).
///
/// Usage: wrap your scaffold body with [NotificationBannerOverlay].
class NotificationBannerOverlay extends ConsumerStatefulWidget {
  final Widget child;
  const NotificationBannerOverlay({super.key, required this.child});

  @override
  ConsumerState<NotificationBannerOverlay> createState() =>
      _NotificationBannerOverlayState();
}

class _NotificationBannerOverlayState
    extends ConsumerState<NotificationBannerOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<Offset> _slideAnim;
  Timer? _dismissTimer;
  AppNotification? _currentNotification;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, -1.5),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ));
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    _animController.dispose();
    super.dispose();
  }

  void _show(AppNotification notification) {
    setState(() => _currentNotification = notification);
    _animController.forward(from: 0);
    _dismissTimer?.cancel();
    _dismissTimer = Timer(const Duration(seconds: 5), _dismiss);
  }

  void _dismiss() {
    _animController.reverse().then((_) {
      if (mounted) {
        setState(() => _currentNotification = null);
        ref.read(newNotificationProvider.notifier).dismiss();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AppNotification?>(newNotificationProvider, (prev, next) {
      if (next != null && next != prev) {
        _show(next);
      }
    });

    return Stack(
      children: [
        widget.child,
        if (_currentNotification != null)
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16,
            right: 16,
            child: SlideTransition(
              position: _slideAnim,
              child: _BannerCard(
                notification: _currentNotification!,
                onDismiss: _dismiss,
                onTap: () {
                  _dismiss();
                  context.push('/notifications');
                },
              ),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------

class _BannerCard extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onDismiss;
  final VoidCallback onTap;

  const _BannerCard({
    required this.notification,
    required this.onDismiss,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isDark
                ? const Color(0xFF1A2C24)
                : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? const Color(0xFF2E4D3D)
                  : const Color(0xFFE2E8F0),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.12),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF13ec80).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.notifications_rounded,
                  size: 18,
                  color: Color(0xFF13ec80),
                ),
              ),
              const SizedBox(width: 12),

              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.subject,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: isDark
                            ? const Color(0xFFE8F5F0)
                            : const Color(0xFF0E2318),
                        height: 1.3,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notification.body,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? const Color(0xFF7BB89A)
                            : const Color(0xFF64748B),
                        height: 1.4,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),

              // Dismiss
              GestureDetector(
                onTap: onDismiss,
                child: Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: isDark
                        ? const Color(0xFF7BB89A)
                        : const Color(0xFF94A3B8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
