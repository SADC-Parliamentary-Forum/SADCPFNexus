import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Auth & Shell
import '../../features/splash/presentation/screens/splash_screen.dart';
import '../../features/auth/presentation/screens/access_denied_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/requests/presentation/screens/requests_screen.dart';
import '../../features/approvals/presentation/screens/approvals_screen.dart';
import '../../features/reports/presentation/screens/reports_screen.dart';
import '../../features/reports/presentation/screens/report_detail_screen.dart';
import '../../shared/widgets/bottom_nav_bar.dart';

// Travel Requests
import '../../features/requests/presentation/screens/travel_request_form_screen.dart';
import '../../features/requests/presentation/screens/travel_request_detail_screen.dart';
import '../../features/requests/presentation/screens/travel_finance_queue_screen.dart';
import '../../features/requests/presentation/screens/travel_toil_queue_screen.dart';
import '../../features/requests/presentation/screens/leave_request_form_screen.dart';
import '../../features/requests/presentation/screens/leave_request_detail_screen.dart';
import '../../features/requests/presentation/screens/leave_balance_screen.dart';
import '../../features/imprest/presentation/screens/imprest_detail_screen.dart';

// Finance
import '../../features/finance/presentation/screens/finance_command_center_screen.dart';
import '../../features/finance/presentation/screens/budget_variance_screen.dart';
import '../../features/finance/presentation/screens/audit_compliance_screen.dart';

// Procurement
import '../../features/procurement/presentation/screens/procurement_hub_screen.dart';
import '../../features/procurement/presentation/screens/procurement_requisition_form_screen.dart';
import '../../features/procurement/presentation/screens/procurement_approval_matrix_screen.dart';
import '../../features/procurement/presentation/screens/three_quote_compliance_screen.dart';
import '../../features/procurement/presentation/screens/procurement_tenders_screen.dart';
import '../../features/procurement/presentation/screens/procurement_tender_detail_screen.dart';
import '../../features/procurement/presentation/screens/procurement_notices_screen.dart';
import '../../features/procurement/presentation/screens/procurement_rfq_screen.dart';

// Imprest
import '../../features/imprest/presentation/screens/imprest_requisition_form_screen.dart';
import '../../features/imprest/presentation/screens/expense_retirement_screen.dart';
import '../../features/imprest/presentation/screens/expense_retirement_audit_screen.dart';

// Salary Advance
import '../../features/salary_advance/presentation/screens/salary_advance_request_screen.dart';
import '../../features/salary_advance/presentation/screens/salary_advance_preview_sign_screen.dart';
import '../../features/salary_advance/presentation/screens/salary_advance_hub_screen.dart';
import '../../features/salary_advance/presentation/screens/salary_advance_list_screen.dart';
import '../../features/salary_advance/presentation/screens/salary_advance_detail_screen.dart';

// HR
import '../../features/hr/presentation/screens/hr_governance_dashboard_screen.dart';
import '../../features/hr/presentation/screens/timesheets_incidents_screen.dart';

// Timesheets (dedicated module)
import '../../features/timesheets/presentation/screens/timesheet_list_screen.dart';
import '../../features/timesheets/presentation/screens/timesheet_weekly_screen.dart';
import '../../features/timesheets/presentation/screens/timesheet_day_screen.dart';
import '../../features/hr/presentation/screens/disciplinary_case_screen.dart';
import '../../features/hr/presentation/screens/report_new_incident_screen.dart';
import '../../features/hr/presentation/screens/payslip_screen.dart';
import '../../features/hr/presentation/screens/overtime_claim_form_screen.dart';
import '../../features/hr/presentation/screens/performance_tracker_screen.dart';
import '../../features/hr/presentation/screens/employee_performance_profile_screen.dart';
import '../../features/hr/presentation/screens/hr_directory_screen.dart';
import '../../features/hr/presentation/screens/hr_file_summary_screen.dart';
import '../../features/hr/presentation/screens/hr_file_documents_screen.dart';
import '../../features/hr/presentation/screens/hr_performance_dashboard_screen.dart';
import '../../features/hr/presentation/screens/supervisor_team_detail_screen.dart';
import '../../features/hr/presentation/screens/work_assignments_screen.dart';

