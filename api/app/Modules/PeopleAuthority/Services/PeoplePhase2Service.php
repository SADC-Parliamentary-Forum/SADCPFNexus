<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\AccessReviewCampaign;
use App\Models\PeopleAuthority\AccessReviewItem;
use App\Models\PeopleAuthority\DocumentSignatureEvent;
use App\Models\PeopleAuthority\EmploymentRecord;
use App\Models\PeopleAuthority\OrganisationalUnit;
use App\Models\PeopleAuthority\PeopleAuthoritySodRule;
use App\Models\PeopleAuthority\PeopleDirectorySyncRun;
use App\Models\PeopleAuthority\PeopleEsignRequest;
use App\Models\PeopleAuthority\PeopleOrgScenario;
use App\Models\PeopleAuthority\PeopleSodConflictReport;
use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\SignatureEnrolment;
use App\Models\PeopleAuthority\UserRoleAssignment;
use App\Models\User;
use App\Modules\PeopleAuthority\Drivers\Certificate\CertificateSignatureDriverFactory;
use App\Modules\PeopleAuthority\Drivers\Directory\DirectorySyncProviderFactory;
use App\Modules\PeopleAuthority\Drivers\Esign\EsignProviderFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * People & Authority Phase 2 capabilities (PRD §126).
 */
class PeoplePhase2Service
{
    public function __construct(
        private readonly CertificateSignatureDriverFactory $certificates,
        private readonly EsignProviderFactory $esign,
        private readonly DirectorySyncProviderFactory $directory,
        private readonly IdentityAuditService $audit,
        private readonly SigningService $signing,
    ) {}

