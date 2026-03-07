import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/features/reports/presentation/screens/reports_screen.dart';

void main() {
  group('ReportsScreen', () {
    testWidgets('shows Reports title and report types', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: ReportsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Reports'), findsOneWidget);
      expect(find.text('Reporting Centre'), findsOneWidget);
      expect(find.text('Travel & Missions'), findsOneWidget);
      expect(find.text('Leave Management'), findsOneWidget);
    });
  });
}