// Assets
import '../../features/assets/presentation/screens/asset_inventory_screen.dart';
import '../../features/assets/presentation/screens/asset_request_screen.dart';
import '../../features/assets/presentation/screens/my_assigned_assets_screen.dart';
import '../../features/assets/presentation/screens/asset_condition_report_screen.dart';
import '../../features/assets/presentation/screens/fleet_transport_screen.dart';
import '../../features/assets/presentation/screens/fleet_vehicle_detail_screen.dart';

// Gap Pack 2 parity modules
import '../../features/assignments/presentation/screens/assignments_list_screen.dart';
import '../../features/assignments/presentation/screens/assignment_detail_screen.dart';
import '../../features/assignments/presentation/screens/assignment_create_screen.dart';
import '../../features/assignments/presentation/screens/assignments_calendar_screen.dart';
import '../../features/audit/presentation/screens/audit_management_screen.dart';
import '../../features/risk/presentation/screens/risk_register_screen.dart';
import '../../features/risk/presentation/screens/risk_detail_screen.dart';
import '../../features/correspondence/presentation/screens/correspondence_register_screen.dart';
import '../../features/correspondence/presentation/screens/correspondence_detail_screen.dart';
import '../../features/stock/presentation/screens/stock_scan_screen.dart';
import '../../features/weekly_summaries/presentation/screens/weekly_summaries_screen.dart';
import '../../features/weekly_summaries/presentation/screens/weekly_summary_detail_screen.dart';
import '../../features/finance/presentation/screens/budget_cashflow_screen.dart';

// Procurement detail + vendor screens
import '../../features/procurement/presentation/screens/procurement_detail_screen.dart';
import '../../features/procurement/presentation/screens/vendor_create_screen.dart';
import '../../features/procurement/presentation/screens/vendor_directory_screen.dart';
import '../../features/procurement/presentation/screens/vendor_detail_screen.dart';

// Calendar (SADC holidays, UN days)
import '../../features/calendar/presentation/screens/calendar_holidays_screen.dart';
import '../../features/calendar/presentation/screens/calendar_upload_screen.dart';

// PIF
import '../../features/pif/presentation/screens/pif_form_screen.dart';
import '../../features/pif/presentation/screens/pif_review_approval_screen.dart';
import '../../features/pif/presentation/screens/pif_lifecycle_flow_screen.dart';
import '../../features/pif/presentation/screens/pif_lifecycle_review_screen.dart';
import '../../features/pif/presentation/screens/pif_budget_screen.dart';

// Governance
import '../../features/governance/presentation/screens/delegation_meetings_screen.dart';
import '../../features/governance/presentation/screens/plenary_resolution_dashboard_screen.dart';
import '../../features/governance/presentation/screens/resolutions_oversight_screen.dart';
import '../../features/governance/presentation/screens/resolution_implementation_details_screen.dart';
import '../../features/governance/presentation/screens/regional_compliance_tracker_screen.dart';

// Approvals & Security
import '../../features/approvals/presentation/screens/secure_executive_approval_screen.dart';
import '../../features/approvals/presentation/screens/sg_pre_approval_review_screen.dart';
import '../../features/approvals/presentation/screens/biometric_entry_screen.dart';
import '../../features/approvals/presentation/screens/biometric_signature_screen.dart';

// Search, Offline, Analytics, Support, Profile Security, Executive
import '../../features/search/presentation/screens/search_reporting_screen.dart';
import '../../features/offline/presentation/screens/offline_drafts_screen.dart';
import '../../features/dashboard/presentation/screens/executive_cockpit_screen.dart';
import '../../features/analytics/presentation/screens/global_executive_summary_screen.dart';
import '../../features/support/presentation/screens/user_support_health_screen.dart';
import '../../features/profile/presentation/screens/user_profile_security_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../core/auth/auth_providers.dart';
import '../../core/auth/auth_session_controller.dart';
import '../../core/auth/feature_access.dart';

int? _routeIntParam(GoRouterState state, String name) {
  final raw = state.pathParameters[name];
  return raw == null ? null : int.tryParse(raw);
}

