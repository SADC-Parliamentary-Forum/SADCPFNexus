import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
      'drawer Leave entry opens leave request form without selecting Requests hub',
      () {
    final source =
        File('lib/shared/widgets/app_drawer.dart').readAsStringSync();

    expect(source, contains("path: '/requests/leave/new'"));
    expect(source, contains("label: 'New leave request'"));
    expect(source, contains("selectedPrefix: '/requests/leave'"));
    expect(source,
        contains("if (path == '/requests') return location == '/requests';"));
    expect(source,
        isNot(contains("_DrawerEntry(path: '/requests', label: 'Leave'")));
    expect(source, contains('routeInformationProvider.value.uri.path'));
  });
}
