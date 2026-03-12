import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'draft_database.dart';

final draftDatabaseProvider = Provider<DraftDatabase>((ref) {
  return DraftDatabase();
});