Map<String, dynamic>? _routeExtraMap(GoRouterState state) {
  final extra = state.extra;
  return extra is Map<String, dynamic> ? extra : null;
}

int? _routeExtraInt(GoRouterState state) {
  final extra = state.extra;
  if (extra is int) return extra;
  if (extra is String) return int.tryParse(extra);
  return null;
}

int? _mapInt(Map<String, dynamic>? map, String key) {
  final value = map?[key];
  if (value is int) return value;
  if (value is String) return int.tryParse(value);
  return null;
}

Widget _invalidRouteScreen({
  required String title,
  required String message,
  String fallbackRoute = '/dashboard',
}) {
  return _InvalidRouteScreen(
    title: title,
    message: message,
    fallbackRoute: fallbackRoute,
  );
}

class _InvalidRouteScreen extends StatelessWidget {
  const _InvalidRouteScreen({
    required this.title,
    required this.message,
    required this.fallbackRoute,
  });

  final String title;
  final String message;
  final String fallbackRoute;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.link_off_rounded,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 16),
              Text(
                'Cannot open this link',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => context.go(fallbackRoute),
                child: const Text('Go back'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  // ref.READ (not watch) â€” the router is created once.
  // refreshListenable handles all subsequent session changes reactively.
  // Using ref.watch here would recreate the entire GoRouter on every
  // auth state change, resetting navigation and breaking the dashboard.
  final sessionController = ref.read(authSessionControllerProvider);
  final router = GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: kDebugMode,
    refreshListenable: sessionController,
    redirect: (context, state) {
      final loc = state.uri.toString();
      final session = sessionController.state;
      final isSplash = loc.startsWith('/splash');
      final isLogin = loc.startsWith('/login');
      final isBiometricEntry = loc.startsWith('/biometric-entry');
      final isAccessDenied = loc.startsWith('/access-denied');

      if (session.status == AuthSessionStatus.unknown) {
        return isSplash ? null : '/splash';
      }

      // Bootstrap complete â€” always move off the splash screen.
      if (isSplash) {
        return session.isAuthenticated ? '/dashboard' : '/login';
      }

      if (!session.isAuthenticated) {
        return isLogin || isBiometricEntry ? null : '/login';
      }

      if (isLogin || isBiometricEntry) {
        return '/dashboard';
      }

      if (isAccessDenied) {
        return null;
      }

      if (!canAccessFeature(session.permissions, session.roles, loc)) {
        return Uri(
          path: '/access-denied',
          queryParameters: {'from': loc},
        ).toString();
      }

      return null;
    },
    routes: [
      // â”€â”€â”€ Splash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),

      // â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),

      // â”€â”€â”€ Biometric Entry (pre-auth) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/biometric-entry',
        name: 'biometric-entry',
        builder: (context, state) => const BiometricEntryScreen(),
      ),

      GoRoute(
        path: '/access-denied',
        name: 'access-denied',
        builder: (context, state) => AccessDeniedScreen(
          fromPath: state.uri.queryParameters['from'],
        ),
      ),

      // â”€â”€â”€ App shell with bottom navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            name: 'dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/requests',
            name: 'requests',
            builder: (context, state) => const RequestsScreen(),
            routes: [
              GoRoute(
                path: 'travel/new',
                name: 'travel-new',
                pageBuilder: (context, state) {
                  final extra = state.extra as Map<String, dynamic>?;
                  return MaterialPage(
                    fullscreenDialog: true,
                    child: TravelRequestFormScreen(
                      initialDraft: extra?['payload'] as Map<String, dynamic>?,
                      draftId: extra?['draftId'] as int?,
                    ),
                  );
                },
              ),
              GoRoute(
                path: 'travel/detail',
                name: 'travel-detail',
                builder: (context, state) => TravelRequestDetailScreen(
                  requestId: state.uri.queryParameters['id'],
                ),
              ),
              GoRoute(
                path: 'travel/finance-queue',
                name: 'travel-finance-queue',
                builder: (context, state) => const TravelFinanceQueueScreen(),
              ),
              GoRoute(
                path: 'travel/toil',
                name: 'travel-toil',
                builder: (context, state) => const TravelToilQueueScreen(),
              ),
              GoRoute(
                path: 'leave/new',
                name: 'leave-new',
                pageBuilder: (context, state) {
                  final extra = state.extra as Map<String, dynamic>?;
                  return MaterialPage(
                    fullscreenDialog: true,
                    child: LeaveRequestFormScreen(
                      initialDraft: extra?['payload'] as Map<String, dynamic>?,
                      draftId: extra?['draftId'] as int?,
                    ),
                  );
                },
              ),
              GoRoute(
                path: 'leave/balance',
                name: 'leave-balance',
                builder: (context, state) => const LeaveBalanceScreen(),
              ),
              GoRoute(
                path: 'leave/detail',
                name: 'leave-detail',
                builder: (context, state) => LeaveRequestDetailScreen(
                  requestId: state.uri.queryParameters['id'],
                ),
              ),
              GoRoute(
                path: 'imprest/detail',
                name: 'imprest-detail',
                builder: (context, state) => ImprestDetailScreen(
                  requestId: state.uri.queryParameters['id'],
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/approvals',
            name: 'approvals',
            builder: (context, state) => const ApprovalsScreen(),
          ),
          GoRoute(
            path: '/reports',
            name: 'reports',
            builder: (context, state) => const ReportsScreen(),
          ),
          GoRoute(
            path: '/reports/detail',
            name: 'report-detail',
            builder: (context, state) => ReportDetailScreen(
              reportType: state.uri.queryParameters['type'] ?? 'travel',
              reportTitle: state.uri.queryParameters['title'],
            ),
          ),
          GoRoute(
            path: '/profile',
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),

      // â”€â”€â”€ Finance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/finance/command-center',
        name: 'finance-command-center',
        builder: (context, state) => const FinanceCommandCenterScreen(),
      ),
      GoRoute(
        path: '/finance/budget-variance',
        name: 'finance-budget-variance',
        builder: (context, state) => const BudgetVarianceScreen(),
      ),
      GoRoute(
        path: '/finance/audit-compliance',
        name: 'finance-audit-compliance',
        builder: (context, state) => const AuditComplianceScreen(),
      ),

      // â”€â”€â”€ Procurement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/procurement',
        name: 'procurement-hub',
        builder: (context, state) => const ProcurementHubScreen(),
      ),
      GoRoute(
        path: '/procurement/vendors',
        name: 'vendor-directory',
        builder: (context, state) => const VendorDirectoryScreen(),
      ),
      GoRoute(
        path: '/procurement/vendors/new',
        name: 'vendor-create',
        builder: (context, state) => const VendorCreateScreen(),
      ),
      GoRoute(
        path: '/procurement/vendors/:id',
        name: 'vendor-detail',
        builder: (context, state) {
          final vendorId = _routeIntParam(state, 'id');
          if (vendorId == null) {
            return _invalidRouteScreen(
              title: 'Vendor',
              message: 'The vendor link is missing a valid numeric ID.',
              fallbackRoute: '/procurement/vendors',
            );
          }
          return VendorDetailScreen(vendorId: vendorId);
        },
      ),
      GoRoute(
        path: '/procurement/form',
        name: 'procurement-form',
        builder: (context, state) => const ProcurementRequisitionFormScreen(),
      ),
      GoRoute(
        path: '/procurement/tenders',
        name: 'procurement-tenders',
        builder: (context, state) => const ProcurementTendersScreen(),
      ),
      GoRoute(
        path: '/procurement/tenders/:id',
        name: 'procurement-tender-detail',
        builder: (context, state) {
          final tenderId = _routeIntParam(state, 'id');
          if (tenderId == null) {
            return _invalidRouteScreen(
              title: 'Tender',
              message: 'The tender link is missing a valid numeric ID.',
              fallbackRoute: '/procurement/tenders',
            );
          }
          return ProcurementTenderDetailScreen(tenderId: tenderId);
        },
      ),
      GoRoute(
        path: '/procurement/notices',
        name: 'procurement-notices',
        builder: (context, state) => const ProcurementNoticesScreen(),
      ),
      GoRoute(
        path: '/procurement/rfq/:id',
        name: 'procurement-rfq',
        builder: (context, state) {
          final requestId = _routeIntParam(state, 'id');
          if (requestId == null) {
            return _invalidRouteScreen(
              title: 'RFQ',
              message: 'The RFQ link is missing a valid numeric request ID.',
              fallbackRoute: '/procurement',
            );
          }
          return ProcurementRfqScreen(requestId: requestId);
        },
      ),
      GoRoute(
        path: '/procurement/approval-matrix',
        name: 'procurement-approval-matrix',
        builder: (context, state) => const ProcurementApprovalMatrixScreen(),
      ),
      GoRoute(
        path: '/procurement/three-quote',
        name: 'procurement-three-quote',
        builder: (context, state) => const ThreeQuoteComplianceScreen(),
      ),
      GoRoute(
        path: '/procurement/detail',
        name: 'procurement-detail',
        builder: (context, state) => ProcurementDetailScreen(
          requestId: state.uri.queryParameters['id'],
        ),
      ),

      // â”€â”€â”€ Imprest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/imprest/form',
        name: 'imprest-form',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ImprestRequisitionFormScreen(
            initialDraft: extra?['payload'] as Map<String, dynamic>?,
            draftId: extra?['draftId'] as int?,
          );
        },
      ),
      GoRoute(
        path: '/imprest/retirement',
        name: 'imprest-retirement',
        builder: (context, state) => ExpenseRetirementScreen(
          requestId: state.uri.queryParameters['id'],
        ),
      ),
      GoRoute(
        path: '/imprest/audit',
        name: 'imprest-audit',
        builder: (context, state) => ExpenseRetirementAuditScreen(
          requestId: state.uri.queryParameters['id'],
        ),
      ),

      // â”€â”€â”€ Salary Advance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/salary/advances',
        name: 'salary-advances-hub',
        builder: (context, state) => const SalaryAdvanceHubScreen(),
      ),
      GoRoute(
        path: '/salary/advances/applications',
        name: 'salary-advances-applications',
        builder: (context, state) => const SalaryAdvanceListScreen(
          queue: 'mine',
          title: 'My applications',
          subtitle: 'Your salary advance applications (open and in progress).',
          emptyHint:
              'You have not created any salary advance applications yet.',
        ),
      ),
      GoRoute(
        path: '/salary/advances/history',
        name: 'salary-advances-history',
        builder: (context, state) => const SalaryAdvanceListScreen(
          queue: 'history',
          title: 'My advance history',
          subtitle: 'Closed, recovered, rejected, and withdrawn advances.',
          emptyHint: 'No historical advances yet.',
        ),
      ),
      GoRoute(
        path: '/salary/advances/:id',
        name: 'salary-advance-detail',
        builder: (context, state) => SalaryAdvanceDetailScreen(
          requestId: state.pathParameters['id'],
        ),
      ),
      GoRoute(
        path: '/salary/advance/new',
        name: 'salary-advance-new',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return SalaryAdvanceRequestScreen(
            initialDraft: extra?['payload'] as Map<String, dynamic>?,
            draftId: extra?['draftId'] as int?,
          );
        },
      ),
      GoRoute(
        path: '/salary/advance/preview',
        name: 'salary-advance-preview',
        builder: (context, state) => SalaryAdvancePreviewSignScreen(
          requestId: state.uri.queryParameters['id'],
        ),
      ),

      // â”€â”€â”€ HR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/hr/dashboard',
        name: 'hr-dashboard',
        builder: (context, state) => const HrGovernanceDashboardScreen(),
      ),
      GoRoute(
        path: '/hr/timesheets',
        name: 'hr-timesheets',
        builder: (context, state) => const TimesheetsIncidentsScreen(),
      ),
      // Dedicated timesheet module routes
      GoRoute(
        path: '/timesheets',
        name: 'timesheets',
        builder: (context, state) => const TimesheetListScreen(),
      ),
      GoRoute(
        path: '/timesheets/weekly',
        name: 'timesheets-weekly',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return TimesheetWeeklyScreen(
            timesheetId: extra?['timesheetId'] as int?,
          );
        },
      ),
      GoRoute(
        path: '/timesheets/day',
        name: 'timesheets-day',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return TimesheetDayScreen(
            date: extra?['date'] as String? ?? '',
            timesheetId: extra?['timesheetId'] as int?,
            initialEntries: (extra?['entries'] as List<dynamic>? ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList(),
            projects: (extra?['projects'] as List<dynamic>? ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList(),
            overlayLabel: extra?['overlayLabel'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/hr/assignments',
        name: 'hr-work-assignments',
        builder: (context, state) => const WorkAssignmentsScreen(),
      ),
      GoRoute(
        path: '/hr/disciplinary',
        name: 'hr-disciplinary',
        builder: (context, state) => const DisciplinaryCaseScreen(),
      ),
      GoRoute(
        path: '/hr/incident/new',
        name: 'hr-incident-new',
        builder: (context, state) => const ReportNewIncidentScreen(),
      ),
      GoRoute(
        path: '/hr/payslip',
        name: 'hr-payslip',
        builder: (context, state) => const PayslipScreen(),
      ),
      GoRoute(
        path: '/hr/overtime/new',
        name: 'hr-overtime-new',
        builder: (context, state) => const OvertimeClaimFormScreen(),
      ),

      // â”€â”€â”€ SADC Calendar & Holidays â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/calendar',
        name: 'calendar-holidays',
        builder: (context, state) => const CalendarHolidaysScreen(),
        routes: [
          GoRoute(
            path: 'upload',
            name: 'calendar-upload',
            pageBuilder: (context, state) => const MaterialPage(
              fullscreenDialog: true,
              child: CalendarUploadScreen(),
            ),
          ),
        ],
      ),

      // â”€â”€â”€ Assets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/assets/inventory',
        name: 'assets-inventory',
        builder: (context, state) => const AssetInventoryScreen(),
      ),
      GoRoute(
        path: '/assets/request',
        name: 'assets-request',
        builder: (context, state) {
          final extra = state.extra is Map<String, dynamic>
              ? state.extra as Map<String, dynamic>
              : null;
          final itemName = extra?['itemName'] as String?;
          final isReorder = extra?['requestType'] == 'stock_reorder' &&
              itemName != null &&
              itemName.trim().isNotEmpty;
          return AssetRequestScreen(
            initialJustification: isReorder
                ? 'Request stock reorder for ${itemName.trim()}.'
                : null,
          );
        },
      ),
      GoRoute(
        path: '/assets/assigned',
        name: 'assets-assigned',
        builder: (context, state) => const MyAssignedAssetsScreen(),
      ),
      GoRoute(
        path: '/assets/condition-report',
        name: 'assets-condition-report',
        builder: (context, state) => const AssetConditionReportScreen(),
      ),
      GoRoute(
        path: '/assets/fleet',
        name: 'assets-fleet',
        builder: (context, state) => const FleetTransportScreen(),
      ),
      GoRoute(
        path: '/fleet/:id',
        name: 'fleet-vehicle-detail',
        builder: (context, state) {
          final vehicleId = _routeIntParam(state, 'id');
          if (vehicleId == null) {
            return _invalidRouteScreen(
              title: 'Fleet',
              message: 'The fleet link is missing a valid numeric vehicle ID.',
              fallbackRoute: '/assets/fleet',
            );
          }
          return FleetVehicleDetailScreen(vehicleId: vehicleId);
        },
      ),

      // â”€â”€â”€ Gap Pack 2 modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/assignments',
        name: 'accountability-assignments',
        builder: (context, state) => const AssignmentsListScreen(),
      ),
      GoRoute(
        path: '/audit',
        name: 'audit-management',
        builder: (context, state) => const AuditManagementScreen(),
      ),
      GoRoute(
        path: '/assignments/create',
        name: 'assignments-create',
        builder: (context, state) => const AssignmentCreateScreen(),
      ),
      GoRoute(
        path: '/assignments/calendar',
        name: 'assignments-calendar',
        builder: (context, state) => const AssignmentsCalendarScreen(),
      ),
      GoRoute(
        path: '/assignments/:id',
        name: 'assignments-detail',
        builder: (context, state) {
          final assignmentId = _routeIntParam(state, 'id');
          if (assignmentId == null) {
            return _invalidRouteScreen(
              title: 'Assignment',
              message: 'The assignment link is missing a valid numeric ID.',
              fallbackRoute: '/assignments',
            );
          }
          return AssignmentDetailScreen(assignmentId: assignmentId);
        },
      ),
      GoRoute(
        path: '/risk',
        name: 'risk-register',
        builder: (context, state) => const RiskRegisterScreen(),
      ),
      GoRoute(
        path: '/risk/:id',
        name: 'risk-detail',
        builder: (context, state) {
          final riskId = _routeIntParam(state, 'id');
          if (riskId == null) {
            return _invalidRouteScreen(
              title: 'Risk',
              message: 'The risk link is missing a valid numeric ID.',
              fallbackRoute: '/risk',
            );
          }
          return RiskDetailScreen(riskId: riskId);
        },
      ),
      GoRoute(
        path: '/correspondence',
        name: 'correspondence',
        builder: (context, state) => const CorrespondenceRegisterScreen(),
      ),
      GoRoute(
        path: '/correspondence/:id',
        name: 'correspondence-detail',
        builder: (context, state) {
          final letterId = _routeIntParam(state, 'id');
          if (letterId == null) {
            return _invalidRouteScreen(
              title: 'Correspondence',
              message: 'The correspondence link is missing a valid numeric ID.',
              fallbackRoute: '/correspondence',
            );
          }
          return CorrespondenceDetailScreen(letterId: letterId);
        },
      ),
      GoRoute(
        path: '/stock/scan',
        name: 'stock-scan',
        builder: (context, state) => const StockScanScreen(),
      ),
      GoRoute(
        path: '/weekly-summaries',
        name: 'weekly-summaries',
        builder: (context, state) => const WeeklySummariesScreen(),
      ),
      GoRoute(
        path: '/weekly-summaries/:id',
        name: 'weekly-summary-detail',
        builder: (context, state) {
          final reportId = _routeIntParam(state, 'id');
          if (reportId == null) {
            return _invalidRouteScreen(
              title: 'Weekly Summary',
              message: 'The weekly summary link is missing a valid numeric ID.',
              fallbackRoute: '/weekly-summaries',
            );
          }
          return WeeklySummaryDetailScreen(reportId: reportId);
        },
      ),
      GoRoute(
        path: '/budget/cashflow',
        name: 'budget-cashflow',
        builder: (context, state) => const BudgetCashflowScreen(),
      ),

      // â”€â”€â”€ PIF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/pif/form',
        name: 'pif-form',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return PifFormScreen(
            initialDraft: extra?['payload'] as Map<String, dynamic>?,
            draftId: extra?['draftId'] as int?,
          );
        },
      ),
      GoRoute(
        path: '/pif/review',
        name: 'pif-review',
        builder: (context, state) => PifReviewApprovalScreen(
          programmeId: state.uri.queryParameters['id'],
        ),
      ),
      GoRoute(
        path: '/pif/lifecycle',
        name: 'pif-lifecycle',
        builder: (context, state) => PifLifecycleFlowScreen(
          programmeId: state.uri.queryParameters['id'],
        ),
      ),
      GoRoute(
        path: '/pif/lifecycle-review',
        name: 'pif-lifecycle-review',
        builder: (context, state) => PifLifecycleReviewScreen(
          programmeId: state.uri.queryParameters['id'],
        ),
      ),
      GoRoute(
        path: '/pif/budget',
        name: 'pif-budget',
        builder: (context, state) => PifBudgetScreen(
          programmeId: state.uri.queryParameters['id'],
        ),
      ),

      // â”€â”€â”€ Governance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/governance/meetings',
        name: 'governance-meetings',
        builder: (context, state) => const DelegationMeetingsScreen(),
      ),
      GoRoute(
        path: '/governance/resolutions',
        name: 'governance-resolutions',
        builder: (context, state) => const PlenaryResolutionDashboardScreen(),
      ),
      GoRoute(
        path: '/governance/oversight',
        name: 'governance-oversight',
        builder: (context, state) => const ResolutionsOversightScreen(),
      ),
      GoRoute(
        path: '/governance/resolutions/details',
        name: 'governance-resolution-details',
        builder: (context, state) {
          final resolution = state.extra as Map<String, dynamic>?;
          return ResolutionImplementationDetailsScreen(resolution: resolution);
        },
      ),
      GoRoute(
        path: '/governance/compliance',
        name: 'governance-compliance',
        builder: (context, state) => const RegionalComplianceTrackerScreen(),
      ),

      // â”€â”€â”€ Approvals & Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/approvals/secure-executive',
        name: 'secure-executive-approval',
        builder: (context, state) => const SecureExecutiveApprovalScreen(),
      ),
      GoRoute(
        path: '/approvals/sg-review',
        name: 'sg-pre-approval-review',
        builder: (context, state) => const SgPreApprovalReviewScreen(),
      ),
      GoRoute(
        path: '/approvals/biometric-sign',
        name: 'biometric-signature',
        builder: (context, state) => const BiometricSignatureScreen(),
      ),

      // â”€â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/search',
        name: 'search',
        builder: (context, state) => const SearchReportingScreen(),
      ),

      // â”€â”€â”€ Offline Drafts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/offline/drafts',
        name: 'offline-drafts',
        builder: (context, state) => const OfflineDraftsScreen(),
      ),

      // â”€â”€â”€ Executive & Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/dashboard/executive-cockpit',
        name: 'executive-cockpit',
        builder: (context, state) => const ExecutiveCockpitScreen(),
      ),
      GoRoute(
        path: '/analytics/global-summary',
        name: 'global-executive-summary',
        builder: (context, state) => const GlobalExecutiveSummaryScreen(),
      ),

      // â”€â”€â”€ Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/support',
        name: 'support',
        builder: (context, state) => const UserSupportHealthScreen(),
      ),

      // â”€â”€â”€ HR Performance & Files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/hr/performance',
        name: 'hrPerformance',
        builder: (context, state) => const PerformanceTrackerScreen(),
      ),
      GoRoute(
        path: '/hr/performance/detail',
        name: 'hrPerformanceDetail',
        builder: (context, state) {
          final tracker = _routeExtraMap(state);
          if (tracker == null) {
            return _invalidRouteScreen(
              title: 'Performance',
              message:
                  'This performance profile needs tracker data. Open it from the performance list.',
              fallbackRoute: '/hr/performance',
            );
          }
          return EmployeePerformanceProfileScreen(tracker: tracker);
        },
      ),
      GoRoute(
        path: '/hr/files',
        name: 'hrFiles',
        builder: (context, state) => const HrDirectoryScreen(),
      ),
      GoRoute(
        path: '/hr/files/detail',
        name: 'hrFileDetail',
        builder: (context, state) {
          final fileId = _routeExtraInt(state);
          if (fileId == null) {
            return _invalidRouteScreen(
              title: 'HR Personal File',
              message:
                  'This personal file link is missing a valid file ID. Open it from the HR files directory.',
              fallbackRoute: '/hr/files',
            );
          }
          return HrFileSummaryScreen(fileId: fileId);
        },
      ),
      GoRoute(
        path: '/hr/files/documents',
        name: 'hrFileDocuments',
        builder: (context, state) {
          final extra = _routeExtraMap(state);
          final fileId = _mapInt(extra, 'fileId');
          final employeeName = extra?['employeeName'] as String?;
          if (fileId == null ||
              employeeName == null ||
              employeeName.trim().isEmpty) {
            return _invalidRouteScreen(
              title: 'HR Documents',
              message:
                  'This documents link is missing file details. Open it from the HR file summary.',
              fallbackRoute: '/hr/files',
            );
          }
          return HrFileDocumentsScreen(
            fileId: fileId,
            employeeName: employeeName.trim(),
          );
        },
      ),
      GoRoute(
        path: '/hr/performance/hr-dashboard',
        name: 'hrPerformanceDashboard',
        builder: (context, state) => const HrPerformanceDashboardScreen(),
      ),
      GoRoute(
        path: '/hr/performance/team',
        name: 'hrPerformanceTeam',
        builder: (context, state) => const SupervisorTeamDetailScreen(),
      ),

      // â”€â”€â”€ Profile Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/profile/security',
        name: 'profile-security',
        builder: (context, state) => const UserProfileSecurityScreen(),
      ),

      // â”€â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
    ],
  );
  return router;
});
