import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

class StitchScreen extends StatelessWidget {
  const StitchScreen({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.bottom,
    this.floatingActionButton,
    this.fallbackRoute = '/dashboard',
    this.showBackButton = true,
    this.showAppBar = true,
  });

  final String title;
  final Widget body;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final Widget? floatingActionButton;
  final String fallbackRoute;
  final bool showBackButton;
  final bool showAppBar;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = theme.colorScheme;
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: showAppBar
          ? AppBar(
              backgroundColor: theme.scaffoldBackgroundColor,
              foregroundColor: c.onSurface,
              elevation: 0,
              leading: showBackButton
                  ? StitchBackButton(fallbackRoute: fallbackRoute)
                  : null,
              title: Text(
                title,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: c.onSurface,
                  fontWeight: FontWeight.w800,
                ),
              ),
              actions: actions,
              bottom: bottom,
            )
          : null,
      floatingActionButton: floatingActionButton,
      body: body,
    );
  }
}

class StitchBackButton extends StatelessWidget {
  const StitchBackButton({super.key, this.fallbackRoute = '/dashboard'});

  final String fallbackRoute;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Back',
      icon: const Icon(Icons.arrow_back_ios_new, size: 18),
      onPressed: () {
        final navigator = Navigator.of(context);
        if (navigator.canPop()) {
          navigator.pop();
        } else {
          context.go(fallbackRoute);
        }
      },
    );
  }
}

class StitchIconAction extends StatelessWidget {
  const StitchIconAction({
    super.key,
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.color,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Icon(icon, color: color ?? c.onSurface.withValues(alpha: 0.72)),
    );
  }
}

class StitchLoadingState extends StatelessWidget {
  const StitchLoadingState({super.key, this.label = 'Loading'});

  final String label;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Center(
      child: Semantics(
        liveRegion: true,
        label: label,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: c.primary),
            const SizedBox(height: kStitchSpace12),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: c.onSurface.withValues(alpha: 0.65),
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class StitchErrorState extends StatelessWidget {
  const StitchErrorState({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, color: c.error, size: 40),
            const SizedBox(height: kStitchSpace12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(
                color: c.onSurface.withValues(alpha: 0.75),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: kStitchSpace16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class StitchEmptyState extends StatelessWidget {
  const StitchEmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
  });

  final String title;
  final String? message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: c.onSurface.withValues(alpha: 0.38), size: 44),
            const SizedBox(height: kStitchSpace12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: textTheme.titleSmall?.copyWith(
                color: c.onSurface,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: kStitchSpace4),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: textTheme.bodySmall?.copyWith(
                  color: c.onSurface.withValues(alpha: 0.62),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