    public function enrolCertificate(User $actor, array $data): SignatureEnrolment
    {
        $driver = $this->certificates->make();
        $attested = $driver->enrolFromCertificate([
            'certificate_pem' => $data['certificate_pem'] ?? null,
            'thumbprint' => $data['thumbprint'] ?? null,
            'subject' => $data['subject'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        $enrolment = $this->signing->enrol($actor, [
            'person_id' => $data['person_id'],
            'user_id' => $data['user_id'] ?? $actor->id,
            'enrolment_type' => 'certificate_stub',
            'specimen_path' => null,
            'specimen_payload' => $attested['thumbprint'] ?? uniqid('cert_', true),
        ]);

        $enrolment->update([
            'enrolment_type' => $driver->driverName() === 'stub' ? 'certificate_stub' : 'certificate',
            'certificate_subject' => $attested['subject'],
            'certificate_thumbprint' => $attested['thumbprint'],
            'certificate_expires_at' => $attested['expires_at'] ?? null,
            'certificate_meta' => $attested['meta'] ?? [],
        ]);

        $this->audit->record($actor, 'signature.certificate_enrolled', (int) $data['person_id'], SignatureEnrolment::class, $enrolment->id, [
            'driver' => $driver->driverName(),
            'thumbprint' => $attested['thumbprint'],
        ], 'restricted');

        return $enrolment->fresh();
    }

    public function createEsignRequest(User $actor, array $data): PeopleEsignRequest
    {
        $provider = $this->esign->make();

        return PeopleEsignRequest::create([
            'tenant_id' => $actor->tenant_id,
            'document_type' => $data['document_type'],
            'document_id' => $data['document_id'],
            'document_version_id' => $data['document_version_id'] ?? null,
            'document_hash' => $data['document_hash'],
            'provider' => $provider->driverName(),
            'status' => 'draft',
            'recipients' => $data['recipients'] ?? [],
            'provider_payload' => $data['payload'] ?? [],
            'requested_by' => $actor->id,
            'notes' => $data['notes'] ?? null,
        ]);
    }

    public function submitEsignRequest(User $actor, PeopleEsignRequest $request): PeopleEsignRequest
    {
        $this->assertTenant($request->tenant_id, $actor);

        if ($request->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft e-sign requests can be submitted.']]);
        }

        // Human-triggered only — no auto-submit path.
        $provider = $this->esign->make($request->provider === 'null' ? null : $request->provider);
        $result = $provider->submit([
            'document_type' => $request->document_type,
            'document_id' => $request->document_id,
            'document_hash' => $request->document_hash,
            'recipients' => $request->recipients ?? [],
            'payload' => $request->provider_payload ?? [],
        ]);

        $request->update([
            'provider' => $provider->driverName(),
            'external_id' => $result['external_id'],
            'status' => $result['status'] ?? 'submitted',
            'provider_response' => $result['response'] ?? [],
            'submitted_at' => now(),
        ]);

        $this->audit->record($actor, 'esign.submitted', null, PeopleEsignRequest::class, $request->id, [
            'provider' => $provider->driverName(),
            'external_id' => $result['external_id'],
        ]);

        return $request->fresh();
    }

    public function listEsignRequests(User $actor)
    {
        return PeopleEsignRequest::query()
            ->where('tenant_id', $actor->tenant_id)
            ->latest('id')
            ->paginate(25);
    }

    public function runDirectorySync(User $actor, array $data): PeopleDirectorySyncRun
    {
        $dryRun = array_key_exists('dry_run', $data)
            ? (bool) $data['dry_run']
            : (bool) config('people_authority.m365_dry_run_default', true);

        $provider = $this->directory->make($data['driver'] ?? null);
        $run = PeopleDirectorySyncRun::create([
            'tenant_id' => $actor->tenant_id,
            'driver' => $provider->driverName(),
            'dry_run' => $dryRun,
            'status' => 'running',
            'started_by' => $actor->id,
            'started_at' => now(),
        ]);

        try {
            if ($provider->driverName() === 'null') {
                throw ValidationException::withMessages([
                    'm365' => ['Directory sync driver is null. Set PEOPLE_AUTHORITY_M365_DRIVER=fixture|microsoft_graph.'],
                ]);
            }

            $rows = $provider->fetchPeople();
            $matched = 0;
            $created = 0;
            $updated = 0;
            $skipped = 0;
            $samples = [];

            foreach ($rows as $row) {
                $email = strtolower(trim((string) ($row['mail'] ?? '')));
                if ($email === '') {
                    $skipped++;
                    continue;
                }

                $person = Person::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->whereRaw('LOWER(work_email) = ?', [$email])
                    ->first();

                if ($person) {
                    $matched++;
                    if (! $dryRun) {
                        $person->update([
                            'display_name' => $row['display_name'] ?? $person->display_name,
                            'first_name' => $row['given_name'] ?? $person->first_name,
                            'last_name' => $row['surname'] ?? $person->last_name,
                            'operational_meta' => array_merge($person->operational_meta ?? [], [
                                'm365_external_id' => $row['external_id'],
                                'm365_job_title' => $row['job_title'] ?? null,
                                'm365_department' => $row['department'] ?? null,
                                'm365_synced_at' => now()->toIso8601String(),
                            ]),
                        ]);
                        $updated++;
                    }
                } else {
                    if (! $dryRun) {
                        Person::create([
                            'tenant_id' => $actor->tenant_id,
                            'first_name' => $row['given_name'] ?? 'Unknown',
                            'last_name' => $row['surname'] ?? 'Unknown',
                            'display_name' => $row['display_name'] ?? trim(($row['given_name'] ?? '').' '.($row['surname'] ?? '')),
                            'work_email' => $email,
                            'person_type' => 'employee',
                            'employment_status' => 'active',
                            'directory_visible' => true,
                            'operational_meta' => [
                                'm365_external_id' => $row['external_id'],
                                'm365_job_title' => $row['job_title'] ?? null,
                                'm365_department' => $row['department'] ?? null,
                                'm365_synced_at' => now()->toIso8601String(),
                                'source' => 'directory_sync',
                            ],
                            'created_by' => $actor->id,
                        ]);
                        $created++;
                    } else {
                        $skipped++;
                    }
                }

                if (count($samples) < 5) {
                    $samples[] = [
                        'mail' => $email,
                        'external_id' => $row['external_id'],
                        'matched' => (bool) $person,
                    ];
                }
            }

            $run->update([
                'status' => 'completed',
                'fetched_count' => count($rows),
                'matched_count' => $matched,
                'created_count' => $created,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'summary' => [
                    'dry_run' => $dryRun,
                    'samples' => $samples,
                    'note' => 'Read-only directory synchronisation; no passwords or secrets stored.',
                ],
                'finished_at' => now(),
            ]);
        } catch (\Throwable $e) {
            $run->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'finished_at' => now(),
            ]);
            throw $e;
        }

        $this->audit->record($actor, 'directory.sync_completed', null, PeopleDirectorySyncRun::class, $run->id, [
            'driver' => $run->driver,
            'dry_run' => $run->dry_run,
            'fetched' => $run->fetched_count,
        ]);

        return $run->fresh();
    }

    public function listDirectorySyncRuns(User $actor)
    {
        return PeopleDirectorySyncRun::query()
            ->where('tenant_id', $actor->tenant_id)
            ->latest('id')
            ->paginate(25);
    }

    public function openRecertificationCampaign(User $actor, array $data): AccessReviewCampaign
    {
        return DB::transaction(function () use ($actor, $data) {
            $campaign = AccessReviewCampaign::create([
                'tenant_id' => $actor->tenant_id,
                'name' => $data['name'] ?? ('Role recertification '.now()->toDateString()),
                'campaign_type' => 'recertification',
                'recurrence' => $data['recurrence'] ?? 'quarterly',
                'auto_populate_roles' => (bool) ($data['auto_populate_roles'] ?? true),
                'status' => 'open',
                'due_date' => $data['due_date'] ?? now()->addDays(30)->toDateString(),
                'created_by' => $actor->id,
                'opened_at' => now(),
                'last_auto_opened_at' => now(),
            ]);

            if ($campaign->auto_populate_roles) {
                $assignments = UserRoleAssignment::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->whereIn('status', ['active', 'approved', 'pending'])
                    ->limit(500)
                    ->get();

                foreach ($assignments as $assignment) {
                    AccessReviewItem::create([
                        'tenant_id' => $actor->tenant_id,
                        'campaign_id' => $campaign->id,
                        'user_id' => $assignment->user_id,
                        'person_id' => null,
                        'review_type' => 'role_recertification',
                        'subject_snapshot' => [
                            'user_role_assignment_id' => $assignment->id,
                            'role_name' => $assignment->role_name,
                            'status' => $assignment->status,
                        ],
                        'status' => 'pending',
                    ]);
                }
            }

            $this->audit->record($actor, 'access_review.recertification_opened', null, AccessReviewCampaign::class, $campaign->id, [
                'items' => AccessReviewItem::where('campaign_id', $campaign->id)->count(),
            ]);

            return $campaign->fresh();
        });
    }

    public function runScheduledRecertifications(): int
    {
        if (! config('people_authority.recertification_schedule_enabled')) {
            return 0;
        }

        $opened = 0;
        $templates = AccessReviewCampaign::query()
            ->where('campaign_type', 'recertification')
            ->where('recurrence', 'quarterly')
            ->where('status', 'closed')
            ->where(function ($q) {
                $q->whereNull('last_auto_opened_at')
                    ->orWhere('last_auto_opened_at', '<=', now()->subMonths(3));
            })
            ->limit(5)
            ->get();

        foreach ($templates as $template) {
            // System opens a fresh campaign from closed template metadata; no auto-decisions.
            $systemUser = User::query()->where('tenant_id', $template->tenant_id)->orderBy('id')->first();
            if (! $systemUser) {
                continue;
            }
            $this->openRecertificationCampaign($systemUser, [
                'name' => $template->name.' (auto '.now()->toDateString().')',
                'recurrence' => $template->recurrence,
                'auto_populate_roles' => true,
                'due_date' => now()->addDays(30)->toDateString(),
            ]);
            $opened++;
        }

        return $opened;
    }

    public function analyseSod(User $actor, array $data = []): PeopleSodConflictReport
    {
        $rules = PeopleAuthoritySodRule::query()
            ->where(function ($q) use ($actor) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $actor->tenant_id);
            })
            ->where('is_active', true)
            ->get();

