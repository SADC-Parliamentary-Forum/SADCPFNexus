import 'package:flutter_test/flutter_test.dart';
import 'package:sadcpf_nexus/features/salary_advance/data/salary_advance_helpers.dart';

void main() {
  group('salary_advance_helpers', () {
    test('extractListData unwraps {data: [...]}', () {
      final list = extractSalaryAdvanceList({
        'data': [
          {'id': 1, 'reference_number': 'ADV-1'},
          {'id': 2, 'reference_number': 'ADV-2'},
        ],
      });
      expect(list.length, 2);
      expect(list.first['reference_number'], 'ADV-1');
    });

    test('extractListData accepts bare arrays', () {
      final list = extractSalaryAdvanceList([
        {'id': 9},
      ]);
      expect(list.single['id'], 9);
    });

    test('extractObjectData unwraps nested data', () {
      final obj = extractSalaryAdvanceObject({
        'data': {'id': 3, 'status': 'submitted'},
      });
      expect(obj?['id'], 3);
      expect(obj?['status'], 'submitted');
    });

    test('formatSaCurrency formats NAD amounts', () {
      expect(formatSaCurrency(1500.5), 'N\$ 1,500.50');
      expect(formatSaCurrency(null), 'N\$ 0.00');
      expect(formatSaCurrency(10, currency: 'USD'), 'USD 10.00');
    });

    test('salaryAdvanceStatusConfig covers Phase 2/3 statuses', () {
      expect(salaryAdvanceStatusConfig('submitted').label, 'Pending Finance Certify');
      expect(salaryAdvanceStatusConfig('finance_certified').label, 'Finance Certified');
      expect(salaryAdvanceStatusConfig('recovery_scheduled').label, 'Recovery Scheduled');
      expect(salaryAdvanceStatusConfig('reconciliation_required').label, 'Needs Reconciliation');
      expect(salaryAdvanceStatusConfig('paid').label, 'Paid');
    });

    test('canViewSalaryAdvanceFinanceQueues requires finance approvals or roles', () {
      expect(
        canViewSalaryAdvanceFinanceQueues(
          permissions: ['finance.view'],
          roles: ['Staff'],
        ),
        isFalse,
      );
      expect(
        canViewSalaryAdvanceFinanceQueues(
          permissions: ['finance.approve'],
          roles: ['Staff'],
        ),
        isTrue,
      );
      expect(
        canViewSalaryAdvanceFinanceQueues(
          permissions: [],
          roles: ['Finance Controller'],
        ),
        isTrue,
      );
    });

    test('outstandingBalanceFromRegister reads balance_register.balance', () {
      expect(
        outstandingBalanceFromRegister({
          'balance_register': {'balance': 2500.25, 'status': 'open'},
        }),
        2500.25,
      );
      expect(outstandingBalanceFromRegister({'status': 'draft'}), 0);
    });

    test('employeeSummary cards parse eligibility and current request', () {
      final summary = parseEmployeeSummary({
        'data': {
          'eligibility': {
            'eligible': true,
            'net_salary': 10000,
            'max_eligible': 5000,
            'exposure': {
              'outstanding_balance': 0,
              'blocked': false,
              'reasons': <String>[],
            },
            'policy': {'version': 'v1', 'recovery_rule': 'full_eom'},
          },
          'current_request': {
            'id': 7,
            'reference_number': 'ADV-ABC',
            'status': 'submitted',
            'amount': 2000,
            'currency': 'NAD',
          },
          'active_advance': null,
          'history': [
            {'id': 1, 'status': 'closed', 'amount': 1000},
          ],
        },
      });

      expect(summary.eligibility.eligible, isTrue);
      expect(summary.eligibility.maxEligible, 5000);
      expect(summary.currentRequest?['id'], 7);
      expect(summary.activeAdvance, isNull);
      expect(summary.history.length, 1);
    });
  });
}
