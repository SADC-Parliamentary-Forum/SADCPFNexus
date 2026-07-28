<?php

namespace App\Modules\WeeklyReports\Services;

use App\Models\LeaveRequest;
use App\Models\User;
use App\Models\WeeklyReport;
use App\Models\WeeklyReportSuggestionDecision;
use App\Models\WeeklyReportingPeriod;
use App\Modules\Assignments\Services\AssignmentService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Source suggestions are never auto-submitted. Employee must include explicitly.
 */
class WeeklySuggestionService
{
    public function __construct(
        private readonly AssignmentService $assignments,
    ) {}

    public function suggestions(User $employee, WeeklyReportingPeriod $period, ?WeeklyReport $report = null): array
    {
        $feed = $this->assignments->weeklySummaryFeed(
            $employee,
            $period->start_date->toDateString(),
            $period->end_date->toDateString()
        );

        $decisions = [];
        if ($report) {
            $decisions = WeeklyReportSuggestionDecision::where('weekly_report_id', $report->id)
                ->get()
                ->keyBy(fn ($d) => $d->source_type.':'.$d->source_id)
                ->all();
        }

        $mapAssignment = function ($row, string $section) use ($decisions): array {
            $key = 'assignment:'.$row->id;
            $decision = $decisions[$key]->decision ?? null;

            return [
                'source_type' => 'assignment',
                'source_id' => $row->id,
                'reference' => $row->reference_number ?? null,
                'title' => $row->title,
                'status' => $row->status ?? null,
                'suggested_section' => $section,
                'confidentiality' => ! empty($row->is_confidential) ? 'confidential' : 'internal',
                'decision' => $decision,
                'meta' => [
                    'due_date' => $row->due_date ?? null,
                    'progress_percent' => $row->progress_percent ?? null,
                ],
            ];
        };

        $suggestions = [];
        foreach ($feed['completed'] ?? [] as $row) {
            $suggestions[] = $mapAssignment($row, 'achievement');
        }
        foreach ($feed['active'] ?? [] as $row) {
            $suggestions[] = $mapAssignment($row, 'wip');
        }
        foreach ($feed['blocked'] ?? [] as $row) {
            $suggestions[] = $mapAssignment($row, 'blocker');
        }
        foreach ($feed['upcoming_deadlines'] ?? [] as $row) {
            $suggestions[] = $mapAssignment($row, 'priority');
        }

        $suggestions = array_merge(
            $suggestions,
            $this->leaveSuggestions($employee, $period),
            $this->travelSuggestions($employee, $period),
            $this->correspondenceSuggestions($employee, $period),
            $this->pifSuggestions($employee, $period),
            $this->timesheetSuggestions($employee, $period),
        );

        $deferred = array_values(array_filter($suggestions, fn ($s) => ! empty($s['is_placeholder'])));
        $suggestions = array_values(array_filter($suggestions, fn ($s) => empty($s['is_placeholder'])));

        // Deduplicate by source_type+source_id keeping first.
        $seen = [];
        $unique = [];
        foreach ($suggestions as $s) {
            $k = $s['source_type'].':'.$s['source_id'];
            if (isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            if (isset($decisions[$k])) {
                $s['decision'] = $decisions[$k]->decision;
            }
            $unique[] = $s;
        }

        return [
            'period_id' => $period->id,
            'period_start' => $period->start_date->toDateString(),
            'period_end' => $period->end_date->toDateString(),
            'suggestions' => $unique,
            'deferred_hooks' => $deferred,
            'counts' => [
                'total' => count($unique),
                'included' => count(array_filter($unique, fn ($s) => ($s['decision'] ?? null) === 'included')),
                'excluded' => count(array_filter($unique, fn ($s) => ($s['decision'] ?? null) === 'excluded')),
            ],
            'note' => 'Suggestions are not submissions. Include explicitly to add to your report.',
        ];
    }

    private function leaveSuggestions(User $employee, WeeklyReportingPeriod $period): array
    {
        $rows = LeaveRequest::query()
            ->where('requester_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $period->end_date)
            ->whereDate('end_date', '>=', $period->start_date)
            ->get(['id', 'leave_type', 'start_date', 'end_date', 'status']);

        return $rows->map(fn ($leave) => [
            'source_type' => 'leave',
            'source_id' => $leave->id,
            'reference' => 'LEAVE-'.$leave->id,
            'title' => sprintf('Leave (%s) %s to %s', $leave->leave_type, $leave->start_date->toDateString(), $leave->end_date->toDateString()),
            'status' => $leave->status,
            'suggested_section' => 'note',
            'confidentiality' => 'internal',
            'decision' => null,
            'meta' => [
                'full_week' => $leave->start_date->lte($period->start_date) && $leave->end_date->gte($period->end_date),
            ],
        ])->all();
    }

    private function travelSuggestions(User $employee, WeeklyReportingPeriod $period): array
    {
        if (! Schema::hasTable('travel_requests')) {
            return [];
        }

        try {
            $dateColStart = Schema::hasColumn('travel_requests', 'departure_date') ? 'departure_date' : 'start_date';
            $dateColEnd = Schema::hasColumn('travel_requests', 'return_date') ? 'return_date' : 'end_date';
            if (! Schema::hasColumn('travel_requests', $dateColStart)) {
                return [];
            }

            $userCol = Schema::hasColumn('travel_requests', 'user_id') ? 'user_id' : 'requester_id';

            $rows = DB::table('travel_requests')
                ->where($userCol, $employee->id)
                ->whereIn('status', ['approved', 'in_progress', 'completed', 'departed', 'returned', 'authorised'])
                ->where(function ($q) use ($period, $dateColStart, $dateColEnd) {
                    $q->whereBetween($dateColStart, [$period->start_date->toDateString(), $period->end_date->toDateString()]);
                    if (Schema::hasColumn('travel_requests', $dateColEnd)) {
                        $q->orWhereBetween($dateColEnd, [$period->start_date->toDateString(), $period->end_date->toDateString()])
                            ->orWhere(function ($q2) use ($period, $dateColStart, $dateColEnd) {
                                $q2->where($dateColStart, '<=', $period->start_date->toDateString())
                                    ->where($dateColEnd, '>=', $period->end_date->toDateString());
                            });
                    }
                })
                ->limit(50)
                ->get();
        } catch (\Throwable) {
            return [];
        }

        return $rows->map(fn ($t) => [
            'source_type' => 'travel',
            'source_id' => $t->id,
            'reference' => $t->reference_number ?? $t->reference ?? null,
            'title' => 'Travel: '.($t->destination ?? ('#'.$t->id)),
            'status' => $t->status,
            'suggested_section' => 'meeting',
            'confidentiality' => 'internal',
            'decision' => null,
            'meta' => [],
        ])->all();
    }

    private function correspondenceSuggestions(User $employee, WeeklyReportingPeriod $period): array
    {
        if (! Schema::hasTable('correspondence')) {
            return [];
        }

        try {
            $q = DB::table('correspondence')
                ->where('tenant_id', $employee->tenant_id)
                ->whereBetween('updated_at', [
                    $period->start_date->copy()->startOfDay(),
                    $period->end_date->copy()->endOfDay(),
                ]);

            $q->where(function ($q) use ($employee) {
                if (Schema::hasColumn('correspondence', 'created_by')) {
                    $q->orWhere('created_by', $employee->id);
                }
                if (Schema::hasColumn('correspondence', 'primary_owner_id')) {
                    $q->orWhere('primary_owner_id', $employee->id);
                }
                if (Schema::hasColumn('correspondence', 'assigned_to')) {
                    $q->orWhere('assigned_to', $employee->id);
                }
            });

            if (Schema::hasColumn('correspondence', 'classification')) {
                $q->where(function ($q2) {
                    $q2->whereNull('classification')
                        ->orWhereIn('classification', ['general_official', 'internal', 'public', 'unclassified']);
                });
            }

            $cols = ['id', 'status'];
            foreach (['reference', 'subject', 'classification'] as $c) {
                if (Schema::hasColumn('correspondence', $c)) {
                    $cols[] = $c;
                }
            }

            $rows = $q->limit(50)->get($cols);
        } catch (\Throwable) {
            return [];
        }

        return $rows->map(fn ($c) => [
            'source_type' => 'correspondence',
            'source_id' => $c->id,
            'reference' => $c->reference ?? null,
            'title' => $c->subject ?? ('Correspondence #'.$c->id),
            'status' => $c->status,
            'suggested_section' => 'wip',
            'confidentiality' => in_array($c->classification ?? 'internal', ['confidential', 'secret', 'restricted'], true)
                ? 'confidential'
                : 'internal',
            'decision' => null,
            'meta' => [],
        ])->all();
    }

    private function pifSuggestions(User $employee, WeeklyReportingPeriod $period): array
    {
        if (! Schema::hasTable('programmes')) {
            return [];
        }

        try {
            $q = DB::table('programmes')
                ->where('tenant_id', $employee->tenant_id)
                ->whereBetween('updated_at', [
                    $period->start_date->copy()->startOfDay(),
                    $period->end_date->copy()->endOfDay(),
                ]);

            $q->where(function ($q) use ($employee) {
                $q->where('created_by', $employee->id);
                if (Schema::hasColumn('programmes', 'requesting_officer_id')) {
                    $q->orWhere('requesting_officer_id', $employee->id);
                }
                if (Schema::hasColumn('programmes', 'officer_id')) {
                    $q->orWhere('officer_id', $employee->id);
                }
            });

            $cols = ['id', 'status'];
            foreach (['reference', 'reference_number', 'title', 'name'] as $c) {
                if (Schema::hasColumn('programmes', $c)) {
                    $cols[] = $c;
                }
            }

            $rows = $q->limit(30)->get($cols);
        } catch (\Throwable) {
            return [];
        }

        return $rows->map(fn ($p) => [
            'source_type' => 'pif',
            'source_id' => $p->id,
            'reference' => $p->reference ?? $p->reference_number ?? null,
            'title' => $p->title ?? $p->name ?? ('PIF #'.$p->id),
            'status' => $p->status,
            'suggested_section' => 'wip',
            'confidentiality' => 'internal',
            'decision' => null,
            'meta' => [],
        ])->all();
    }

    /**
     * Prefer TimesheetService::weeklySummarySuggestions when present (wired after Timesheets Phase 1).
     */
    private function timesheetSuggestions(User $employee, WeeklyReportingPeriod $period): array
    {
        if (! class_exists(\App\Modules\Timesheets\Services\TimesheetService::class)) {
            return [[
                'source_type' => 'timesheets_hook',
                'source_id' => 0,
                'reference' => null,
                'title' => 'Timesheet suggestions unavailable until Timesheets Phase 1 ships',
                'status' => 'deferred',
                'suggested_section' => 'note',
                'confidentiality' => 'internal',
                'decision' => 'excluded',
                'meta' => ['deferred' => true],
                'is_placeholder' => true,
            ]];
        }

        $service = app(\App\Modules\Timesheets\Services\TimesheetService::class);
        if (! method_exists($service, 'weeklySummarySuggestions')) {
            return [];
        }

        /** @var array $rows */
        $rows = $service->weeklySummarySuggestions($employee, $period);

        return collect($rows)->map(fn ($r) => array_merge([
            'source_type' => 'timesheet',
            'suggested_section' => 'wip',
            'confidentiality' => 'internal',
            'decision' => null,
            'meta' => [],
        ], $r))->all();
    }
}
