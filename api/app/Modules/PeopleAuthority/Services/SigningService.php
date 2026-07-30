<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\DocumentSignatureEvent;
use App\Models\PeopleAuthority\SignatureEnrolment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Secure signing binds authenticated signer to document version + hash (PRD §70–78).
 * Specimen image alone is not signing authority.
 */
class SigningService
{
    public function __construct(
        private readonly AuthorityCheckService $authority,
        private readonly IdentityAuditService $audit,
    ) {}

    public function enrol(User $actor, array $data): SignatureEnrolment
    {
        $personId = (int) $data['person_id'];
        $linked = $this->authority->resolvePersonId($actor);
        $isAdmin = $actor->can('signatures.administer') || $actor->can('signatures.enrol');

        if (! $isAdmin && $linked !== $personId) {
            throw ValidationException::withMessages([
                'person_id' => ['You may only enrol your own signature unless you administer signatures.'],
            ]);
        }

        $specimen = (string) ($data['specimen_payload'] ?? $data['specimen_path'] ?? '');
        $hash = hash('sha256', $specimen !== '' ? $specimen : uniqid('specimen_', true));

        $enrolment = SignatureEnrolment::create([
            'tenant_id' => $actor->tenant_id,
            'person_id' => $personId,
            'user_id' => $data['user_id'] ?? $actor->id,
            'signature_profile_id' => $data['signature_profile_id'] ?? null,
            'enrolment_type' => $data['enrolment_type'] ?? 'drawn',
            'status' => 'pending',
            'specimen_path' => $data['specimen_path'] ?? null,
            'specimen_hash' => $hash,
            'administered_by' => $actor->id,
        ]);

        $this->audit->record($actor, 'signature.enrolled', $personId, SignatureEnrolment::class, $enrolment->id, [
            'enrolment_type' => $enrolment->enrolment_type,
        ], 'restricted');

        return $enrolment;
    }

    public function activate(User $actor, SignatureEnrolment $enrolment): SignatureEnrolment
    {
        if (! $actor->can('signatures.administer') && ! $actor->can('signatures.enrol')) {
            throw ValidationException::withMessages(['status' => ['Not permitted to activate signatures.']]);
        }

        $enrolment->update([
            'status' => 'active',
            'activated_at' => now(),
            'administered_by' => $actor->id,
        ]);

        $this->audit->record($actor, 'signature.activated', $enrolment->person_id, SignatureEnrolment::class, $enrolment->id);

        return $enrolment->fresh();
    }

    /**
     * @param  array{
     *   document_type:string,
     *   document_id:int|string,
     *   document_version_id?:?string,
     *   document_content:?string,
     *   document_hash?:?string,
     *   signature_meaning:string,
     *   authentication_strength?:string,
     *   module?:?string,
     *   amount?:?float,
     *   currency?:?string,
     *   requester_user_id?:?int,
     * }  $data
     */
    public function sign(User $actor, array $data): DocumentSignatureEvent
    {
        return DB::transaction(function () use ($actor, $data) {
            $personId = $this->authority->resolvePersonId($actor);
            if (! $personId) {
                throw ValidationException::withMessages([
                    'person' => ['Signer must be linked to a person record. Account alone is insufficient.'],
                ]);
            }

            $enrolment = SignatureEnrolment::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('person_id', $personId)
                ->where('status', 'active')
                ->latest('id')
                ->first();

            if (! $enrolment) {
                throw ValidationException::withMessages([
                    'signature' => ['No active signature enrolment. Specimen image without enrolment is not authority.'],
                ]);
            }

            $hash = $data['document_hash'] ?? null;
            if (! $hash) {
                $content = (string) ($data['document_content'] ?? '');
                if ($content === '') {
                    throw ValidationException::withMessages([
                        'document_hash' => ['Document hash or content is required.'],
                    ]);
                }
                $hash = hash('sha256', $content);
            }

            // Possession of signature image ≠ signing authority
            $check = $this->authority->check($actor, [
                'action' => 'sign',
                'module' => $data['module'] ?? null,
                'amount' => $data['amount'] ?? null,
                'currency' => $data['currency'] ?? null,
                'requester_user_id' => $data['requester_user_id'] ?? null,
                'require_contract_signing' => (bool) ($data['require_contract_signing'] ?? false),
                'context_type' => 'signature',
                'context_id' => is_numeric($data['document_id'] ?? null) ? (int) $data['document_id'] : null,
            ]);

            if (! $check['authorised']) {
                throw ValidationException::withMessages([
                    'authority' => [$check['denial_reason'] ?? 'Signing authority denied.'],
                ]);
            }

            // Immutability: refuse re-sign that would alter an existing hash binding for same version
            $existing = DocumentSignatureEvent::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('document_type', $data['document_type'])
                ->where('document_id', $data['document_id'])
                ->where('document_version_id', $data['document_version_id'] ?? null)
                ->where('status', 'valid')
                ->where('signer_person_id', $personId)
                ->first();

            if ($existing) {
                if ($existing->document_hash !== $hash) {
                    throw ValidationException::withMessages([
                        'document_hash' => ['Signed document is immutable; hash mismatch for this version.'],
                    ]);
                }

                return $existing;
            }

            $event = DocumentSignatureEvent::create([
                'tenant_id' => $actor->tenant_id,
                'document_type' => $data['document_type'],
                'document_id' => $data['document_id'],
                'document_version_id' => $data['document_version_id'] ?? null,
                'document_hash' => $hash,
                'signer_person_id' => $personId,
                'signer_account_id' => $actor->id,
                'position_snapshot' => [
                    'position_id' => $check['position_id'],
                ],
                'department_snapshot' => null,
                'signature_meaning' => $data['signature_meaning'],
                'authority_assignment_id' => $check['authority_used']['id'] ?? null,
                'authority_snapshot_id' => $check['snapshot_id'],
                'delegation_id' => $check['delegation_id'],
                'acting_appointment_id' => $check['acting_appointment_id'],
                'signature_enrolment_id' => $enrolment->id,
                'authentication_strength' => $data['authentication_strength'] ?? 'session',
                'signature_method' => $data['signature_method'] ?? 'image',
                'verification_reference' => $data['verification_reference'] ?? null,
                'status' => 'valid',
                'is_immutable' => true,
                'signed_at' => now(),
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $this->audit->record($actor, 'document.signed', $personId, DocumentSignatureEvent::class, $event->id, [
                'document_type' => $event->document_type,
                'document_id' => $event->document_id,
                'document_hash' => $event->document_hash,
                'meaning' => $event->signature_meaning,
            ]);

            return $event;
        });
    }
}
