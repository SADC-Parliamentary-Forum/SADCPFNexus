import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Auth & Shell
import '../../features/splash/presentation/screens/splash_screen.dart';
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
import '../../features/requests/presentation/screens/leave_request_form_screen.dart';
import '../../features/requests/presentation/screens/leave_request_detail_screen.dart';
import '../../features/requests/presentation/screens/leave_balance_screen.dart';
import '../../features/imprest/presentation/screens/imprest_detail_screen.dart';

// Finance
import '../../features/finance/presentation/screens/finance_command_center_screen.dart';
import '../../features/finance/presentation/screens/budget_variance_screen.dart';
import '../../features/finance/presentation/screens/audit_compliance_screen.dart';

// Procurement
import '../../features/procurement/presentation/screens/procurement_requisition_form_screen.dart';
import '../../features/procurement/presentation/screens/procurement_approval_matrix_screen.dart';
import '../../features/procurement/presentation/screens/three_quote_compliance_screen.dart';

// Imprest
import '../../features/imprest/presentation/screens/imprest_requisition_form_screen.dart';
import '../../features/imprest/presentation/screens/expense_retirement_screen.dart';
import '../../features/imprest/presentation/screens/expense_retirement_audit_screen.dart';

// Salary Advance
import '../../features/salary_advance/presentation/screens/salary_advance_request_screen.dart';
import '../../features/salary_advance/presentation/screens/salary_advance_preview_sign_screen.dart';

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

// Procurement detail + vendor screens
import '../../features/procurement/presentation/screens/procurement_detail_screen.dart';
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

