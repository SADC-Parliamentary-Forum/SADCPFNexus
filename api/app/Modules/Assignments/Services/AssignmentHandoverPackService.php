<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\TimesheetEntry;
use App\Models\User;
use App\Support\NativeDocx;
use Illuminate\Http\Response;

class AssignmentHandoverPackService
{
    public function pack(User $viewer, int $fromUserId, ?int $toUserId = null): array
    {
        $from = User::where('tenant_id', $viewer->tenant_id)->findOrFail($fromUserId);
        $this->assertCanView($viewer, $from);

        $open = Assignment::query()
            ->where('tenant_id', $viewer->tenant_id)
            ->where('assigned_to', $from->id)
            ->where('is_template', false)
            ->whereNotIn('status', ['closed', 'cancelled'])
            ->orderBy('due_date')
            ->get(['id', 'reference_number', 'title', 'status', 'priority', 'due_date', 'estimated_hours', 'blocker_type', 'progress_percent']);

        $logged = TimesheetEntry::query()
            ->whereIn('assignment_id', $open->pluck('id')->all() ?: [0])
            ->selectRaw('assignment_id, coalesce(sum(hours), 0) as logged_hours')
            ->groupBy('assignment_id')
            ->pluck('logged_hours', 'assignment_id');

        return [
            'from_user_id' => $from->id,
            'from_name' => $from->name,
            'to_user_id' => $toUserId,
            'surveillance_ranking' => false,
            'open_assignments' => $open->map(fn (Assignment $a) => [
                'id' => $a->id,
                'reference_number' => $a->reference_number,
                'title' => $a->title,
                'status' => $a->status,
                'priority' => $a->priority,
                'due_date' => optional($a->due_date)?->toDateString(),
                'estimated_hours' => $a->estimated_hours,
                'logged_hours' => (float) ($logged[$a->id] ?? 0),
                'blocker_type' => $a->blocker_type,
                'progress_percent' => $a->progress_percent,
            ])->all(),
            'checklist' => [
                'Confirm open work with the incoming owner',
                'Hand over blockers and evidence locations',
                'Do not invent hours or close work during handover',
            ],
            'summary' => [
                'open_count' => $open->count(),
                'blocked_count' => $open->whereNotNull('blocker_type')->count(),
            ],
        ];
    }

    public function docx(User $viewer, int $fromUserId, ?int $toUserId = null): Response
    {
        $pack = $this->pack($viewer, $fromUserId, $toUserId);
        $paras = [
            'SADC PF Nexus — Assignment handover pack',
            'From: '.($pack['from_name'] ?? '').' · To user id: '.($pack['to_user_id'] ?? 'unassigned'),
            'This pack is not a surveillance ranking and does not close assignments.',
            'Open work: '.($pack['summary']['open_count'] ?? 0).' · Blocked: '.($pack['summary']['blocked_count'] ?? 0),
        ];
        foreach ($pack['open_assignments'] as $row) {
            $paras[] = ($row['reference_number'] ?? '').' — '.($row['title'] ?? '')
                .' · '.$row['status']
                .' · due '.($row['due_date'] ?? '—')
                .' · est '.($row['estimated_hours'] ?? '—')
                .' · logged '.($row['logged_hours'] ?? 0);
        }
        foreach ($pack['checklist'] as $item) {
            $paras[] = 'Checklist: '.$item;
        }

        return NativeDocx::download($paras, 'handover-pack.docx');
    }

    private function assertCanView(User $viewer, User $from): void
    {
        if ((int) $viewer->id === (int) $from->id) {
            return;
        }
        if ($viewer->hasAnyRole(['System Admin', 'Secretary General', 'HR Manager', 'HR Administrator', 'HOD', 'Director'])) {
            return;
        }
        abort_unless((int) $viewer->department_id === (int) $from->department_id, 403);
    }
}
