import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/offline/draft_sync_outcome.dart';

void main() {
  group('DraftSyncOutcome', () {
    test('all failed shows connection message', () {
      final outcome = DraftSyncOutcome(synced: 0, failed: 3);
      expect(outcome.allFailed, isTrue);
      expect(
        outcome.snackbarMessage(),
        'Sync failed. Check connection and try again.',
      );
    });

    test('partial success reports counts', () {
      final outcome = DraftSyncOutcome(synced: 2, failed: 1);
      expect(outcome.partialSuccess, isTrue);
      expect(outcome.snackbarMessage(), 'Synced 2 draft(s). 1 failed.');
    });

    test('all succeeded', () {
      final outcome = DraftSyncOutcome(synced: 4, failed: 0);
      expect(outcome.allSucceeded, isTrue);
      expect(outcome.snackbarMessage(), 'All drafts synced successfully.');
    });

    test('empty batch', () {
      final outcome = DraftSyncOutcome(synced: 0, failed: 0);
      expect(outcome.nothingToDo, isTrue);
      expect(outcome.snackbarMessage(), 'No drafts to sync.');
    });
  });
}
