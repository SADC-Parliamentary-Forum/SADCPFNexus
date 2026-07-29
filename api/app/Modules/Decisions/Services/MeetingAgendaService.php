<?php

namespace App\Modules\Decisions\Services;

use App\Models\MeetingAgendaItem;
use App\Models\MeetingDecision;
use App\Models\MeetingMinutes;
use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class MeetingAgendaService
{
    public function list(User $user, array $filters = []): Collection
    {
        $q = MeetingAgendaItem::query()
            ->where('tenant_id', $user->tenant_id)
            ->with([
                'presenter:id,name',
                'workplanEvent:id,title,date',
                'minutes:id,title,meeting_date',
                'decision:id,reference_number,title,status',
            ])
            ->orderBy('sequence')
            ->orderBy('id');

        if (! empty($filters['workplan_event_id'])) {
            $q->where('workplan_event_id', $filters['workplan_event_id']);
        }
        if (! empty($filters['meeting_minutes_id'])) {
            $q->where('meeting_minutes_id', $filters['meeting_minutes_id']);
        }
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }

        return $q->get();
    }

    public function create(array $data, User $user): MeetingAgendaItem
    {
        if (! empty($data['workplan_event_id'])) {
            WorkplanEvent::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('id', $data['workplan_event_id'])
                ->firstOrFail();
        }
        if (! empty($data['meeting_minutes_id'])) {
            MeetingMinutes::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('id', $data['meeting_minutes_id'])
                ->firstOrFail();
        }

        return MeetingAgendaItem::create([
            'tenant_id' => $user->tenant_id,
            'workplan_event_id' => $data['workplan_event_id'] ?? null,
            'meeting_minutes_id' => $data['meeting_minutes_id'] ?? null,
            'meeting_decision_id' => $data['meeting_decision_id'] ?? null,
            'sequence' => $data['sequence'] ?? 1,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'open',
            'presenter_id' => $data['presenter_id'] ?? null,
            'created_by' => $user->id,
        ])->load(['presenter:id,name', 'workplanEvent:id,title,date', 'minutes:id,title']);
    }

    public function linkDecision(MeetingAgendaItem $item, MeetingDecision $decision, User $user): MeetingAgendaItem
    {
        abort_unless((int) $item->tenant_id === (int) $user->tenant_id, 404);
        abort_unless((int) $decision->tenant_id === (int) $user->tenant_id, 404);

        $item->update(['meeting_decision_id' => $decision->id]);
        if (empty($decision->agenda_item_id)) {
            $decision->update([
                'agenda_item_id' => $item->id,
                'workplan_event_id' => $decision->workplan_event_id ?: $item->workplan_event_id,
                'meeting_minutes_id' => $decision->meeting_minutes_id ?: $item->meeting_minutes_id,
            ]);
        }

        return $item->fresh(['decision:id,reference_number,title,status']);
    }

    public function listMinutesOptions(User $user): Collection
    {
        return MeetingMinutes::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('meeting_date')
            ->limit(100)
            ->get(['id', 'title', 'meeting_date', 'status']);
    }

    public function listOwnerOptions(User $user): Collection
    {
        return User::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(200)
            ->get(['id', 'name', 'email']);
    }
}
