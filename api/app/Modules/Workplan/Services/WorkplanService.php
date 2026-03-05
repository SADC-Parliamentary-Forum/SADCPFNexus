<?php
namespace App\Modules\Workplan\Services;

use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Database\Eloquent\Collection;

class WorkplanService
{
    public function list(array $filters, User $user): Collection
    {
        $query = WorkplanEvent::with('creator')->orderBy('date');

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (!empty($filters['month']) && !empty($filters['year'])) {
            $query->whereMonth('date', $filters['month'])
                  ->whereYear('date', $filters['year']);
        } elseif (!empty($filters['year'])) {
            $query->whereYear('date', $filters['year']);
        }

        return $query->get();
    }

    public function create(array $data, User $user): WorkplanEvent
    {
        return WorkplanEvent::create([
            'tenant_id'     => $user->tenant_id,
            'created_by'    => $user->id,
            'title'         => $data['title'],
            'type'          => $data['type'] ?? 'meeting',
            'date'          => $data['date'],
            'end_date'      => $data['end_date'] ?? null,
            'description'   => $data['description'] ?? null,
            'responsible'   => $data['responsible'] ?? null,
            'linked_module' => $data['linked_module'] ?? null,
            'linked_id'     => $data['linked_id'] ?? null,
        ]);
    }

    public function update(WorkplanEvent $event, array $data): WorkplanEvent
    {
        $event->update(array_filter([
            'title'         => $data['title'] ?? null,
            'type'          => $data['type'] ?? null,
            'date'          => $data['date'] ?? null,
            'end_date'      => $data['end_date'] ?? null,
            'description'   => $data['description'] ?? null,
            'responsible'   => $data['responsible'] ?? null,
            'linked_module' => $data['linked_module'] ?? null,
            'linked_id'     => $data['linked_id'] ?? null,
        ], fn($v) => $v !== null));

        return $event->fresh('creator');
    }

    public function delete(WorkplanEvent $event): void
    {
        $event->delete();
    }
}