final routerProvider = Provider<GoRouter>((ref) {
  // ref.READ (not watch) — the router is created once.
  // refreshListenable handles all subsequent session changes reactively.
  // Using ref.watch here would recreate the entire GoRouter on every
  // auth state change, resetting navigation and breaking the dashboard.
  final sessionController = ref.read(authSessionControllerProvider);
  final router = GoRouter(
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    refreshListenable: sessionController,
    redirect: (context, state) {
      final loc = state.uri.toString();
      final session = sessionController.state;
      final isSplash = loc.startsWith('/splash');
      final isLogin = loc.startsWith('/login');
      final isBiometricEntry = loc.startsWith('/biometric-entry');
      final isPublicRoute = isSplash || isLogin || isBiometricEntry;

      if (session.status == AuthSessionStatus.unknown) {
        return isSplash ? null : '/splash';
      }

      // Bootstrap complete — always move off the splash screen.
      if (isSplash) {
        return session.isAuthenticated ? '/dashboard' : '/login';
      }

      if (!session.isAuthenticated) {
        return isLogin || isBiometricEntry ? null : '/login';
      }

      if (isLogin || isBiometricEntry) {
        return '/dashboard';
      }

      if (!canAccessFeature(session.permissions, session.roles, loc)) {
        return '/dashboard';
      }

      return null;
    },
    routes: [
      // ─── Splash ────────────────────────────────────────────────────────────
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),

      // ─── Auth ──────────────────────────────────────────────────────────────
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),

      // ─── Biometric Entry (pre-auth) ─────────────────────────────────────────
      GoRoute(
        path: '/biometric-entry',
        name: 'biometric-entry',
        builder: (context, state) => const BiometricEntryScreen(),
      ),

      // ─── App shell with bottom navigation ──────────────────────────────────
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
                builder: (context, state) => const ImprestDetailScreen(),
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

      // ─── Finance ───────────────────────────────────────────────────────────
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

      // ─── Procurement ───────────────────────────────────────────────────────
      GoRoute(
        path: '/procurement/vendors',
        name: 'vendor-directory',
        builder: (context, state) => const VendorDirectoryScreen(),
      ),
      GoRoute(
        path: '/procurement/vendors/:id',
        name: 'vendor-detail',
        builder: (context, state) => VendorDetailScreen(
          vendorId: int.parse(state.pathParameters['id']!),
        ),
      ),
      GoRoute(
        path: '/procurement/form',
        name: 'procurement-form',
        builder: (context, state) => const ProcurementRequisitionFormScreen(),
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
        builder: (context, state) => const ProcurementDetailScreen(),
      ),

      // ─── Imprest ───────────────────────────────────────────────────────────
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
        builder: (context, state) => const ExpenseRetirementScreen(),
      ),
      GoRoute(
        path: '/imprest/audit',
        name: 'imprest-audit',
        builder: (context, state) => const ExpenseRetirementAuditScreen(),
      ),

      // ─── Salary Advance ────────────────────────────────────────────────────
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
        builder: (context, state) => const SalaryAdvancePreviewSignScreen(),
      ),

      // ─── HR ────────────────────────────────────────────────────────────────
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
            date:           extra?['date'] as String? ?? '',
            timesheetId:    extra?['timesheetId'] as int?,
            initialEntries: (extra?['entries'] as List<dynamic>? ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList(),
            projects:       (extra?['projects'] as List<dynamic>? ?? [])
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList(),
            overlayLabel:   extra?['overlayLabel'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/hr/assignments',
        name: 'hr-assignments',
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

      // ─── SADC Calendar & Holidays ─────────────────────────────────────────
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

      // ─── Assets ────────────────────────────────────────────────────────────
      GoRoute(
        path: '/assets/inventory',
        name: 'assets-inventory',
        builder: (context, state) => const AssetInventoryScreen(),
      ),
      GoRoute(
        path: '/assets/request',
        name: 'assets-request',
        builder: (context, state) => const AssetRequestScreen(),
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

      // ─── PIF ───────────────────────────────────────────────────────────────
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
        builder: (context, state) => const PifLifecycleFlowScreen(),
      ),
      GoRoute(
        path: '/pif/lifecycle-review',
        name: 'pif-lifecycle-review',
        builder: (context, state) => const PifLifecycleReviewScreen(),
      ),
      GoRoute(
        path: '/pif/budget',
        name: 'pif-budget',
        builder: (context, state) => PifBudgetScreen(
          programmeId: state.uri.queryParameters['id'],
        ),
      ),

      // ─── Governance ────────────────────────────────────────────────────────
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

      // ─── Approvals & Security ──────────────────────────────────────────────
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

      // ─── Search ────────────────────────────────────────────────────────────
      GoRoute(
        path: '/search',
        name: 'search',
        builder: (context, state) => const SearchReportingScreen(),
      ),

      // ─── Offline Drafts ────────────────────────────────────────────────────
      GoRoute(
        path: '/offline/drafts',
        name: 'offline-drafts',
        builder: (context, state) => const OfflineDraftsScreen(),
      ),

      // ─── Executive & Analytics ─────────────────────────────────────────────
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

      // ─── Support ───────────────────────────────────────────────────────────
      GoRoute(
        path: '/support',
        name: 'support',
        builder: (context, state) => const UserSupportHealthScreen(),
      ),

      // ─── HR Performance & Files ────────────────────────────────────────────
      GoRoute(
        path: '/hr/performance',
        name: 'hrPerformance',
        builder: (context, state) => const PerformanceTrackerScreen(),
      ),
      GoRoute(
        path: '/hr/performance/detail',
        name: 'hrPerformanceDetail',
        builder: (context, state) {
          final tracker = state.extra as Map<String, dynamic>;
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
          final fileId = state.extra as int;
          return HrFileSummaryScreen(fileId: fileId);
        },
      ),
      GoRoute(
        path: '/hr/files/documents',
        name: 'hrFileDocuments',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return HrFileDocumentsScreen(
            fileId: extra['fileId'] as int,
            employeeName: extra['employeeName'] as String,
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

      // ─── Profile Security ──────────────────────────────────────────────────
      GoRoute(
        path: '/profile/security',
        name: 'profile-security',
        builder: (context, state) => const UserProfileSecurityScreen(),
      ),

      // ─── Notifications ─────────────────────────────────────────────────────
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
    ],
  );
  return router;
});