        if ($rules->isEmpty()) {
            // Seed a minimal advanced rule set for analysis beyond hardcoded self-approval SoD.
            $defaults = [
                ['code' => 'request_vs_approve', 'left' => 'procurement.request', 'right' => 'procurement.approve', 'description' => 'Requester cannot hold award/approve on same process'],
                ['code' => 'prepare_vs_sign', 'left' => 'documents.prepare', 'right' => 'documents.sign', 'description' => 'Preparer vs signer segregation'],
                ['code' => 'roles_assign_vs_approve', 'left' => 'roles.assign', 'right' => 'roles.approve', 'description' => 'Role assigner vs role approver'],
            ];
            foreach ($defaults as $row) {
                PeopleAuthoritySodRule::firstOrCreate(
                    ['tenant_id' => $actor->tenant_id, 'code' => $row['code']],
                    [
                        'left_role_or_perm' => $row['left'],
                        'right_role_or_perm' => $row['right'],
                        'rule_type' => 'incompatible',
                        'is_active' => true,
                        'description' => $row['description'],
                    ]
                );
            }
            $rules = PeopleAuthoritySodRule::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('is_active', true)
                ->get();
        }

        $conflicts = [];
        $users = User::query()->where('tenant_id', $actor->tenant_id)->limit(200)->get();
        foreach ($users as $user) {
            $perms = method_exists($user, 'getAllPermissions')
                ? $user->getAllPermissions()->pluck('name')->all()
                : [];
            $permSet = array_fill_keys($perms, true);

            foreach ($rules as $rule) {
                $left = $rule->left_role_or_perm;
                $right = $rule->right_role_or_perm;
                $hasLeft = isset($permSet[$left]) || $user->hasRole($left);
                $hasRight = isset($permSet[$right]) || $user->hasRole($right);
                if ($hasLeft && $hasRight) {
                    $conflicts[] = [
                        'user_id' => $user->id,
                        'user_email' => $user->email,
                        'rule_code' => $rule->code,
                        'left' => $left,
                        'right' => $right,
                        'description' => $rule->description,
                    ];
                }
            }
        }

