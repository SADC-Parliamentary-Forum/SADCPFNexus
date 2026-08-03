import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/core/auth/feature_access.dart';

void main() {
  group('canAccessFeature', () {
    test('salary advance preview requires finance view permission', () {
      expect(
        canAccessFeature(
          ['leave.view'],
          ['Staff'],
          '/salary/advance/preview?id=123',
        ),
        isFalse,
      );

      expect(
        canAccessFeature(
          ['finance.view'],
          ['Staff'],
          '/salary/advance/preview?id=123',
        ),
        isTrue,
      );
    });

    test('system administrators can access protected salary advance routes',
        () {
      expect(
        canAccessFeature(
          [],
          ['System Administrator'],
          '/salary/advance/preview?id=123',
        ),
        isTrue,
      );
    });

    test('request creation routes require their module permissions', () {
      expect(
        canAccessFeature(
          ['travel.view'],
          ['Staff'],
          '/requests/leave/new',
        ),
        isFalse,
      );

      expect(
        canAccessFeature(
          ['leave.view'],
          ['Staff'],
          '/requests/leave/new',
        ),
        isTrue,
      );

      expect(
        canAccessFeature(
          ['leave.view'],
          ['Staff'],
          '/requests/travel/new',
        ),
        isFalse,
      );

      expect(
        canAccessFeature(
          ['travel.view'],
          ['Staff'],
          '/requests/travel/new',
        ),
        isTrue,
      );
    });

    test('unknown routes deny by default', () {
      expect(
        canAccessFeature(
          ['finance.view', 'hr.view', 'procurement.view'],
          ['Staff'],
          '/unregistered/deep-link',
        ),
        isFalse,
      );
    });

    test('empty authenticated access state does not grant routes', () {
      expect(
        canAccessFeature(
          const [],
          const [],
          '/dashboard',
        ),
        isFalse,
      );
    });

    test('canonical effective permissions grant matching mobile routes', () {
      expect(
        canAccessFeature(
          ['salary_advance.request.read.self'],
          ['Staff'],
          '/salary/advance/preview?id=123',
        ),
        isTrue,
      );

      expect(
        canAccessFeature(
          ['procurement.request.create'],
          ['Staff'],
          '/procurement/form',
        ),
        isTrue,
      );
    });
  });
}
