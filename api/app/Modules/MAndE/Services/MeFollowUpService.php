<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\MeActivityReport;
use App\Models\MeFollowUpAction;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class MeFollowUpService
{
    public function listForReport(MeActivityReport $report): Collection
    {
        return MeFollowUpAction::query()
            ->where('me_activity_report_id', $report->id)
            ->with(['assignee:id,name', 'creator:id,name'])
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END")
            ->orderBy('due_date')
            ->get();
    }

    public function create(MeActivityReport $report, array $data, User $user): MeFollowUpAction
    {
        $row = MeFollowUpAction::create([
            'tenant_id'              => $report->tenant_id,
            'me_activity_report_id'  => $report->id,
            'action'                 => $data['action'],
            'assigned_to'            => $data['assigned_to'] ?? null,
            'due_date'               => $data['due_date'] ?? null,
            'priority'               => $data['priority'] ?? 'normal',
            'status'                 => $data['status'] ?? 'open',
            'comments'               => $data['comments'] ?? null,
            'created_by'             => $user->id,
        ]);

        AuditLog::record('mande.follow_up.created', [
            'auditable_type' => MeFollowUpAction::class,
            'auditable_id'   => $row->id,
            'new_values'     => ['action' => $row->action, 'report_id' => $report->id],
            'tags'           => 'mande',
        ]);

        return $row->load(['assignee:id,name', 'creator:id,name']);
    }

    public function update(MeFollowUpAction $row, array $data, User $user): MeFollowUpAction
    {
        if ((int) $row->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $status = $data['status'] ?? $row->status;
        $completedAt = $row->completed_at;
        if ($status === 'completed' && ! $completedAt) {
            $completedAt = now();
        }
        if ($status !== 'completed') {
            $completedAt = null;
        }

        $row->update([
            'action'       => $data['action'] ?? $row->action,
            'assigned_to'  => array_key_exists('assigned_to', $data) ? $data['assigned_to'] : $row->assigned_to,
            'due_date'     => array_key_exists('due_date', $data) ? $data['due_date'] : $row->due_date,
            'priority'     => $data['priority'] ?? $row->priority,
            'status'       => $status,
            'comments'     => array_key_exists('comments', $data) ? $data['comments'] : $row->comments,
            'completed_at' => $completedAt,
        ]);

        AuditLog::record('mande.follow_up.updated', [
            'auditable_type' => MeFollowUpAction::class,
            'auditable_id'   => $row->id,
            'tags'           => 'mande',
        ]);

        return $row->fresh(['assignee:id,name', 'creator:id,name']);
    }

    public function delete(MeFollowUpAction $row, User $user): void
    {
        if ((int) $row->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($row->status === 'completed') {
            throw ValidationException::withMessages([
                'status' => 'Completed follow-up actions cannot be deleted.',
            ]);
        }
        $row->delete();
    }
}
