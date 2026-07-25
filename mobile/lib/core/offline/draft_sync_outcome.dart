/// Pure helpers for offline draft sync UX (unit-testable without Dio/DB).
class DraftSyncOutcome {
  const DraftSyncOutcome({
    required this.synced,
    required this.failed,
  });

  final int synced;
  final int failed;

  bool get allFailed => failed > 0 && synced == 0;
  bool get partialSuccess => synced > 0 && failed > 0;
  bool get allSucceeded => synced > 0 && failed == 0;
  bool get nothingToDo => synced == 0 && failed == 0;

  String snackbarMessage() {
    if (nothingToDo) return 'No drafts to sync.';
    if (allSucceeded) return 'All drafts synced successfully.';
    if (partialSuccess) return 'Synced $synced draft(s). $failed failed.';
    return 'Sync failed. Check connection and try again.';
  }
}
