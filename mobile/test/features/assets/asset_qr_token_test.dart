import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/features/assets/domain/asset_qr_token.dart';

void main() {
  test('parseAssetQrToken reads public URLs and raw tokens', () {
    expect(
      parseAssetQrToken('https://nexus.sadcpf.org/a/AbCdEfGhIjKlMnOpQrStUvWx'),
      'AbCdEfGhIjKlMnOpQrStUvWx',
    );
    expect(parseAssetQrToken('/a/AbCdEfGhIjKlMnOpQrStUvWx'), 'AbCdEfGhIjKlMnOpQrStUvWx');
    expect(parseAssetQrToken('AbCdEfGhIjKlMnOpQrStUvWx'), 'AbCdEfGhIjKlMnOpQrStUvWx');
    expect(parseAssetQrToken('short'), isNull);
    expect(parseAssetQrToken(''), isNull);
  });
}
