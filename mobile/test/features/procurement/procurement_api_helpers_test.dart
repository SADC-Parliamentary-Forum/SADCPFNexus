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

    test('isRequestFinanciallySealed follows tender sealed_mode', () {
      expect(
        isRequestFinanciallySealed({
          'procurement_method': 'quotation',
          'tender': {
            'sealed_mode': true,
            'bids_opened_at': null,
          },
        }),
        isTrue,
      );
      expect(
        isRequestFinanciallySealed({
          'procurement_method': 'quotation',
          'tender': {
            'sealed_mode': true,
            'bids_opened_at': '2026-07-01T10:00:00Z',
          },
        }),
        isFalse,
      );
    });

    test('isRequestFinanciallySealed seals tender-method RFQ until deadline', () {
      final now = DateTime.utc(2026, 7, 10, 12);
      expect(
        isRequestFinanciallySealed(
          {
            'procurement_method': 'tender',
            'rfq_deadline': '2026-07-15',
          },
          now: now,
        ),
        isTrue,
      );
      expect(
        isRequestFinanciallySealed(
          {
            'procurement_method': 'tender',
            'rfq_deadline': '2026-07-09',
          },
          now: now,
        ),
        isFalse,
      );
    });

    test('quoteAmountForDisplay never returns sealed competitor amounts', () {
      expect(
        quoteAmountForDisplay(
          {'quoted_amount': 12000, 'financials_sealed': true},
        ),
        isNull,
      );
      expect(
        quoteAmountForDisplay(
          {'quoted_amount': 12000, 'total_amount': 12000},
          requestSealed: true,
        ),
        isNull,
      );
      expect(
        quoteAmountForDisplay({'quoted_amount': 5500.5}),
        5500.5,
      );
      expect(
        quoteAmountForDisplay({'total_amount': 99}),
        99,
      );
    });

    test('budgetReservationStatusLabel distinguishes active vs released', () {
      expect(
        budgetReservationStatusLabel({'reserved_amount': 100}),
        'Active',
      );
      expect(
        budgetReservationStatusLabel({
          'reserved_amount': 100,
          'released_at': '2026-07-01T00:00:00Z',
        }),
        'Released',
      );
    });

    test('vendorDocumentExpiryStatus flags expired and expiring docs', () {
      final now = DateTime.utc(2026, 7, 25);
      expect(
        vendorDocumentExpiryStatus('2026-06-01', now: now),
        VendorDocExpiryStatus.expired,
      );
      expect(
        vendorDocumentExpiryStatus('2026-08-10', now: now),
        VendorDocExpiryStatus.expiringSoon,
      );
      expect(
        vendorDocumentExpiryStatus('2027-01-01', now: now),
        VendorDocExpiryStatus.ok,
      );
      expect(
        vendorDocumentExpiryStatus(null, now: now),
        VendorDocExpiryStatus.unknown,
      );
    });

    test('canIssueProcurementRfq matches API permission gate', () {
      expect(
        canIssueProcurementRfq(
          permissions: const ['procurement.create'],
          roles: const [],
        ),
        isTrue,
      );
      expect(
        canIssueProcurementRfq(
          permissions: const ['procurement.view'],
          roles: const [],
        ),
        isFalse,
      );
      expect(
        canIssueProcurementRfq(
          permissions: const [],
          roles: const ['System Admin'],
        ),
        isTrue,
      );
    });

    test('procurementStatusConfig covers budget_reserved', () {
      final cfg = procurementStatusConfig('budget_reserved');
      expect(cfg.label, 'Budget Reserved');
    });
  });
}