        $report = PeopleSodConflictReport::create([
            'tenant_id' => $actor->tenant_id,
            'title' => $data['title'] ?? ('SoD analysis '.now()->toDateTimeString()),
            'status' => 'open',
            'conflict_count' => count($conflicts),
            'conflicts' => $conflicts,
            'rule_snapshot' => $rules->map(fn ($r) => [
                'code' => $r->code,
                'left' => $r->left_role_or_perm,
                'right' => $r->right_role_or_perm,
            ])->values()->all(),
            'generated_by' => $actor->id,
            'generated_at' => now(),
        ]);

        $this->audit->record($actor, 'sod.analysis_generated', null, PeopleSodConflictReport::class, $report->id, [
            'conflict_count' => $report->conflict_count,
        ]);

        return $report;
    }

    public function listSodReports(User $actor)
    {
        return PeopleSodConflictReport::query()
            ->where('tenant_id', $actor->tenant_id)
            ->latest('id')
            ->paginate(25);
    }

    public function createOrgScenario(User $actor, array $data): PeopleOrgScenario
    {
        $structure = $data['structure'] ?? null;
        if ($structure === null) {
            $units = OrganisationalUnit::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('status', 'active')
                ->get(['id', 'code', 'name', 'parent_id', 'unit_type']);
            $structure = [
                'units' => $units->toArray(),
                'note' => 'Draft future structure cloned from current active units — not live.',
            ];
        }

        $scenario = PeopleOrgScenario::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'],
            'status' => 'draft',
            'description' => $data['description'] ?? null,
            'structure' => $structure,
            'created_by' => $actor->id,
        ]);

        $this->audit->record($actor, 'org_scenario.created', null, PeopleOrgScenario::class, $scenario->id);

        return $scenario;
    }

    public function listOrgScenarios(User $actor)
    {
        return PeopleOrgScenario::query()
            ->where('tenant_id', $actor->tenant_id)
            ->latest('id')
            ->paginate(25);
    }

    public function linkPayrollIdentifier(User $actor, EmploymentRecord $employment, array $data): EmploymentRecord
    {
        $this->assertTenant($employment->tenant_id, $actor);

        // Link identifier only — never invent OT rates or payroll amounts.
        $employment->update([
            'payroll_identifier' => $data['payroll_identifier'],
            'payroll_export_status' => $data['payroll_export_status'] ?? 'linked',
            'meta' => array_merge($employment->meta ?? [], [
                'payroll_linked_at' => now()->toIso8601String(),
                'payroll_linked_by' => $actor->id,
            ]),
        ]);

        $this->audit->record($actor, 'employment.payroll_linked', $employment->person_id, EmploymentRecord::class, $employment->id, [
            'payroll_identifier' => $employment->payroll_identifier,
        ], 'restricted');

        return $employment->fresh();
    }

    public function exportPayrollLinks(User $actor): array
    {
        $rows = EmploymentRecord::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereNotNull('payroll_identifier')
            ->get(['id', 'person_id', 'employee_number', 'payroll_identifier', 'status']);

        EmploymentRecord::query()
            ->whereIn('id', $rows->pluck('id'))
            ->update([
                'payroll_export_status' => 'exported',
                'payroll_last_exported_at' => now(),
            ]);

        return [
            'exported_at' => now()->toIso8601String(),
            'count' => $rows->count(),
            'rows' => $rows->map(fn ($r) => [
                'employment_id' => $r->id,
                'person_id' => $r->person_id,
                'employee_number' => $r->employee_number,
                'payroll_identifier' => $r->payroll_identifier,
                'status' => $r->status,
            ])->values()->all(),
            'note' => 'Identifier export only — no rates or amounts invented.',
        ];
    }

    public function publishSignatureVerification(User $actor, DocumentSignatureEvent $event): DocumentSignatureEvent
    {
        $this->assertTenant($event->tenant_id, $actor);

        if ($event->status !== 'valid') {
            throw ValidationException::withMessages(['status' => ['Only valid signatures can be published for verification.']]);
        }

        if (! $event->public_verification_token) {
            $event->public_verification_token = Str::random(48);
        }
        $event->published_for_verification_at = now();
        $event->save();

        $this->audit->record($actor, 'signature.published_for_verification', $event->signer_person_id, DocumentSignatureEvent::class, $event->id);

        return $event->fresh();
    }

    /** Approved metadata only — no IP, user-agent, confidential snapshots. */
    public function publicVerify(string $token): array
    {
        $event = DocumentSignatureEvent::query()
            ->where('public_verification_token', $token)
            ->whereNotNull('published_for_verification_at')
            ->where('status', 'valid')
            ->first();

        if (! $event) {
            throw ValidationException::withMessages(['token' => ['Signature verification token is invalid or unpublished.']]);
        }

        return [
            'valid' => true,
            'document_type' => $event->document_type,
            'document_id' => $event->document_id,
            'document_version_id' => $event->document_version_id,
            'document_hash' => $event->document_hash,
            'signature_meaning' => $event->signature_meaning,
            'signature_method' => $event->signature_method,
            'signed_at' => optional($event->signed_at)->toIso8601String(),
            'verification_reference' => $event->verification_reference,
            'note' => 'Public verification exposes approved metadata only.',
        ];
    }

    private function assertTenant(int $tenantId, User $actor): void
    {
        if ((int) $actor->tenant_id !== $tenantId) {
            throw ValidationException::withMessages(['tenant' => ['Tenant mismatch.']]);
        }
    }
}
