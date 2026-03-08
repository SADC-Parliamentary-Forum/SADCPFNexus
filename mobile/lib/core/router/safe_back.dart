import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Safe "back" when using go_router: pop if possible, otherwise go to dashboard.
/// Use this for AppBar leading / close / back so screens opened via [context.go]
/// (e.g. from the drawer) never try to pop the last page and trigger go_router's assertion.
extension SafeBack on BuildContext {
  void safePopOrGoHome() {
    if (canPop()) {
      pop();
    } else {
      go('/dashboard');
    }
  }
}
