<?php

namespace App\Modules\Srhr\Services;

use App\Models\HrFileTimelineEvent;
use App\Models\HrPersonalFile;
use App\Models\Parliament;
use App\Models\StaffDeployment;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\WorkplanEvent;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class DeploymentService
{
    public function __construct(
        protected NotificationService $notificationService,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = StaffDeployment::with(['employee', 'parliament', 'createdBy'])
            ->where('tenant_id', $user->tenant_id)
            ->withCount('reports')
            ->orderByDesc('created_at');

        if (!empty($filters['parliament_id'])) {
            $query->where('parliament_id', $filters['parliament_id']);
        }

        if (!empty($filters['employee_id'])) {
            $query->where('employee_id', $filters['employee_id']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['deployment_type'])) {
            $query->where('deployment_type', $filters['deployment_type']);
        }

        if (!empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function ($q) use ($term) {
                $q->where('reference_number', 'ilike', "%{$term}%")
                  ->orWhereHas('employee', fn ($eq) => $eq->where('name', 'ilike', "%{$term}%"))
                  ->orWhereHas('parliament', fn ($pq) => $pq->where('name', 'ilike', "%{$term}%"));
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function get(int $id, User $user): StaffDeployment
    {
        return StaffDeployment::with(['employee', 'parliament', 'createdBy', 'reports' => fn ($q) => $q->orderByDesc('created_at')->limit(5)])
            ->where('tenant_id', $user->tenant_id)
            ->findOrFail($id);
    }

    public function create(array $data, User $actor): StaffDeployment
    {
        // Validate no active deployment for this employee
        $existing = StaffDeployment::where('tenant_id', $actor->tenant_id)
            ->where('employee_id', $data['employee_id'])
            ->where('status', 'active')
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'employee_id' => ["This staff member already has an active deployment ({$existing->reference_number})."],
            ]);
        }

        $deployment = StaffDeployment::create([
            'tenant_id'             => $actor->tenant_id,
            'employee_id'           => $data['employee_id'],
            'parliament_id'         => $data['parliament_id'],
            'reference_number'      => StaffDeployment::generateReference($actor->tenant_id),
            'deployment_type'       => $data['deployment_type'] ?? 'field_researcher',
            'research_area'         => $data['research_area'] ?? null,
            'research_focus'        => $data['research_focus'] ?? null,
            'start_date'            => $data['start_date'],
            'end_date'              => $data['end_date'] ?? null,
            'supervisor_name'       => $data['supervisor_name'] ?? null,
            'supervisor_title'      => $data['supervisor_title'] ?? null,
            'supervisor_email'      => $data['supervisor_email'] ?? null,
            'supervisor_phone'      => $data['supervisor_phone'] ?? null,
            'terms_of_reference'    => $data['terms_of_reference'] ?? null,
            'hr_managed_externally' => true,
            'payroll_active'        => $data['payroll_active'] ?? true,
            'notes'                 => $data['notes'] ?? null,
            'created_by'            => $actor->id,
            'status'                => 'active',
        ]);

        $this->activateOnHrFile($deployment, $actor);
        $this->addWorkplanEvent($deployment, $actor);

        AuditLog::record('srhr.deployment.created', [
            'auditable_type' => StaffDeployment::class,
            'auditable_id'   => $deployment->id,
            'new_values'     => ['reference' => $deployment->reference_number, 'employee_id' => $deployment->employee_id],
            'tags'           => 'srhr',
        ]);

        $deployment->load(['employee', 'parliament']);

        // Notify the deployed researcher
        if ($deployment->employee) {
            $this->notificationService->dispatch($deployment->employee, 'srhr.deployment.started', [
                'name'       => $deployment->employee->name,
                'reference'  => $deployment->reference_number,
                'parliament' => $deployment->parliament?->name ?? '',
                'start_date' => $deployment->start_date,
            ], ['module' => 'srhr', 'record_id' => $deployment->id, 'url' => '/srhr/deployments/' . $deployment->id]);
        }

        // Notify HR Managers
        $hrManagers = User::role(['HR Manager', 'HR Administrator'])
            ->where('tenant_id', $actor->tenant_id)->get();
        $this->notificationService->dispatchToMany($hrManagers, 'srhr.deployment.started', [
            'employee'   => $deployment->employee?->name ?? '',
            'reference'  => $deployment->reference_number,
            'parliament' => $deployment->parliament?->name ?? '',
            'start_date' => $deployment->start_date,
        ], ['module' => 'srhr', 'record_id' => $deployment->id, 'url' => '/srhr/deployments/' . $deployment->id]);

        return $deployment;
    }

    public function update(StaffDeployment $deployment, array $data): StaffDeployment
    {
        $deployment->update(array_filter([
            'research_area'      => $data['research_area'] ?? $deployment->research_area,
            'research_focus'     => $data['research_focus'] ?? $deployment->research_focus,
            'end_date'           => $data['end_date'] ?? $deployment->end_date,
            'supervisor_name'    => $data['supervisor_name'] ?? $deployment->supervisor_name,
            'supervisor_title'   => $data['supervisor_title'] ?? $deployment->supervisor_title,
            'supervisor_email'   => $data['supervisor_email'] ?? $deployment->supervisor_email,
            'supervisor_phone'   => $data['supervisor_phone'] ?? $deployment->supervisor_phone,
            'terms_of_reference' => $data['terms_of_reference'] ?? $deployment->terms_of_reference,
            'payroll_active'     => $data['payroll_active'] ?? $deployment->payroll_active,
            'notes'              => $data['notes'] ?? $deployment->notes,
        ], fn ($v) => $v !== null));

        return $deployment->fresh(['employee', 'parliament']);
    }

    public function recall(StaffDeployment $deployment, string $reason, User $actor): StaffDeployment
    {
        if (!$deployment->isActive()) {
            throw ValidationException::withMessages([
                'status' => ['Only active deployments can be recalled.'],
            ]);
        }

        $deployment->update([
            'status'          => 'recalled',
            'recalled_at'     => now(),
            'recalled_reason' => $reason,
        ]);

        $this->deactivateOnHrFile($deployment, "Recalled: {$reason}", $actor);

        AuditLog::record('srhr.deployment.recalled', [
            'auditable_type' => StaffDeployment::class,
            'auditable_id'   => $deployment->id,
            'new_values'     => ['status' => 'recalled', 'reason' => $reason],
            'tags'           => 'srhr',
        ]);

        $deployment->load('employee');

        // Notify the researcher of the recall
        if ($deployment->employee) {
            $this->notificationService->dispatch($deployment->employee, 'srhr.deployment.recalled', [
                'name'      => $deployment->employee->name,
                'reference' => $deployment->reference_number,
                'reason'    => $reason,
            ], ['module' => 'srhr', 'record_id' => $deployment->id, 'url' => '/srhr/deployments/' . $deployment->id]);
        }

        return $deployment->fresh();
    }

    public function complete(StaffDeployment $deployment, User $actor): StaffDeployment
    {
        if (!$deployment->isActive()) {
            throw ValidationException::withMessages([
                'status' => ['Only active deployments can be marked as completed.'],
            ]);
        }

        $deployment->update(['status' => 'completed']);
        $this->deactivateOnHrFile($deployment, 'Deployment completed', $actor);

        AuditLog::record('srhr.deployment.completed', [
            'auditable_type' => StaffDeployment::class,
            'auditable_id'   => $deployment->id,
            'new_values'     => ['status' => 'completed'],
            'tags'           => 'srhr',
        ]);

        return $deployment->fresh();
    }

    // -------------------------------------------------------------------------

    private function activateOnHrFile(StaffDeployment $deployment, User $actor): void
    {
        $file = HrPersonalFile::where('tenant_id', $deployment->tenant_id)
            ->where('employee_id', $deployment->employee_id)
            ->first();

        if (!$file) {
            return;
        }

        $file->update([
            'hr_managed_externally' => true,
            'active_deployment_id'  => $deployment->id,
        ]);

        $parliament = Parliament::find($deployment->parliament_id);

        HrFileTimelineEvent::create([
            'tenant_id'     => $deployment->tenant_id,
            'hr_file_id'    => $file->id,
            'recorded_by'   => $actor->id,
            'event_type'    => 'deployment_started',
            'title'         => "Deployed to {$parliament?->name}",
            'description'   => "Deployment reference: {$deployment->reference_number}. Supervisor: {$deployment->supervisor_name}",
            'event_date'    => $deployment->start_date,
            'source_module' => 'staff_deployment',
        ]);
    }

    private function deactivateOnHrFile(StaffDeployment $deployment, string $reason, User $actor): void
    {
        $file = HrPersonalFile::where('tenant_id', $deployment->tenant_id)
            ->where('employee_id', $deployment->employee_id)
            ->first();

        if (!$file) {
            return;
        }

        $file->update([
            'hr_managed_externally' => false,
            'active_deployment_id'  => null,
        ]);

        $parliament = Parliament::find($deployment->parliament_id);

        HrFileTimelineEvent::create([
            'tenant_id'     => $deployment->tenant_id,
            'hr_file_id'    => $file->id,
            'recorded_by'   => $actor->id,
            'event_type'    => 'deployment_ended',
            'title'         => "Deployment ended at {$parliament?->name}",
            'description'   => $reason,
            'event_date'    => now()->toDateString(),
            'source_module' => 'staff_deployment',
        ]);
    }

    private function addWorkplanEvent(StaffDeployment $deployment, User $actor): void
    {
        $parliament = Parliament::find($deployment->parliament_id);
        $employee   = User::find($deployment->employee_id);

        WorkplanEvent::create([
            'tenant_id'      => $deployment->tenant_id,
            'title'          => "Field deployment starts: {$employee?->name} → {$parliament?->name}",
            'type'           => 'milestone',
            'date'           => $deployment->start_date,
            'end_date'       => $deployment->end_date,
            'responsible'    => $employee?->name,
            'linked_module'  => 'staff_deployment',
            'linked_id'      => $deployment->id,
            'created_by'     => $actor->id,
        ]);
    }
}
