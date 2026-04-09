import 'package:flutter/material.dart';

/// Allows child routes of [AppShell] to open the shell's drawer
/// (e.g. from a hamburger icon in the app bar).
class ShellDrawerScope extends InheritedWidget {
  const ShellDrawerScope({
    super.key,
    required this.openDrawer,
    required super.child,
  });

  final VoidCallback openDrawer;

  static ShellDrawerScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<ShellDrawerScope>();
  }

  static VoidCallback openDrawerOf(BuildContext context) {
    final scope = maybeOf(context);
    if (scope == null) {
      return () {};
    }
    return scope.openDrawer;
  }

  @override
  bool updateShouldNotify(ShellDrawerScope oldWidget) =>
      openDrawer != oldWidget.openDrawer;
}
