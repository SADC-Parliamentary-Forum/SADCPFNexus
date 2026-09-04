import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/l10n/app_locale.dart';
import 'package:sadcpf_nexus/l10n/app_strings.dart';

void main() {
  test('EN FR PT shell catalogs share the same keys', () {
    final en = AppStrings.of(AppLanguage.en);
    final fr = AppStrings.of(AppLanguage.fr);
    final pt = AppStrings.of(AppLanguage.pt);
    const keys = [
      'Home',
      'Requests',
      'Approvals',
      'Reports',
      'Profile',
      'Language',
      'Timesheets',
      'Procurement',
    ];
    for (final key in keys) {
      expect(en.t(key), isNotEmpty);
      expect(fr.t(key), isNot(equals(en.t(key))), reason: 'French $key');
      expect(pt.t(key), isNot(equals(en.t(key))), reason: 'Portuguese $key');
    }
  });
}
