<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\AssignmentDependency;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class AssignmentDependencyService
{
    public function listFor(Assignment $assignment, User $user): array
    {
        $this->assertTenant($assignment, $user);

        $blockedBy = AssignmentDependency::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('assignment_id', $assignment->id)
            ->with('dependsOn:id,reference_number,title,status,due_date')
            ->get();

        $blocks = AssignmentDependency::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('depends_on_assignment_id', $assignment->id)
            ->with('assignment:id,reference_number,title,status,due_date')
            ->get();

        return [
            'blocked_by' => $blockedBy->map(fn (AssignmentDependency $d) => [
                'id' => $d->id,
                'depends_on_assignment_id' => $d->depends_on_assignment_id,
                'dependency_type' => $d->dependency_type,
                'notes' => $d->notes,
                'assignment' => $d->dependsOn,
            ])->values()->all(),
            'blocks' => $blocks->map(fn (AssignmentDependency $d) => [
                'id' => $d->id,
                'assignment_id' => $d->assignment_id,
                'dependency_type' => $d->dependency_type,
                'notes' => $d->notes,
                'assignment' => $d->assignment,
            ])->values()->all(),
        ];
    }

    public function add(Assignment $assignment, int $dependsOnId, User $user, ?string $notes = null): AssignmentDependency
    {
        $this->assertTenant($assignment, $user);

        if ($dependsOnId === (int) $assignment->id) {
            throw ValidationException::withMessages(['depends_on_assignment_id' => 'An assignment cannot depend on itself.']);
        }

        $blocker = Assignment::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereKey($dependsOnId)
            ->firstOrFail();

        if ($this->wouldCreateCycle((int) $assignment->id, (int) $blocker->id, (int) $user->tenant_id)) {
            throw ValidationException::withMessages(['depends_on_assignment_id' => 'Adding this dependency would create a cycle.']);
        }

        return AssignmentDependency::firstOrCreate(
            [
                'assignment_id' => $assignment->id,
                'depends_on_assignment_id' => $blocker->id,
            ],
            [
                'tenant_id' => $user->tenant_id,
                'dependency_type' => 'blocks',
                'notes' => $notes,
                'created_by' => $user->id,
            ]
        );
    }

    public function remove(Assignment $assignment, AssignmentDependency $dependency, User $user): void
    {
        $this->assertTenant($assignment, $user);
        if ((int) $dependency->assignment_id !== (int) $assignment->id
            && (int) $dependency->depends_on_assignment_id !== (int) $assignment->id) {
            abort(404);
        }
        if ((int) $dependency->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        $dependency->delete();
    }

    private function wouldCreateCycle(int $blockedId, int $blockerId, int $tenantId): bool
    {
        // If blocker (transitively) already depends on blocked → cycle
        $stack = [$blockerId];
        $seen = [];
        while ($stack) {
            $current = array_pop($stack);
            if ($current === $blockedId) {
                return true;
            }
            if (isset($seen[$current])) {
                continue;
            }
            $seen[$current] = true;
            $next = AssignmentDependency::query()
                ->where('tenant_id', $tenantId)
                ->where('assignment_id', $current)
                ->pluck('depends_on_assignment_id')
                ->all();
            foreach ($next as $n) {
                $stack[] = (int) $n;
            }
        }

        return false;
    }

    private function assertTenant(Assignment $assignment, User $user): void
    {
        if ((int) $assignment->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
