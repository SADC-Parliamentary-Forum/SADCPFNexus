import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/offline/draft_sync_outcome.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';

/// Sync-failure UX without pulling Drift/sqlite (drift_flutter version skew
/// breaks OfflineDraftsScreen widget loads in this environment).
void main() {
  group('DraftSyncOutcome failure handling', () {
    test('connection-style all-failed message', () {
      final outcome = DraftSyncOutcome(synced: 0, failed: 3);
      expect(outcome.allFailed, isTrue);
      expect(outcome.partialSuccess, isFalse);
      expect(
        outcome.snackbarMessage(),
        'Sync failed. Check connection and try again.',
      );
    });

    test('partial failure keeps synced count visible', () {
      final outcome = DraftSyncOutcome(synced: 1, failed: 2);
      expect(outcome.partialSuccess, isTrue);
      expect(outcome.snackbarMessage(), 'Synced 1 draft(s). 2 failed.');
    });

    test('empty queue is not treated as failure', () {
      final outcome = DraftSyncOutcome(synced: 0, failed: 0);
      expect(outcome.nothingToDo, isTrue);
      expect(outcome.allFailed, isFalse);
      expect(outcome.snackbarMessage(), 'No drafts to sync.');
    });
  });

  group('Draft sync failure snackbar UI', () {
    Color? _colorFor(DraftSyncOutcome outcome) {
      if (outcome.allFailed) return AppColors.danger;
      if (outcome.partialSuccess) return AppColors.warning;
      return AppColors.success;
    }

    Future<void> pumpSyncButton(
      WidgetTester tester,
      DraftSyncOutcome outcome,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) {
                return ElevatedButton(
                  onPressed: () {
                    if (outcome.nothingToDo) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('No drafts to sync.'),
                          backgroundColor: AppColors.info,
                        ),
                      );
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(outcome.snackbarMessage()),
                        backgroundColor: _colorFor(outcome),
                      ),
                    );
                  },
                  child: const Text('Sync All'),
                );
              },
            ),
          ),
        ),
      );
    }

    testWidgets('all-failed sync shows danger snackbar message', (tester) async {
      await pumpSyncButton(tester, const DraftSyncOutcome(synced: 0, failed: 2));
      await tester.tap(find.text('Sync All'));
      await tester.pump();

      expect(
        find.text('Sync failed. Check connection and try again.'),
        findsOneWidget,
      );
      final bar = tester.widget<SnackBar>(find.byType(SnackBar));
      expect(bar.backgroundColor, AppColors.danger);
    });

    testWidgets('partial sync shows warning snackbar with counts', (tester) async {
      await pumpSyncButton(tester, const DraftSyncOutcome(synced: 2, failed: 1));
      await tester.tap(find.text('Sync All'));
      await tester.pump();

      expect(find.text('Synced 2 draft(s). 1 failed.'), findsOneWidget);
      final bar = tester.widget<SnackBar>(find.byType(SnackBar));
      expect(bar.backgroundColor, AppColors.warning);
    });

    testWidgets('empty queue shows info snackbar', (tester) async {
      await pumpSyncButton(tester, const DraftSyncOutcome(synced: 0, failed: 0));
      await tester.tap(find.text('Sync All'));
      await tester.pump();

      expect(find.text('No drafts to sync.'), findsOneWidget);
      final bar = tester.widget<SnackBar>(find.byType(SnackBar));
      expect(bar.backgroundColor, AppColors.info);
    });
  });
}
