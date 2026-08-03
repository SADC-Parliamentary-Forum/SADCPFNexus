import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String read(String path) => File(path).readAsStringSync();

void main() {
  test('salary advance preview and malformed deep links are guarded', () {
    final access = read('lib/core/auth/feature_access.dart');
    final router = read('lib/core/router/app_router.dart');

    expect(access, contains("'/salary/advance/preview': ['finance.view']"));
    expect(router, contains('int? _routeIntParam'));
    expect(router, contains('Widget _invalidRouteScreen'));
    expect(router, isNot(contains('int.parse(state.pathParameters')));
    expect(router, contains("name: 'hrPerformanceDetail'"));
    expect(router, contains("fallbackRoute: '/hr/performance'"));
    expect(router, contains("name: 'hrFileDetail'"));
    expect(router, contains("fallbackRoute: '/hr/files'"));
    expect(router, contains("name: 'hrFileDocuments'"));
  });

  test('mobile app has network and localization platform plumbing', () {
    final pubspec = read('pubspec.yaml');
    final main = read('lib/main.dart');
    final bottomNav = read('lib/shared/widgets/bottom_nav_bar.dart');

    expect(pubspec, contains('connectivity_plus:'));
    expect(pubspec, contains('flutter_localizations:'));
    expect(main, contains('GlobalMaterialLocalizations.delegate'));
    expect(main, contains("Locale('fr')"));
    expect(main, contains("Locale('pt')"));
    expect(bottomNav, contains('ConnectivityBannerOverlay'));
    expect(bottomNav, contains("label: '\$label tab'"));
  });

  test('small icon-only mobile controls have semantics and usable tap targets',
      () {
    final banner = read('lib/shared/widgets/notification_banner.dart');
    final incident = read(
      'lib/features/hr/presentation/screens/report_new_incident_screen.dart',
    );
    final retirement = read(
      'lib/features/imprest/presentation/screens/expense_retirement_screen.dart',
    );

    expect(banner, contains("label: 'Dismiss notification'"));
    expect(banner, contains('width: 44'));
    expect(banner, contains('height: 44'));
    expect(incident, contains("tooltip: 'Remove witness \$w'"));
    expect(incident, contains('height: 44'));
    expect(retirement, contains("tooltip: 'Remove expense item \${idx + 1}'"));
    expect(retirement, contains('height: 44'));
  });

  test(
      'travel and imprest money fields use record currency instead of hardcoded symbols',
      () {
    final travel = read(
      'lib/features/requests/presentation/screens/travel_request_form_screen.dart',
    );
    final retirement = read(
      'lib/features/imprest/presentation/screens/expense_retirement_screen.dart',
    );

    expect(travel, isNot(contains("'currency': 'USD'")));
    expect(travel, contains('String currency ='));
    expect(travel, contains("label: 'Currency'"));
    expect(travel, contains("'currency': _form.currency"));
    expect(retirement, contains('String get _currencyCode'));
    expect(retirement, isNot(contains("return 'N\$")));
  });

  test(
      'offline drafts expose stocktake queue and destructive delete confirmation',
      () {
    final offline = read(
      'lib/features/offline/presentation/screens/offline_drafts_screen.dart',
    );

    expect(offline, contains('StocktakeDraftQueue.load'));
    expect(offline, contains('Stocktake offline queue'));
    expect(offline, contains('Delete draft?'));
    expect(offline, contains('FloatingActionButton.extended'));
  });

  test('salary advance and reports screens use the shared Stitch shell states',
      () {
    final hub = read(
      'lib/features/salary_advance/presentation/screens/salary_advance_hub_screen.dart',
    );
    final list = read(
      'lib/features/salary_advance/presentation/screens/salary_advance_list_screen.dart',
    );
    final reports =
        read('lib/features/reports/presentation/screens/reports_screen.dart');
    final dashboard = read(
      'lib/features/dashboard/presentation/screens/dashboard_screen.dart',
    );

    expect(hub, contains('StitchScreen'));
    expect(hub, contains('StitchLoadingState'));
    expect(hub, contains('StitchErrorState'));
    expect(list, contains('StitchScreen'));
    expect(list, contains("'per_page': 100"));
    expect(list, isNot(contains('Load more')));
    expect(reports, contains('StitchScreen'));
    expect(dashboard, contains('RefreshIndicator'));
    expect(dashboard, contains("tooltip: 'Open navigation menu'"));
  });

  test('directory search uses the shared debounced filter widget', () {
    final shared = read('lib/shared/widgets/searchable_list_filter.dart');
    final hr =
        read('lib/features/hr/presentation/screens/hr_directory_screen.dart');
    final vendors = read(
      'lib/features/procurement/presentation/screens/vendor_directory_screen.dart',
    );

    expect(shared, contains('class DebouncedSearchField'));
    expect(shared, contains('bool matchesSearchText'));
    expect(hr, contains('DebouncedSearchField'));
    expect(hr, contains('matchesSearchText'));
    expect(vendors, contains('DebouncedSearchField'));
    expect(vendors, contains('matchesSearchText'));
  });
}
