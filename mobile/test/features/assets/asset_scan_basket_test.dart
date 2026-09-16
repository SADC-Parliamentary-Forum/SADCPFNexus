import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/features/assets/domain/asset_scan_basket.dart';

void main() {
  test('AssetScanBasket parses Phase 2 presentBasket payload', () {
    final basket = AssetScanBasket.fromJson({
      'id': 9,
      'status': 'open',
      'handover_id': null,
      'items': [
        {
          'id': 1,
          'asset_id': 12,
          'name': 'ThinkPad',
          'tag_number': 'PF/ICT/LT/001',
          'scan_method': 'qr',
        },
      ],
    });

    expect(basket.id, 9);
    expect(basket.status, 'open');
    expect(basket.handoverId, isNull);
    expect(basket.items, hasLength(1));
    expect(basket.items.single.tagNumber, 'PF/ICT/LT/001');
    expect(basket.items.single.name, 'ThinkPad');
    expect(basket.items.single.scanMethod, 'qr');
  });

  test('TenantUserOption labels name and email', () {
    final user = TenantUserOption.fromJson({
      'id': 3,
      'name': 'Demo Staff',
      'email': 'staff@sadcpf.org',
      'job_title': 'Programme Officer',
    })!;
    expect(user.id, 3);
    expect(user.label, contains('Demo Staff'));
    expect(user.label, contains('staff@sadcpf.org'));
  });
}
