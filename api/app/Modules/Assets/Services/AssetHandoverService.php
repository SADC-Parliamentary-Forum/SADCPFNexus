<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetConditionAssessment;
use App\Models\AssetHandover;
use App\Models\AssetHandoverDeclarationVersion;
use App\Models\AssetHandoverLine;
use App\Models\AssetTransfer;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use App\Services\NotificationService;
use App\Services\SaamService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class AssetHandoverService
{
    public function __construct(
        private readonly AssetService $assets,
        private readonly AssetTimelineService $timeline,
        private readonly AssetAcquisitionBatchService $batches,
        private readonly SaamService $saam,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $actor, array $data): AssetHandover
    {
        $this->assertManage($actor);
        $type = $data['type'] ?? 'issue';
        $target = $data['custody_target_type'] ?? 'person';
        if (! in_array($type, AssetHandover::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Invalid handover type.']);
        }
        if (! in_array($target, AssetHandover::TARGETS, true)) {
            throw ValidationException::withMessages(['custody_target_type' => 'Invalid custody target.']);
        }
        if ($target === 'person') {
            $this->assertPersonTarget($actor, isset($data['to_user_id']) ? (int) $data['to_user_id'] : null);
        }

        $handover = AssetHandover::create([
            'tenant_id' => $actor->tenant_id,
            'reference' => $this->batches->nextReference((int) $actor->tenant_id, 'HO'),
            'type' => $type,
            'custody_target_type' => $target,
            'status' => 'draft',
            'from_user_id' => $data['from_user_id'] ?? $actor->id,
            'from_department_id' => $data['from_department_id'] ?? null,
            'from_location_id' => $data['from_location_id'] ?? null,
            'to_user_id' => $data['to_user_id'] ?? null,
            'to_department_id' => $data['to_department_id'] ?? null,
            'to_location_id' => $data['to_location_id'] ?? ($target === 'location' ? ($data['to_location_id'] ?? null) : null),
            'to_asset_id' => $data['to_asset_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'expires_at' => $data['expires_at'] ?? now()->addDays(14),
            'issued_at' => now(),
            'created_by' => $actor->id,
        ]);

        foreach ((array) ($data['asset_ids'] ?? []) as $assetId) {
            $this->addLine($handover, $actor, (int) $assetId, $data['line'] ?? []);
        }

        return $this->fresh($handover);
    }

    public function addLine(AssetHandover $handover, User $actor, int $assetId, array $data = []): AssetHandoverLine
    {
        $this->assertManage($actor);
        $this->assertTenant($handover, $actor);
        if (! in_array($handover->status, ['draft', 'prepared'], true)) {
            throw ValidationException::withMessages(['status' => 'Lines can only be added to a draft handover.']);
        }

        $asset = Asset::query()->where('tenant_id', $actor->tenant_id)->findOrFail($assetId);
        if ($asset->reserved_handover_id && (int) $asset->reserved_handover_id !== (int) $handover->id) {
            throw ValidationException::withMessages(['asset_id' => 'Asset is reserved for another handover.']);
        }
        if ($handover->type === 'issue' && $asset->assigned_to) {
            throw ValidationException::withMessages(['asset_id' => 'Asset is already in personal custody. Use a transfer.']);
        }
        if (in_array($asset->status, array_merge(Asset::DISPOSED_STATUSES, ['pending', 'retired', 'pending_disposal']), true)) {
            throw ValidationException::withMessages(['asset_id' => 'Asset cannot be handed over in its current status.']);
        }

        $line = AssetHandoverLine::create([
            'tenant_id' => $actor->tenant_id,
            'handover_id' => $handover->id,
            'asset_id' => $asset->id,
            'snapshot_tag' => $asset->tag_number ?: $asset->asset_code,
            'snapshot_name' => $asset->name,
            'snapshot_serial' => $asset->serial_number,
            'condition_out' => $data['condition_out'] ?? $asset->condition,
            'accessories' => $data['accessories'] ?? null,
            'photo_attachment_ids' => $data['photo_attachment_ids'] ?? null,
            'notes' => $data['notes'] ?? null,
            'line_status' => 'pending',
        ]);

        if ($handover->status === 'draft') {
            $handover->status = 'prepared';
            $handover->save();
        }

        return $line;
    }

    public function send(AssetHandover $handover, User $actor): AssetHandover
    {
        $this->assertManage($actor);
        $this->assertTenant($handover, $actor);
        $handover->load('lines.asset');
        if ($handover->lines->isEmpty()) {
            throw ValidationException::withMessages(['lines' => 'Add at least one asset before sending.']);
        }
        if (! in_array($handover->status, ['draft', 'prepared'], true)) {
            throw ValidationException::withMessages(['status' => 'This handover cannot be sent.']);
        }
        if ($handover->custody_target_type === 'person') {
            $this->assertPersonTarget($actor, $handover->to_user_id ? (int) $handover->to_user_id : null);
        }

        return DB::transaction(function () use ($handover, $actor) {
            foreach ($handover->lines as $line) {
                $asset = $line->asset;
                if ($asset->reserved_handover_id && (int) $asset->reserved_handover_id !== (int) $handover->id) {
                    throw ValidationException::withMessages(['asset_id' => 'Asset '.$line->snapshot_tag.' is reserved for another handover.']);
                }
                $asset->reserved_handover_id = $handover->id;
                $asset->save();
                $this->timeline->record($asset, 'HANDOVER_SENT', 'Handover '.$handover->reference.' sent', $actor, [
                    'handover_id' => $handover->id,
                    'reference' => $handover->reference,
                    'type' => $handover->type,
                ]);
            }

            $handover->sent_at = now();
            if ($handover->type === 'return') {
                $handover->status = 'return_initiated';
            } elseif ($handover->requiresPersonSignature()) {
                $handover->status = 'awaiting_acceptance';
            } else {
                $this->completeNonPerson($handover, $actor);

                return $this->fresh($handover);
            }
            $handover->save();

            if ($handover->toUser) {
                $this->notifyRecipient($handover, $handover->toUser, 'assets.handover.awaiting_acceptance');
            } elseif ($handover->type === 'return') {
                $this->notifyManagers($handover, 'assets.handover.awaiting_acceptance');
            }

            AuditLog::record('assets.handover_sent', [
                'auditable_type' => AssetHandover::class,
                'auditable_id' => $handover->id,
                'new_values' => ['status' => $handover->status, 'reference' => $handover->reference],
                'tags' => 'assets',
            ]);

            return $this->fresh($handover);
        });
    }

    public function cancel(AssetHandover $handover, User $actor): AssetHandover
    {
        $this->assertManage($actor);
        $this->assertTenant($handover, $actor);
        if ($handover->signature_event_id || $handover->accepted_at || in_array($handover->status, ['accepted', 'returned', 'return_verified', 'cancelled', 'partially_accepted', 'disputed'], true)) {
            throw ValidationException::withMessages(['status' => 'This handover cannot be cancelled.']);
        }

        return DB::transaction(function () use ($handover) {
            foreach ($handover->lines as $line) {
                $this->unreserve($line->asset, $handover->id);
            }
            $handover->status = 'cancelled';
            $handover->save();
            AuditLog::record('assets.handover_cancelled', [
                'auditable_type' => AssetHandover::class,
                'auditable_id' => $handover->id,
                'tags' => 'assets',
            ]);

            return $this->fresh($handover);
        });
    }

    public function respond(AssetHandover $handover, AssetHandoverLine $line, User $actor, array $data): AssetHandoverLine
    {
        $this->assertTenant($handover, $actor);
        if ((int) $line->handover_id !== (int) $handover->id) {
            abort(404);
        }
        $this->assertCanRespond($handover, $actor);
        $this->assertUnsignedOpen($handover, 'This handover is not awaiting a response.');

        $response = (string) ($data['response'] ?? '');
        if (! in_array($response, AssetHandoverLine::RESPONSES, true)) {
            throw ValidationException::withMessages(['response' => 'Invalid line response.']);
        }

        $snapshot = $line->condition_out;
        $line->recipient_response = $response;
        $line->line_status = $response === 'received' ? 'received' : $response;
        $line->dispute_notes = $data['dispute_notes'] ?? $line->dispute_notes;
        $line->condition_in = $data['condition_in'] ?? $line->condition_in;
        $line->responded_at = now();
        $line->responded_by = $actor->id;
        $line->save();

        if ($line->condition_out !== $snapshot) {
            $line->condition_out = $snapshot;
            $line->save();
        }

        if (in_array($response, AssetHandoverLine::EXCEPTION_RESPONSES, true)) {
            $this->recordDisputeAssessment($line, $actor, $data);
            $this->timeline->record($line->asset, 'HANDOVER_LINE_DISPUTED', 'Handover line disputed', $actor, [
                'handover_id' => $handover->id,
                'response' => $response,
                'condition_out' => $snapshot,
            ]);
        } else {
            $this->timeline->record($line->asset, 'HANDOVER_LINE_RECEIVED', 'Handover line received', $actor, [
                'handover_id' => $handover->id,
            ]);
        }

        return $line->fresh() ?? $line;
    }

    public function sign(AssetHandover $handover, User $actor, array $data = []): AssetHandover
    {
        $this->assertTenant($handover, $actor);
        $this->assertCanRespond($handover, $actor);
        $this->assertUnsignedOpen($handover, 'This handover cannot be signed.');

        $declaration = AssetHandoverDeclarationVersion::currentForTenant((int) $actor->tenant_id);
        $handover->load('lines.asset');

        return DB::transaction(function () use ($handover, $actor, $data, $declaration) {
            $event = $this->saam->recordSignatureEvent([
                'tenant_id' => $actor->tenant_id,
                'signable_type' => AssetHandover::class,
                'signable_id' => $handover->id,
                'step_key' => 'asset_handover.accept',
                'signer_user_id' => $actor->id,
                'action' => 'signed',
                'comment' => $data['comment'] ?? null,
                'auth_level' => $data['auth_level'] ?? 'password',
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'document_hash' => hash('sha256', $declaration->statement.'|'.$handover->id.'|'.now()->toIso8601String()),
                'is_delegated' => false,
                'signed_at' => now(),
            ]);

            $accepted = 0;
            $disputed = 0;
            foreach ($handover->lines as $line) {
                $response = $line->recipient_response;
                if ($response === 'received' || ($response === null && $handover->type === 'return' && AssetAccess::canManageHandover($actor))) {
                    $this->openCustodyForLine($handover, $line, $actor);
                    $line->line_status = 'accepted';
                    $line->save();
                    $accepted++;
                } elseif (in_array((string) $response, AssetHandoverLine::EXCEPTION_RESPONSES, true)) {
                    $this->returnExceptionLineToStore($handover, $line, $actor);
                    $line->line_status = $response;
                    $line->save();
                    $disputed++;
                } else {
                    $this->unreserve($line->asset, $handover->id);
                }
            }

            $handover->signature_event_id = $event->id;
            $handover->declaration_version = $declaration->version_key;
            $handover->accepted_at = now();
            if ($handover->type === 'return') {
                $handover->status = $disputed > 0 && $accepted > 0 ? 'partially_accepted' : ($accepted > 0 ? 'return_verified' : 'disputed');
            } elseif ($accepted > 0 && $disputed > 0) {
                $handover->status = 'partially_accepted';
            } elseif ($accepted > 0) {
                $handover->status = 'accepted';
            } else {
                $handover->status = 'disputed';
            }
            $handover->save();
            $this->storeCertificate($handover, $actor, $declaration);

            foreach ($handover->lines as $line) {
                $this->timeline->record($line->asset, 'HANDOVER_SIGNED', 'Handover '.$handover->reference.' signed', $actor, [
                    'handover_id' => $handover->id,
                    'status' => $handover->status,
                    'declaration_version' => $declaration->version_key,
                ]);
            }

            if ($disputed > 0) {
                $this->notifyManagers($handover, 'assets.handover.disputed');
            }

            AuditLog::record('assets.handover_signed', [
                'auditable_type' => AssetHandover::class,
                'auditable_id' => $handover->id,
                'new_values' => ['status' => $handover->status, 'accepted' => $accepted, 'disputed' => $disputed],
                'tags' => 'assets',
            ]);

            return $this->fresh($handover);
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function custodyHistory(Asset $asset): array
    {
        $rows = AssetAssignmentHistory::query()
            ->where('asset_id', $asset->id)
            ->with(['assignee:id,name', 'custodianLocation:id,name,code', 'handover:id,reference,certificate_path'])
            ->orderByDesc('assigned_at')
            ->get();

        return $rows->map(function (AssetAssignmentHistory $row) {
            $start = $row->assigned_at;
            $end = $row->ended_at ?? $row->returned_at;
            $seconds = $start && $end ? $start->diffInSeconds($end) : ($start ? $start->diffInSeconds(now()) : null);
            $handover = $row->handover;
            $custodianName = $row->assignee?->name
                ?: $row->custodianLocation?->name
                ?: $row->department
                ?: ($row->custodian_type === 'location' ? 'Main Store' : null);

            return [
                'id' => $row->id,
                'custodian_type' => $row->custodian_type ?? ($row->assigned_to ? 'person' : null),
                'custodian_user_id' => $row->assigned_to,
                'custodian_name' => $custodianName,
                'department' => $row->department,
                'handover_id' => $row->handover_id,
                'handover_reference' => $handover?->reference,
                'certificate_available' => (bool) $handover?->certificate_path,
                'assigned_at' => optional($start)?->toIso8601String(),
                'ended_at' => optional($end)?->toIso8601String(),
                'duration_seconds' => $seconds,
                'open' => $end === null,
            ];
        })->all();
    }

    public function certificateResponse(AssetHandover $handover, User $actor): Response
    {
        $this->assertTenant($handover, $actor);
        if (! AssetAccess::canManageHandover($actor) && (int) $handover->to_user_id !== (int) $actor->id && (int) $handover->from_user_id !== (int) $actor->id) {
            abort(403);
        }
        if (! $handover->certificate_path || ! Storage::disk('local')->exists($handover->certificate_path)) {
            $declaration = AssetHandoverDeclarationVersion::currentForTenant((int) $actor->tenant_id);
            $this->storeCertificate($handover, $actor, $declaration);
        }
        $path = Storage::disk('local')->path($handover->certificate_path);

        return response()->file($path, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$handover->reference.'-certificate.pdf"',
        ]);
    }

    public function present(AssetHandover $handover, ?User $viewer = null): array
    {
        $handover->load(['lines.asset', 'toUser:id,name,email', 'fromUser:id,name,email', 'toLocation', 'createdBy:id,name']);
        $declaration = AssetHandoverDeclarationVersion::currentForTenant((int) $handover->tenant_id);
        $payload = $handover->toArray();
        $payload['declaration'] = [
            'version_key' => $declaration->version_key,
            'statement' => $declaration->statement,
        ];
        $payload['owner'] = 'SADC Parliamentary Forum';
        foreach ($payload['lines'] ?? [] as $i => $line) {
            if (! is_array($line['asset'] ?? null)) {
                continue;
            }
            $payload['lines'][$i]['asset'] = $this->redactNestedAsset($line['asset'], $viewer);
        }

        return $payload;
    }

    public function reminderDays(?User $unused = null, ?int $tenantId = null): array
    {
        $tenant = $tenantId ? \App\Models\Tenant::find($tenantId) : null;
        $settings = is_array($tenant?->settings) ? $tenant->settings : [];
        $days = $settings['assets']['handover_reminders'] ?? [0, 2, 5, 7];

        return array_values(array_map('intval', $days));
    }

    public function sendReminders(): int
    {
        $sent = 0;
        $open = AssetHandover::query()
            ->whereIn('status', ['awaiting_acceptance', 'partially_accepted', 'return_initiated'])
            ->whereNotNull('sent_at')
            ->get();

        foreach ($open as $handover) {
            $days = (int) $handover->sent_at->copy()->startOfDay()->diffInDays(now()->copy()->startOfDay());
            $schedule = $this->reminderDays(null, (int) $handover->tenant_id);
            if (! in_array($days, $schedule, true)) {
                continue;
            }
            if ($handover->last_reminded_at && $handover->last_reminded_at->isSameDay(now())) {
                continue;
            }
            $recipient = $handover->toUser;
            if ($recipient) {
                $this->notifyRecipient($handover, $recipient, 'assets.handover.reminder');
                $sent++;
            }
            $max = $schedule === [] ? 7 : max($schedule);
            if ($days >= $max) {
                $this->notifyManagers($handover, 'assets.handover.supervisor_reminder');
                $sent++;
            }
            $handover->last_reminded_at = now();
            $handover->reminders_sent = (int) $handover->reminders_sent + 1;
            $handover->save();
        }

        return $sent;
    }

    private function completeNonPerson(AssetHandover $handover, User $actor): void
    {
        foreach ($handover->lines as $line) {
            $this->openPlacementCustody($handover, $line, $actor);
            $line->line_status = 'accepted';
            $line->recipient_response = 'received';
            $line->responded_at = now();
            $line->responded_by = $actor->id;
            $line->save();
        }
        $handover->status = $handover->type === 'return' ? 'return_verified' : 'accepted';
        $handover->accepted_at = now();
        $handover->save();
        $declaration = AssetHandoverDeclarationVersion::currentForTenant((int) $actor->tenant_id);
        $this->storeCertificate($handover, $actor, $declaration);
    }

    private function openCustodyForLine(AssetHandover $handover, AssetHandoverLine $line, User $actor): void
    {
        $asset = $line->asset()->first() ?? $line->asset;
        if ($handover->type === 'return' || $handover->custody_target_type !== 'person') {
            $this->openPlacementCustody($handover, $line, $actor);

            return;
        }

        $assignee = User::findOrFail($handover->to_user_id);
        $updated = $this->assets->assign($asset, $assignee, $actor, [
            'skip_handshake' => true,
            'skip_manage' => true,
            'notes' => 'Handover '.$handover->reference,
            'location_id' => $handover->to_location_id,
        ]);
        $open = AssetAssignmentHistory::query()
            ->where('asset_id', $updated->id)
            ->whereNull('returned_at')
            ->orderByDesc('id')
            ->first();
        if ($open) {
            $open->custodian_type = 'person';
            $open->handover_id = $handover->id;
            $open->handover_line_id = $line->id;
            $open->save();
        }
        $updated->reserved_handover_id = null;
        $updated->custodian_type = 'person';
        $updated->save();
        $this->timeline->record($updated, 'CUSTODY_OPENED', 'Custody opened via '.$handover->reference, $actor, [
            'handover_id' => $handover->id,
            'custodian_type' => 'person',
            'to_user_id' => $assignee->id,
        ]);
        if ($handover->type === 'transfer' && $handover->to_user_id) {
            AssetTransfer::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'from_user_id' => $handover->from_user_id,
                'to_user_id' => $handover->to_user_id,
                'status' => 'accepted',
                'initiated_by' => $actor->id,
                'reason' => 'Handover '.$handover->reference,
                'accepted_at' => now(),
                'accepted_by' => $actor->id,
                'completed_at' => now(),
            ]);
        }
    }

    private function openPlacementCustody(AssetHandover $handover, AssetHandoverLine $line, User $actor): void
    {
        $asset = $line->asset()->first() ?? Asset::find($line->asset_id);
        $open = AssetAssignmentHistory::query()
            ->where('asset_id', $asset->id)
            ->whereNull('returned_at')
            ->orderByDesc('id')
            ->first();
        if ($open) {
            $open->returned_at = now();
            $open->ended_at = now();
            $open->save();
            $this->timeline->record($asset, 'CUSTODY_CLOSED', 'Custody closed via '.$handover->reference, $actor, [
                'handover_id' => $handover->id,
            ]);
        }

        $isReturn = $handover->type === 'return';
        $storeId = $handover->to_location_id ?: $asset->home_location_id ?: $this->batches->defaultStoreId((int) $asset->tenant_id);

        AssetAssignmentHistory::create([
            'tenant_id' => $asset->tenant_id,
            'asset_id' => $asset->id,
            'assigned_to' => $isReturn ? null : $handover->to_user_id,
            'custodian_type' => $isReturn ? 'location' : $handover->custody_target_type,
            'custodian_department_id' => $handover->to_department_id,
            'custodian_location_id' => $isReturn ? $storeId : ($handover->to_location_id ?: $storeId),
            'department' => $asset->department,
            'assignment_type' => 'custody',
            'assigned_at' => now(),
            'assigned_by' => $actor->id,
            'acknowledged_at' => now(),
            'handover_id' => $handover->id,
            'handover_line_id' => $line->id,
            'notes' => 'Handover '.$handover->reference,
            'ended_at' => $isReturn ? now() : null,
            'returned_at' => $isReturn ? now() : null,
        ]);

        $asset->assigned_to = $isReturn ? null : $handover->to_user_id;
        $asset->acknowledgement_at = $isReturn ? null : now();
        $asset->custody_state = $isReturn ? null : 'accepted';
        $asset->status = $isReturn ? 'available' : 'active';
        $asset->custodian_type = $isReturn ? 'location' : $handover->custody_target_type;
        $asset->location_id = $isReturn ? $storeId : ($handover->to_location_id ?: $asset->location_id);
        $asset->reserved_handover_id = null;
        if ($line->condition_in) {
            $asset->condition = $line->condition_in;
        }
        $asset->save();
        $this->timeline->record($asset, $isReturn ? 'CUSTODY_CLOSED' : 'CUSTODY_OPENED', $isReturn ? 'Returned to store' : 'Placed in '.$handover->custody_target_type.' custody', $actor, [
            'handover_id' => $handover->id,
        ]);
    }

    private function returnExceptionLineToStore(AssetHandover $handover, AssetHandoverLine $line, User $actor): void
    {
        $asset = $line->asset()->first() ?? Asset::find($line->asset_id);
        $this->unreserve($asset, $handover->id);
        if ($handover->type !== 'issue') {
            return;
        }
        $asset->refresh();
        $storeId = $asset->home_location_id ?: $this->batches->defaultStoreId((int) $asset->tenant_id);
        $asset->reserved_handover_id = null;
        $asset->assigned_to = null;
        $asset->status = 'available';
        $asset->custodian_type = 'location';
        $asset->location_id = $storeId;
        $asset->custody_state = null;
        $asset->save();
        $this->timeline->record($asset, 'HANDOVER_LINE_EXCEPTION', 'Exception line returned to store', $actor, [
            'handover_id' => $handover->id,
            'condition_out' => $line->condition_out,
            'response' => $line->recipient_response,
        ]);
    }

    private function recordDisputeAssessment(AssetHandoverLine $line, User $actor, array $data): void
    {
        $newCondition = $data['condition_in'] ?? $data['new_condition'] ?? null;
        if (! $newCondition) {
            return;
        }
        AssetConditionAssessment::create([
            'tenant_id' => $line->tenant_id,
            'asset_id' => $line->asset_id,
            'previous_condition' => $line->condition_out,
            'new_condition' => $newCondition,
            'assessor_id' => $actor->id,
            'reason' => $data['dispute_notes'] ?? ('Handover dispute: '.$line->recipient_response),
            'assessed_at' => now(),
        ]);
    }

    private function unreserve(?Asset $asset, int $handoverId): void
    {
        if (! $asset) {
            return;
        }
        if ((int) $asset->reserved_handover_id === $handoverId) {
            $asset->reserved_handover_id = null;
            $asset->save();
        }
    }

    private function storeCertificate(AssetHandover $handover, User $actor, AssetHandoverDeclarationVersion $declaration): void
    {
        $handover->loadMissing(['lines', 'toUser', 'fromUser', 'createdBy']);
        $pdf = Pdf::loadView('pdf.asset_handover_certificate', [
            'handover' => $handover,
            'declaration' => $declaration,
            'actor' => $actor,
            'owner' => 'SADC Parliamentary Forum',
        ]);
        $path = 'asset-handovers/'.$handover->tenant_id.'/'.$handover->id.'/certificate.pdf';
        Storage::disk('local')->put($path, $pdf->output());
        $handover->certificate_path = $path;
        $handover->save();
    }

    private function notifyRecipient(AssetHandover $handover, User $user, string $trigger): void
    {
        try {
            $this->notifications->dispatch($user, $trigger, [
                'name' => $user->name,
                'reference' => $handover->reference,
                'count' => $handover->lines()->count(),
            ], ['module' => 'assets', 'record_id' => $handover->id, 'url' => '/assets/handovers/'.$handover->id, 'tenant_id' => $handover->tenant_id]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function notifyManagers(AssetHandover $handover, string $trigger): void
    {
        try {
            $admins = User::query()
                ->where('tenant_id', $handover->tenant_id)
                ->where('is_active', true)
                ->permission(['assets.handover.manage', 'assets.manage', 'assets.admin'])
                ->get();
            foreach ($admins as $admin) {
                $this->notifications->dispatch($admin, $trigger, [
                    'name' => $admin->name,
                    'reference' => $handover->reference,
                    'count' => $handover->lines()->count(),
                ], ['module' => 'assets', 'record_id' => $handover->id, 'url' => '/assets/handovers/'.$handover->id, 'tenant_id' => $handover->tenant_id]);
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function assertPersonTarget(User $actor, ?int $userId): void
    {
        if (! $userId) {
            throw ValidationException::withMessages(['to_user_id' => 'A person target is required.']);
        }
        $target = User::query()->where('tenant_id', $actor->tenant_id)->find($userId);
        if (! $target) {
            throw ValidationException::withMessages(['to_user_id' => 'Recipient must belong to the same organisation.']);
        }
        if (! $target->accountAllowsAuthentication() || ! $target->is_active) {
            throw ValidationException::withMessages(['to_user_id' => 'Deactivated or separated staff cannot be a new custodian.']);
        }
    }

    private function assertUnsignedOpen(AssetHandover $handover, string $message): void
    {
        if ($handover->signature_event_id || $handover->accepted_at) {
            throw ValidationException::withMessages(['status' => $message]);
        }
        if (! in_array($handover->status, ['awaiting_acceptance', 'return_initiated'], true)) {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }

    /**
     * @param  array<string, mixed>  $asset
     * @return array<string, mixed>
     */
    private function redactNestedAsset(array $asset, ?User $viewer): array
    {
        if (AssetAccess::canViewFinancials($viewer)) {
            return $asset;
        }
        foreach (AssetAccess::financialHidden() as $field) {
            if (array_key_exists($field, $asset)) {
                $asset[$field] = null;
            }
        }
        $asset['current_value'] = null;

        return $asset;
    }

    private function assertCanRespond(AssetHandover $handover, User $actor): void
    {
        if (AssetAccess::canManageHandover($actor)) {
            return;
        }
        if (! AssetAccess::canAcceptHandover($actor)) {
            abort(403);
        }
        $isRecipient = (int) $handover->to_user_id === (int) $actor->id;
        $isReturnInitiator = $handover->type === 'return' && (int) $handover->from_user_id === (int) $actor->id;
        if (! $isRecipient && ! $isReturnInitiator) {
            abort(403, 'Only the intended custodian can respond to this handover.');
        }
    }

    private function assertManage(User $actor): void
    {
        if (! AssetAccess::canManageHandover($actor)) {
            abort(403, 'Not authorised to manage handovers.');
        }
    }

    private function assertTenant(AssetHandover $handover, User $actor): void
    {
        if ((int) $handover->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }

    private function fresh(AssetHandover $handover): AssetHandover
    {
        return $handover->fresh(['lines.asset', 'toUser:id,name,email', 'fromUser:id,name,email']) ?? $handover;
    }
}
