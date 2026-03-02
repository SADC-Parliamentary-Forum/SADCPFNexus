import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sadcpf_nexus/main.dart';

void main() {
  testWidgets('App loads and shows login or dashboard', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: SADCPFNexusApp(),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // App should show either login screen ("Sign In") or dashboard
    final signIn = find.text('Sign In');
    final dashboard = find.text('Home');
    expect(signIn.evaluate().isNotEmpty || dashboard.evaluate().isNotEmpty, true);
  });
}
