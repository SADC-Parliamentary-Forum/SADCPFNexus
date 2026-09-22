<?php

namespace App\Modules\Assets\Reporting;

final class AssetReportCatalogue
{
    public const TEMPLATE_VERSION = '2.0';

    /**
     * @return list<array{id:string,family:string,name:string,purpose:string,priority:string,formats:list<string>}>
     */
    public static function all(): array
    {
        $pdfXlsxCsv = ['screen', 'pdf', 'xlsx', 'csv', 'print'];
        $rows = [
            ['R01', 'Custody', 'Assets assigned to a specific user', 'Current accountable assets, loans and acknowledgement status.', 'must'],
            ['R02', 'Custody', 'User asset statement', 'Printable signature-ready statement for one custodian.', 'must'],
            ['R03', 'Custody', 'Assets by department', 'Holdings grouped by department and custodian.', 'must'],
            ['R04', 'Custody', 'Unassigned active assets', 'Assets active but without a valid custodian or store owner.', 'must'],
            ['R05', 'Custody', 'Temporary loans overdue', 'Loan assets past expected return date.', 'must'],
            ['R06', 'Custody', 'Pending acknowledgement', 'Assignments not accepted within configured time.', 'must'],
            ['R07', 'Custody', 'Returned assets', 'Returns by date, user, condition and receiving officer.', 'should'],
            ['R08', 'Custody', 'Custody history', 'Full assignment chain for selected assets or users.', 'must'],
            ['R09', 'Custody', 'Staff clearance', 'Assets and unresolved responsibilities for transfer or separation.', 'must'],
            ['R10', 'Custody', 'Shared and pooled assets', 'Shared assets with accountable unit, booking and location.', 'should'],
            ['R11', 'Inventory', 'Master fixed asset register', 'Authoritative asset listing with financial and operational fields.', 'must'],
            ['R12', 'Inventory', 'Controlled non-capital items', 'Long-life items expensed on purchase but tracked physically.', 'must'],
            ['R13', 'Inventory', 'Assets by location', 'Site, building, floor and room holdings.', 'must'],
            ['R14', 'Inventory', 'Assets by class', 'Counts and values by asset category.', 'must'],
            ['R15', 'Inventory', 'Asset movement register', 'Location or custodian movements and receipt status.', 'must'],
            ['R16', 'Inventory', 'Assets in transit', 'Approved movements not yet received.', 'must'],
            ['R17', 'Inventory', 'New acquisitions', 'Assets acquired or capitalised during a period.', 'must'],
            ['R18', 'Inventory', 'Grant and donated assets', 'Assets obtained by grant or donation and their valuation status.', 'must'],
            ['R19', 'Inventory', 'Untagged or unreadable tags', 'Assets requiring tag issue or replacement.', 'must'],
            ['R20', 'Inventory', 'Parent and component assets', 'Bundles, components and dependencies.', 'should'],
            ['R21', 'Financial', 'Depreciation schedule', 'Opening value, additions, disposals, depreciation and closing value.', 'must'],
            ['R22', 'Financial', 'Net book value by class', 'Cost, accumulated depreciation and NBV by class.', 'must'],
            ['R23', 'Financial', 'Fully depreciated assets still in use', 'Zero-NBV assets requiring continued control or replacement review.', 'must'],
            ['R24', 'Financial', 'Capital expenditure vs budget', 'Approved capital budget, commitments and actual acquisitions.', 'should'],
            ['R25', 'Financial', 'Asset additions reconciliation', 'Register additions matched to procurement, invoices and GL.', 'must'],
            ['R26', 'Financial', 'Disposals reconciliation', 'Register disposals matched to approvals, proceeds and GL entries.', 'must'],
            ['R27', 'Financial', 'Depreciation exceptions', 'Missing useful life, invalid rate, negative NBV, late capitalisation or posting mismatch.', 'must'],
            ['R28', 'Financial', 'Impairment and revaluation', 'Changes to carrying value with approvals and evidence.', 'should'],
            ['R29', 'Financial', 'Funding source schedule', 'Cost and NBV by core, donor, project or grant.', 'must'],
            ['R30', 'Financial', 'Foreign-currency acquisition schedule', 'Original and functional currency acquisition values and rate reference.', 'should'],
            ['R31', 'Verification', 'Campaign progress', 'Population, scanned, verified, exceptions and completion rate.', 'must'],
            ['R32', 'Verification', 'Register not found physically', 'Expected assets not located during verification.', 'must'],
            ['R33', 'Verification', 'Found not on register', 'Items located but not matched to an asset record.', 'must'],
            ['R34', 'Verification', 'Location mismatch', 'Scanned location differs from register location.', 'must'],
            ['R35', 'Verification', 'Custodian mismatch', 'Physical custodian differs from recorded assignment.', 'must'],
            ['R36', 'Verification', 'Condition mismatch', 'Observed condition differs from current record.', 'should'],
            ['R37', 'Verification', 'Verification discrepancy value', 'Exceptions quantified at cost and NBV.', 'must'],
            ['R38', 'Verification', 'Verification sign-off pack', 'Campaign scope, results, approvals and unresolved exceptions.', 'must'],
            ['R39', 'Maintenance', 'Warranty expiry', 'Warranties expiring in selected horizon.', 'should'],
            ['R40', 'Maintenance', 'Service due and overdue', 'Preventive service calendar and overdue actions.', 'must'],
            ['R41', 'Maintenance', 'Repair history and cost', 'Repairs, downtime, vendor and cumulative costs.', 'should'],
            ['R42', 'Maintenance', 'High-cost or repeat-failure assets', 'Assets exceeding repair threshold or repeated incidents.', 'should'],
            ['R43', 'Maintenance', 'Assets unavailable', 'Assets under repair, damaged or awaiting parts.', 'must'],
            ['R44', 'Disposal', 'Disposal candidates', 'Obsolete, unsafe, uneconomic or idle assets proposed for review.', 'must'],
            ['R45', 'Disposal', 'Pending disposal approvals', 'Age and status of disposal requests.', 'must'],
            ['R46', 'Disposal', 'Disposed and written-off assets', 'Completed disposals with method, buyer, proceeds and approvals.', 'must'],
            ['R47', 'Disposal', 'Disposal valuation and bids', 'Valuations, reserve price, offers and selected outcome.', 'must'],
            ['R48', 'Risk', 'Missing stolen or damaged assets', 'Open incidents, exposure, responsible owner and action.', 'must'],
            ['R49', 'Risk', 'Insurance schedule and claims', 'Insured assets, coverage gaps, claims and supporting evidence.', 'should'],
            ['R50', 'Management', 'Executive asset dashboard', 'Counts, values, custody, verification, risk, maintenance and replacement indicators.', 'must'],
            ['R51', 'Management', 'Replacement forecast', 'Assets reaching useful-life, condition or support thresholds by year.', 'should'],
            ['R52', 'Audit', 'Asset audit trail and data-quality exceptions', 'Who changed what and when; duplicates, incomplete and inconsistent records.', 'must'],
        ];

        return array_map(static fn (array $row) => [
            'id' => $row[0],
            'family' => $row[1],
            'name' => $row[2],
            'purpose' => $row[3],
            'priority' => $row[4],
            'formats' => $pdfXlsxCsv,
            'template_version' => self::TEMPLATE_VERSION,
        ], $rows);
    }

    public static function find(string $id): ?array
    {
        foreach (self::all() as $report) {
            if ($report['id'] === $id) {
                return $report;
            }
        }

        return null;
    }
}
