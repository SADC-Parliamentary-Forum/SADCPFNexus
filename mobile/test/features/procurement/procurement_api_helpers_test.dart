import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';

void main() {
  group('procurement_api_helpers', () {
    test('extractListData unwraps {data: [...]}', () {
      final list = extractListData({
        'data': [
          {'id': 1, 'title': 'A'},
          {'id': 2, 'title': 'B'},
        ],
      });
      expect(list.length, 2);
      expect(list.first['title'], 'A');
    });

    test('extractListData accepts bare arrays', () {
      final list = extractListData([
        {'id': 9},
      ]);
      expect(list.single['id'], 9);
    });

    test('extractObjectData unwraps nested data', () {
      final obj = extractObjectData({
        'data': {'id': 3, 'status': 'published'},
      });
      expect(obj?['id'], 3);
      expect(obj?['status'], 'published');
    });

    test('isTenderFinanciallySealed hides amounts until open', () {
      expect(
        isTenderFinanciallySealed({
          'sealed_mode': true,
          'bids_opened_at': null,
        }),
        isTrue,
      );
      expect(
        isTenderFinanciallySealed({
          'sealed_mode': true,
          'bids_opened_at': '2026-07-01T10:00:00Z',
        }),
        isFalse,
      );
      expect(
        isTenderFinanciallySealed({
          'sealed_mode': false,
          'bids_opened_at': null,
        }),
        isFalse,
      );
    });

    test('procurementStatusConfig covers budget_reserved', () {
      final cfg = procurementStatusConfig('budget_reserved');
      expect(cfg.label, 'Budget Reserved');
    });
  });
}
