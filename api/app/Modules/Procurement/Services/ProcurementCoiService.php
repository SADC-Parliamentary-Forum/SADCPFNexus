<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementCoiDeclaration;
use App\Models\ProcurementRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ProcurementCoiService
{
    public function declare(ProcurementRequest $request, User $user, array $data): ProcurementCoiDeclaration
    {
        if ((int) $request->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $context = $data['context'];
        $hasConflict = (bool) ($data['has_conflict'] ?? false);
        $notes = $data['notes'] ?? null;

        if ($hasConflict && blank($notes)) {
            throw ValidationException::withMessages([
                'notes' => 'Notes are required when a conflict of interest is declared.',
            ]);
        }

        $declaration = ProcurementCoiDeclaration::updateOrCreate(
            [
                'procurement_request_id' => $request->id,
                'user_id'                => $user->id,
                'context'                => $context,
            ],
            [
                'tenant_id'    => $user->tenant_id,
                'has_conflict' => $hasConflict,
                'notes'        => $notes,
            ]
        );

        AuditLog::record('procurement.coi_declared', [
            'auditable_type' => ProcurementCoiDeclaration::class,
            'auditable_id'   => $declaration->id,
            'new_values'     => [
                'procurement_request_id' => $request->id,
                'context'                => $context,
                'has_conflict'           => $hasConflict,
            ],
            'tags'           => 'procurement',
        ]);

        return $declaration;
    }

    public function assertDeclared(ProcurementRequest $request, User $user, string $context): void
    {
        $exists = ProcurementCoiDeclaration::query()
            ->where('procurement_request_id', $request->id)
            ->where('user_id', $user->id)
            ->where('context', $context)
            ->exists();

        if (!$exists) {
            throw ValidationException::withMessages([
                'coi' => 'A conflict of interest declaration is required before this action.',
            ]);
        }
    }

    /**
     * Record a COI declaration from inline request fields (assess/award payloads).
     *
     * @param  array<string, mixed>  $data
     */
    public function record(ProcurementRequest $request, User $user, array $data, string $context): ProcurementCoiDeclaration
    {
        if (!($data['coi_declared'] ?? false)) {
            throw ValidationException::withMessages([
                'coi' => 'A conflict of interest declaration is required before this action.',
            ]);
        }

        return $this->declare($request, $user, [
            'context'      => $context,
            'has_conflict' => (bool) ($data['coi_has_conflict'] ?? false),
            'notes'        => $data['coi_notes'] ?? null,
        ]);
    }
}
