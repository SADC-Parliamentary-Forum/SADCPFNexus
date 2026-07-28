<?php

namespace App\Modules\Timesheets\Services;

use App\Models\AuditLog;
use App\Models\OvertimeAccrual;
use App\Models\OvertimeActualEntry;
use App\Models\OvertimeRatePolicy;
use App\Models\OvertimeRequisition;
use App\Models\OvertimeRequisitionEmployee;
use App\Models\OvertimeSettlement;
use App\Models\PayrollExportBatch;
use App\Models\PayrollExportLine;
use App\Models\TimesheetAuditEvent;
use App\Models\User;
use App\Modules\Leave\Services\LeaveToilCreditService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OvertimeService
{
    public const TOIL_EXPIRY_DAYS = 30;

    public function __construct(
        protected NotificationService $notificationService,
        protected LeaveToilCreditService $leaveToilCreditService,
    ) {}

    /**
     * Seed only the approved normal-working-day 1.5 rate. Do NOT invent weekend/PH rates.
     */
    public function ensureDefaultRatePolicy(int $tenantId): OvertimeRatePolicy
    {
        return OvertimeRatePolicy::firstOrCreate(
            [
                'tenant_id' => $tenantId,
                'day_type' => OvertimeRatePolicy::NORMAL_WORKING_DAY,
                'effective_from' => null,
            ],
            [
                'multiplier' => 1.5,
                'is_active' => true,
                'policy_reference' => 'Administrative Rules — normal working day overtime',
            ]
        );
    }

    /**
     * Resolve multiplier for a day type. Returns null when not configured (must not invent).
     */
    public function resolveMultiplier(int $tenantId, string $dayType, ?Carbon $onDate = null): ?float
    {
        $this->ensureDefaultRatePolicy($tenantId);

        $query = OvertimeRatePolicy::where('tenant_id', $tenantId)
            ->where('day_type', $dayType)
            ->where('is_active', true)
            ->whereNotNull('multiplier');

        if ($onDate) {
            $d = $onDate->toDateString();
            $query->where(function ($q) use ($d) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $d);
            })->where(function ($q) use ($d) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', $d);
            });
        }

        $policy = $query->orderByDesc('effective_from')->first();

        return $policy?->multiplier !== null ? (float) $policy->multiplier : null;
    }

    public function createRequisition(User $actor, array $data): OvertimeRequisition
    {
        if (! empty($data['is_emergency']) && empty($data['emergency_justification'])) {
            throw ValidationException::withMessages([
                'emergency_justification' => 'Emergency overtime requires a justification.',
            ]);
        }

        $dayType = $data['day_type'] ?? OvertimeRatePolicy::NORMAL_WORKING_DAY;

        $req = OvertimeRequisition::create([
            'tenant_id' => $actor->tenant_id,
            'reference' => 'OTR-'.strtoupper(Str::random(8)),
            'requested_by' => $actor->id,
            'department_id' => $data['department_id'] ?? null,
            'work_date' => $data['work_date'],
            'planned_start' => $data['planned_start'] ?? null,
            'planned_end' => $data['planned_end'] ?? null,
            'planned_hours' => $data['planned_hours'],
            'day_type' => $dayType,
            'reason' => $data['reason'],
            'work_location' => $data['work_location'] ?? null,
            'assignment_id' => $data['assignment_id'] ?? null,
            'pif_id' => $data['pif_id'] ?? null,
            'is_emergency' => (bool) ($data['is_emergency'] ?? false),
            'emergency_justification' => $data['emergency_justification'] ?? null,
            'status' => OvertimeRequisition::DRAFT,
        ]);

        $employeeIds = $data['employee_ids'] ?? [$actor->id];
        foreach ($employeeIds as $uid) {
            OvertimeRequisitionEmployee::create([
                'overtime_requisition_id' => $req->id,
                'user_id' => $uid,
                'planned_hours' => $data['planned_hours'],
            ]);
        }

        $this->auditOt($actor, 'overtime.requisition.created', $req->id);

        return $req->fresh(['employees', 'requester']);
    }

    public function submitRequisition(OvertimeRequisition $req, User $actor): OvertimeRequisition
    {
        if ($req->status !== OvertimeRequisition::DRAFT) {
            throw ValidationException::withMessages(['status' => 'Only draft requisitions can be submitted.']);
        }
        if ((int) $req->requested_by !== (int) $actor->id) {
            throw ValidationException::withMessages(['user' => 'Only the requester can submit this requisition.']);
        }

        $req->update(['status' => OvertimeRequisition::SUBMITTED]);
        $this->auditOt($actor, 'overtime.requisition.submitted', $req->id);

        return $req->fresh();
    }

    public function recommend(OvertimeRequisition $req, User $actor): OvertimeRequisition
    {
        if ($req->status !== OvertimeRequisition::SUBMITTED) {
            throw ValidationException::withMessages(['status' => 'Only submitted requisitions can be recommended.']);
        }
        $this->assertNotSelf($req, $actor, 'recommend');

        $req->update([
            'status' => OvertimeRequisition::RECOMMENDED,
            'recommended_by' => $actor->id,
            'recommended_at' => now(),
        ]);
        $this->auditOt($actor, 'overtime.requisition.recommended', $req->id);

        return $req->fresh();
    }

    public function approveRequisition(OvertimeRequisition $req, User $actor): OvertimeRequisition
    {
        if (! in_array($req->status, [OvertimeRequisition::SUBMITTED, OvertimeRequisition::RECOMMENDED], true)) {
            throw ValidationException::withMessages(['status' => 'Requisition is not awaiting approval.']);
        }
        $this->assertNotSelf($req, $actor, 'approve');

        // Advance authorisation gate — approved before work (except emergency already flagged)
        $req->update([
            'status' => OvertimeRequisition::APPROVED,
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);
        $this->auditOt($actor, 'overtime.requisition.approved', $req->id);

        $req->loadMissing('requester');
        if ($req->requester) {
            $this->notificationService->dispatch($req->requester, 'overtime.approved', [
                'reference' => $req->reference,
                'work_date' => $req->work_date->format('d M Y'),
            ], ['module' => 'overtime', 'record_id' => $req->id, 'url' => '/hr/timesheets/overtime/'.$req->id]);
        }

        return $req->fresh();
    }

    public function rejectRequisition(OvertimeRequisition $req, User $actor, string $reason): OvertimeRequisition
    {
        $this->assertNotSelf($req, $actor, 'reject');
        $req->update([
            'status' => OvertimeRequisition::REJECTED,
            'rejected_by' => $actor->id,
            'rejected_at' => now(),
            'rejection_reason' => $reason,
        ]);
        $this->auditOt($actor, 'overtime.requisition.rejected', $req->id, null, ['reason' => $reason]);

        return $req->fresh();
    }

    /**
     * Record actual overtime — separate from planned. Requires approved requisition
     * (or emergency requisition).
     */
    public function recordActual(OvertimeRequisition $req, User $actor, array $data): OvertimeActualEntry
    {
        if (! $req->isApproved() && ! $req->is_emergency) {
            throw ValidationException::withMessages([
                'overtime_requisition_id' => 'Overtime must be authorised before it is performed, except through a controlled emergency exception.',
            ]);
        }

        if ($req->is_emergency && $req->status === OvertimeRequisition::DRAFT) {
            // Emergency may be recorded then routed for post-approval — still require submit path later
            throw ValidationException::withMessages([
                'status' => 'Emergency requisition must at least be submitted before recording actuals.',
            ]);
        }

        $userId = (int) ($data['user_id'] ?? $actor->id);
        $dayType = $data['day_type'] ?? $req->day_type;
        $multiplier = $this->resolveMultiplier((int) $req->tenant_id, $dayType, Carbon::parse($data['work_date'] ?? $req->work_date));

        if ($dayType !== OvertimeRatePolicy::NORMAL_WORKING_DAY && $multiplier === null) {
            throw ValidationException::withMessages([
                'day_type' => 'No approved overtime rate is configured for this day type. Do not invent weekend or public-holiday rates.',
            ]);
        }

        if ($dayType === OvertimeRatePolicy::NORMAL_WORKING_DAY && $multiplier === null) {
            $multiplier = 1.5; // seeded default from current rules
        }

        $actualHours = (float) $data['actual_hours'];
        $payable = round($actualHours * (float) $multiplier, 2);

        $actual = OvertimeActualEntry::create([
            'tenant_id' => $req->tenant_id,
            'overtime_requisition_id' => $req->id,
            'user_id' => $userId,
            'timesheet_id' => $data['timesheet_id'] ?? null,
            'work_date' => $data['work_date'] ?? $req->work_date,
            'actual_start' => $data['actual_start'] ?? null,
            'actual_end' => $data['actual_end'] ?? null,
            'actual_hours' => $actualHours,
            'planned_hours' => (float) $req->planned_hours,
            'day_type' => $dayType,
            'multiplier' => $multiplier,
            'payable_hours' => $payable,
            'status' => OvertimeActualEntry::SUBMITTED,
            'notes' => $data['notes'] ?? null,
        ]);

        $this->auditOt($actor, 'overtime.actual.recorded', $req->id, $actual->id, [
            'planned_hours' => (float) $req->planned_hours,
            'actual_hours' => $actualHours,
        ]);

        return $actual->fresh();
    }

    public function hrValidate(OvertimeActualEntry $actual, User $actor): OvertimeActualEntry
    {
        if ($actual->status !== OvertimeActualEntry::SUBMITTED && $actual->status !== OvertimeActualEntry::VERIFIED) {
            throw ValidationException::withMessages(['status' => 'Actual overtime is not awaiting HR validation.']);
        }
        if ((int) $actual->user_id === (int) $actor->id) {
            throw ValidationException::withMessages(['approval' => 'You cannot HR-validate your own overtime.']);
        }

        $actual->update([
            'status' => OvertimeActualEntry::HR_VALIDATED,
            'hr_validated_by' => $actor->id,
            'hr_validated_at' => now(),
        ]);
        $this->auditOt($actor, 'overtime.actual.hr_validated', $actual->overtime_requisition_id, $actual->id);

        return $actual->fresh();
    }

    /**
     * Settle as PAY or TOIL — mutually exclusive; idempotent on key.
     */
    public function settle(OvertimeActualEntry $actual, User $actor, string $type, ?string $idempotencyKey = null): OvertimeSettlement
    {
        if ($actual->status !== OvertimeActualEntry::HR_VALIDATED && $actual->status !== OvertimeActualEntry::SETTLED) {
            throw ValidationException::withMessages([
                'status' => 'HR must validate entitlement before Finance/TOIL settlement.',
            ]);
        }

        if (! in_array($type, [OvertimeSettlement::TYPE_PAY, OvertimeSettlement::TYPE_TOIL], true)) {
            throw ValidationException::withMessages(['settlement_type' => 'Settlement must be pay or toil.']);
        }

        $key = $idempotencyKey ?: ('ot-settle-'.$actual->id.'-'.$type);

        return DB::transaction(function () use ($actual, $actor, $type, $key) {
            $existing = OvertimeSettlement::where('overtime_actual_id', $actual->id)->first();
            if ($existing) {
                if ($existing->settlement_type !== $type) {
                    throw ValidationException::withMessages([
                        'settlement_type' => 'The same overtime cannot result in both pay and TOIL.',
                    ]);
                }
                // Idempotent re-send
                return $existing;
            }

            $byKey = OvertimeSettlement::where('idempotency_key', $key)->first();
            if ($byKey) {
                return $byKey;
            }

            $settlement = OvertimeSettlement::create([
                'tenant_id' => $actual->tenant_id,
                'overtime_actual_id' => $actual->id,
                'user_id' => $actual->user_id,
                'settlement_type' => $type,
                'hours' => $actual->actual_hours,
                'multiplier' => $actual->multiplier,
                'payable_hours' => $type === OvertimeSettlement::TYPE_PAY ? $actual->payable_hours : null,
                'status' => OvertimeSettlement::PENDING,
                'idempotency_key' => $key,
                'settled_by' => $actor->id,
                'settled_at' => now(),
            ]);

            if ($type === OvertimeSettlement::TYPE_TOIL) {
                $accrual = $this->transferToil($actual, $actor, $settlement);
                $settlement->update([
                    'overtime_accrual_id' => $accrual->id,
                    'status' => OvertimeSettlement::SENT,
                ]);
            }

            $actual->update(['status' => OvertimeActualEntry::SETTLED]);
            $this->auditOt($actor, 'overtime.settled.'.$type, $actual->overtime_requisition_id, $actual->id, [
                'settlement_id' => $settlement->id,
            ]);

            return $settlement->fresh();
        });
    }

    /**
     * TOIL transfer: OvertimeAccrual + Leave Phase 1 ToilCredit (idempotent, no double credit).
     * Accrual key = OT-TOIL-{actual_id}; ToilCredit key = source OvertimeAccrual id.
     */
    public function transferToil(OvertimeActualEntry $actual, User $actor, OvertimeSettlement $settlement): OvertimeAccrual
    {
        $code = 'OT-TOIL-'.$actual->id;

        $accrual = OvertimeAccrual::firstOrCreate(
            ['user_id' => $actual->user_id, 'code' => $code],
            [
                'description' => 'Timesheet OT TOIL settlement #'.$settlement->id.' (use within '.self::TOIL_EXPIRY_DAYS.' days via Leave)',
                'hours' => $actual->actual_hours,
                'accrual_date' => $actual->work_date,
                'expires_at' => Carbon::parse($actual->work_date)->addDays(self::TOIL_EXPIRY_DAYS),
                'approved_by_name' => $actor->name,
                'is_verified' => true,
                'is_linked' => false,
            ]
        );

        $this->leaveToilCreditService->ensureCreditFromOvertimeAccrual($accrual->fresh(['user']), $actor);

        return $accrual->fresh();
    }

    /**
     * Export HR-validated PAY settlements to a payroll batch — idempotent.
     */
    public function exportPayroll(User $actor, array $settlementIds, ?string $idempotencyKey = null): PayrollExportBatch
    {
        $key = $idempotencyKey ?: ('payroll-'.md5(implode(',', $settlementIds).'|'.$actor->tenant_id));

        $existing = PayrollExportBatch::where('idempotency_key', $key)->first();
        if ($existing) {
            return $existing->load('lines');
        }

        return DB::transaction(function () use ($actor, $settlementIds, $key) {
            $batch = PayrollExportBatch::create([
                'tenant_id' => $actor->tenant_id,
                'batch_reference' => 'PAY-OT-'.strtoupper(Str::random(6)),
                'status' => PayrollExportBatch::EXPORTED,
                'exported_by' => $actor->id,
                'exported_at' => now(),
                'idempotency_key' => $key,
            ]);

            $settlements = OvertimeSettlement::with('actual')
                ->whereIn('id', $settlementIds)
                ->where('tenant_id', $actor->tenant_id)
                ->where('settlement_type', OvertimeSettlement::TYPE_PAY)
                ->get();

            foreach ($settlements as $settlement) {
                if ($settlement->status === OvertimeSettlement::CANCELLED) {
                    continue;
                }
                $line = PayrollExportLine::firstOrCreate(
                    [
                        'batch_id' => $batch->id,
                        'overtime_settlement_id' => $settlement->id,
                    ],
                    [
                        'user_id' => $settlement->user_id,
                        'hours' => $settlement->hours,
                        'payable_hours' => $settlement->payable_hours,
                        'day_type' => $settlement->actual?->day_type,
                    ]
                );
                $settlement->update([
                    'status' => OvertimeSettlement::SENT,
                    'payroll_export_line_id' => $line->id,
                ]);
            }

            TimesheetAuditEvent::create([
                'tenant_id' => $actor->tenant_id,
                'actor_id' => $actor->id,
                'event_type' => 'overtime.payroll.exported',
                'new_values' => ['batch_id' => $batch->id, 'settlement_ids' => $settlementIds],
            ]);

            return $batch->load('lines');
        });
    }

    private function assertNotSelf(OvertimeRequisition $req, User $actor, string $action): void
    {
        if ((int) $req->requested_by === (int) $actor->id) {
            throw ValidationException::withMessages([
                'approval' => "You cannot {$action} your own overtime requisition.",
            ]);
        }
        // Also block if actor is the only employee on the requisition
        $isSubject = OvertimeRequisitionEmployee::where('overtime_requisition_id', $req->id)
            ->where('user_id', $actor->id)
            ->exists();
        if ($isSubject && OvertimeRequisitionEmployee::where('overtime_requisition_id', $req->id)->count() === 1) {
            throw ValidationException::withMessages([
                'approval' => "You cannot {$action} overtime for which you are the sole subject.",
            ]);
        }
    }

    private function auditOt(?User $actor, string $event, ?int $reqId = null, ?int $actualId = null, ?array $new = null): void
    {
        if ($actor) {
            TimesheetAuditEvent::create([
                'tenant_id' => $actor->tenant_id,
                'overtime_requisition_id' => $reqId,
                'overtime_actual_id' => $actualId,
                'actor_id' => $actor->id,
                'event_type' => $event,
                'new_values' => $new,
            ]);
        }

        AuditLog::record($event, [
            'auditable_type' => OvertimeRequisition::class,
            'auditable_id' => $reqId,
            'tags' => 'overtime',
        ]);
    }
}
