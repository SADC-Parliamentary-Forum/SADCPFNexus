import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sadcpf_nexus/features/stock/data/stocktake_draft_queue.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('StocktakeDraftQueue', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('enqueue persists client_line_key lines', () async {
      await StocktakeDraftQueue.clear();
      await StocktakeDraftQueue.enqueue(
        StocktakeDraftLine(
          clientLineKey: 'mobile-1',
          barcode: 'ABC-123',
          countedQty: 2,
          queuedAt: '2026-07-29T10:00:00Z',
          stockItemId: 9,
          name: 'Toner',
        ),
      );

      final loaded = await StocktakeDraftQueue.load();
      expect(loaded, hasLength(1));
      expect(loaded.first.clientLineKey, 'mobile-1');
      expect(loaded.first.barcode, 'ABC-123');
      expect(loaded.first.countedQty, 2);
      expect(loaded.first.stockItemId, 9);
    });

    test('clear empties queue', () async {
      await StocktakeDraftQueue.enqueue(
        StocktakeDraftLine(
          clientLineKey: 'mobile-2',
          barcode: 'X',
          countedQty: 1,
          queuedAt: '2026-07-29T10:00:00Z',
        ),
      );
      await StocktakeDraftQueue.clear();
      expect(await StocktakeDraftQueue.load(), isEmpty);
    });
  });
}
