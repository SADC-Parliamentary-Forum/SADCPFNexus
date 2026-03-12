<?php
namespace App\Modules\Workplan\Services;

use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Database\Eloquent\Collection;

class WorkplanService
{
    public function list(array $filters, User $user): Collection
    {
        $query = WorkplanEvent::where('tenant_id', $user->tenant_id)
            ->with(['creator', 'meetingType', 'responsibleUsers:id,name,email', 'attachments:id,attachable_type,attachable_id,original_filename,mime_type,size_bytes,created_at'])
            ->orderBy('date');

        if (! empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (! empty($filters['month']) && ! empty($filters['year'])) {
            $query->whereMonth('date', $filters['month'])
                ->whereYear('date', $filters['year']);
        } elseif (! empty($filters['year'])) {
            $query->whereYear('date', $filters['year']);
        }

        return $query->get();
    }

    public function create(array $data, User $user): WorkplanEvent
    {
        $event = WorkplanEvent::create([
            'tenant_id'       => $user->tenant_id,
            'created_by'      => $user->id,
            'title'           => $data['title'],
            'type'            => $data['type'] ?? 'meeting',
            'meeting_type_id' => $data['meeting_type_id'] ?? null,
            'date'            => $data['date'],
            'end_date'        => $data['end_date'] ?? null,
            'description'     => $data['description'] ?? null,
            'responsible'     => $data['responsible'] ?? null,
            'linked_module'   => $data['linked_module'] ?? null,
            'linked_id'       => $data['linked_id'] ?? null,
        ]);

        $responsibleIds = $data['responsible_user_ids'] ?? [];
        if (is_array($responsibleIds) && ! empty($responsibleIds)) {
            $event->responsibleUsers()->sync(
                array_values(array_map('intval', $responsibleIds))
            );
        }

        return $event->fresh(['creator', 'meetingType', 'responsibleUsers:id,name,email', 'attachments']);
    }

    public function update(WorkplanEvent $event, array $data): WorkplanEvent
    {
        $payload = array_filter([
            'title'         => $data['title'] ?? null,
            'type'          => $data['type'] ?? null,
            'date'          => $data['date'] ?? null,
            'end_date'      => $data['end_date'] ?? null,
            'description'   => $data['description'] ?? null,
            'responsible'   => $data['responsible'] ?? null,
            'linked_module' => $data['linked_module'] ?? null,
            'linked_id'     => $data['linked_id'] ?? null,
        ], fn ($v) => $v !== null);
        if (array_key_exists('meeting_type_id', $data)) {
            $payload['meeting_type_id'] = $data['meeting_type_id'];
        }
        $event->update($payload);

        if (array_key_exists('responsible_user_ids', $data)) {
            $event->responsibleUsers()->sync(
                is_array($data['responsible_user_ids'])
                    ? array_values(array_map('intval', $data['responsible_user_ids']))
                    : []
            );
        }

        return $event->fresh(['creator', 'meetingType', 'responsibleUsers:id,name,email', 'attachments']);
    }

    public function delete(WorkplanEvent $event): void
    {
        $event->delete();
    }
}
