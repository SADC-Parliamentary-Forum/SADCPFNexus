<?php

namespace App\Modules\AdminConsole\Services;

use App\Models\User;
use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

class AdminConsoleService
{
    private const JSON_COLUMNS = [
        'routes', 'required_permissions', 'background_jobs', 'integration_events', 'feature_flags',
        'metadata', 'allowed_values', 'default_value', 'validation_rule', 'value', 'current_value',
        'proposed_value', 'affected_modules', 'affected_users', 'validation_result', 'snapshot',
        'configuration', 'working_days', 'working_hours', 'voided_references', 'data_classes',
        'retry_policy', 'metrics', 'dependencies', 'scope', 'original_payload', 'resolution',
        'affected_services', 'read_only_services', 'unavailable_services', 'audience',
        'affected_records', 'definition', 'verification', 'current_value_snapshot',
        'proposed_change', 'dry_run_result', 'mapping', 'reconciliation_result', 'record_counts',
        'failed_records', 'reconciliation', 'capacity', 'requested_permissions', 'post_session_review',
        'post_use_review',
    ];

    public function ensureSeeded(int $tenantId): void
    {
        if (! Schema::hasTable('platform_modules')) {
            return;
        }

        DB::transaction(function () use ($tenantId) {
            $this->seedModules($tenantId);
            $this->seedConfiguration($tenantId);
            $this->seedReferenceData($tenantId);
            $this->seedFeatureFlags($tenantId);
            $this->seedCalendarsAndNumbering($tenantId);
            $this->seedLocalisation($tenantId);
            $this->seedIntegrationsAndJobs($tenantId);
            $this->seedDataQualityAndBackup($tenantId);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function dashboard(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $health = $this->platformStatus($tenantId);

        return [
            'status' => $health['overall_status'],
            'cards' => [
                'modules_active' => $this->count('platform_modules', $tenantId, ['status' => 'active']),
                'modules_degraded' => DB::table('platform_modules')->where('tenant_id', $tenantId)->whereIn('health_status', ['degraded', 'failing'])->count(),
                'configuration_pending' => DB::table('configuration_change_requests')->where('tenant_id', $tenantId)->whereIn('status', ['proposed', 'validated', 'pending_approval', 'approved', 'scheduled'])->count(),
                'feature_flags_active' => $this->count('feature_flags', $tenantId, ['status' => 'active']),
                'job_failures' => DB::table('scheduled_job_runs')->where('tenant_id', $tenantId)->where('status', 'failed')->count(),
                'dead_letters_open' => $this->openDeadLetterCount($tenantId),
                'data_quality_open' => DB::table('data_quality_issues')->where('tenant_id', $tenantId)->whereIn('status', ['open', 'assigned'])->count(),
                'support_sessions_active' => DB::table('support_access_sessions')->where('tenant_id', $tenantId)->where('status', 'active')->count(),
                'break_glass_active' => DB::table('break_glass_sessions')->where('tenant_id', $tenantId)->where('status', 'active')->count(),
            ],
            'critical_alerts' => $this->rows('operational_alerts', $tenantId, fn ($q) => $q->whereIn('severity', ['critical', 'high'])->whereNotIn('status', ['resolved', 'closed'])->orderByDesc('detected_at')->limit(8)),
            'health' => $health,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function platformStatus(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $services = [
            'web' => $this->serviceStatus('Web', 'operational'),
            'api' => $this->serviceStatus('API', 'operational'),
            'authentication' => $this->serviceStatus('Authentication', 'operational'),
            'database' => $this->serviceStatus('Database', 'operational', ['driver' => DB::getDriverName()]),
            'workflow' => $this->moduleServiceStatus($tenantId, 'workflow-engine', 'Workflow'),
            'notifications' => $this->integrationServiceStatus($tenantId, 'notification-delivery', 'Notifications'),
            'documents' => $this->moduleServiceStatus($tenantId, 'documents', 'Documents'),
            'search' => $this->integrationServiceStatus($tenantId, 'search-index', 'Search'),
            'reporting' => $this->moduleServiceStatus($tenantId, 'reports', 'Reporting'),
            'integrations' => $this->integrationAggregateStatus($tenantId),
            'background_jobs' => $this->jobAggregateStatus($tenantId),
            'audit_trail' => $this->auditTrailStatus($tenantId),
            'backups' => $this->backupAggregateStatus($tenantId),
        ];

        $priority = ['major_outage', 'partial_outage', 'degraded', 'maintenance', 'unknown', 'operational'];
        $overall = 'operational';
        foreach ($priority as $status) {
            if (collect($services)->contains(fn ($service) => ($service['status'] ?? null) === $status)) {
                $overall = $status;
                break;
            }
        }

        return [
            'overall_status' => $overall,
            'services' => $services,
            'maintenance_active' => DB::table('maintenance_windows')->where('tenant_id', $tenantId)->where('status', 'active')->exists(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function modules(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);

        return $this->rows('platform_modules', $tenantId, fn ($q) => $q->orderBy('name'));
    }

    /**
     * @return array<string, mixed>
     */
    public function module(int $tenantId, int $id): array
    {
        $module = $this->row('platform_modules', $tenantId, $id);
        $module['dependencies'] = $this->rows('module_dependencies', $tenantId, fn ($q) => $q->where('source_module_id', $id)->orderBy('depends_on_key'));

        return $module;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function changeModuleStatus(int $tenantId, int $id, array $data, User $actor): array
    {
        $module = $this->row('platform_modules', $tenantId, $id);
        $newStatus = (string) $data['status'];

        if (in_array($newStatus, ['temporarily_disabled', 'retired', 'archived'], true)) {
            $dependencies = DB::table('module_dependencies')
                ->where('tenant_id', $tenantId)
                ->where('depends_on_key', $module['module_key'])
                ->exists();
            abort_if($dependencies, 422, 'Dependency conflict: another active module depends on this module.');
        }

        DB::table('platform_modules')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => $newStatus,
            'availability' => $data['availability'] ?? $this->availabilityForModuleStatus($newStatus),
            'health_status' => $data['health_status'] ?? $module['health_status'],
            'metadata' => $this->json(array_merge($module['metadata'] ?? [], [
                'last_status_reason' => $data['reason'] ?? null,
                'changed_by' => $actor->id,
                'changed_at' => now()->toIso8601String(),
            ])),
            'updated_at' => now(),
        ]);

        $updated = $this->module($tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'module_status_changed', 'PlatformModule', $id, $module, $updated, $data['reason'] ?? null);

        return $updated;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function configurations(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $definitions = $this->rows('configuration_definitions', $tenantId, fn ($q) => $q->orderBy('domain')->orderBy('config_key'));

        foreach ($definitions as &$definition) {
            $definition['current_version'] = $this->activeConfigurationVersion($tenantId, (int) $definition['id']);
            $definition['pending_changes'] = $this->rows('configuration_change_requests', $tenantId, fn ($q) => $q->where('configuration_definition_id', $definition['id'])->whereIn('status', ['proposed', 'validated', 'pending_approval', 'approved', 'scheduled'])->orderByDesc('id'));
        }

        return $definitions;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function proposeConfigurationChange(int $tenantId, int $definitionId, array $data, User $actor): array
    {
        $definition = $this->row('configuration_definitions', $tenantId, $definitionId);
        $current = $this->activeConfigurationVersion($tenantId, $definitionId);
        $reference = $this->reference('CFG');

        $id = DB::table('configuration_change_requests')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $reference,
            'configuration_definition_id' => $definitionId,
            'current_version_id' => $current['id'] ?? null,
            'current_value' => $this->json($current['value'] ?? $definition['default_value'] ?? null),
            'proposed_value' => $this->json($this->normaliseConfigValue($data['proposed_value'] ?? null, $definition)),
            'reason' => $data['reason'],
            'business_justification' => $data['business_justification'] ?? null,
            'risk_assessment' => $data['risk_assessment'] ?? $definition['sensitivity'],
            'affected_modules' => $this->json($data['affected_modules'] ?? $this->affectedModulesForConfig($tenantId, $definition['domain'])),
            'affected_users' => $this->json($data['affected_users'] ?? []),
            'effective_from' => $data['effective_from'] ?? null,
            'testing_evidence' => $data['testing_evidence'] ?? null,
            'rollback_plan' => $data['rollback_plan'] ?? null,
            'requested_by' => $actor->id,
            'status' => 'proposed',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $change = $this->row('configuration_change_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'configuration_change_proposed', 'ConfigurationChangeRequest', $id, null, $change, $data['reason'] ?? null);

        return $change;
    }

    /**
     * @return array<string, mixed>
     */
    public function validateConfigurationChange(int $tenantId, int $id, User $actor): array
    {
        $change = $this->row('configuration_change_requests', $tenantId, $id);
        $definition = $this->row('configuration_definitions', $tenantId, (int) $change['configuration_definition_id']);
        $errors = [];
        $value = $change['proposed_value']['value'] ?? $change['proposed_value'];

        if ($definition['data_type'] === 'integer' && filter_var($value, FILTER_VALIDATE_INT) === false) {
            $errors[] = 'The proposed value must be an integer.';
        }
        if ($definition['data_type'] === 'decimal' && ! is_numeric($value)) {
            $errors[] = 'The proposed value must be numeric.';
        }
        if ($definition['data_type'] === 'boolean' && ! is_bool($value)) {
            $errors[] = 'The proposed value must be true or false.';
        }
        if ($definition['data_type'] === 'secure_secret_reference' && is_string($value) && preg_match('/(secret|password|token)=/i', $value)) {
            $errors[] = 'Secret configuration must store only a secret-manager reference, not a raw secret.';
        }
        if ($definition['allowed_values'] && ! in_array($value, $definition['allowed_values'], true)) {
            $errors[] = 'The proposed value is outside the allowed value list.';
        }
        if (($change['effective_from'] ?? null) && strtotime((string) $change['effective_from']) < strtotime('-1 day')) {
            $errors[] = 'Effective date cannot be in the past.';
        }

        $result = [
            'valid' => $errors === [],
            'errors' => $errors,
            'dependency_warnings' => $this->dependencyWarnings($tenantId, $definition),
            'validated_at' => now()->toIso8601String(),
        ];

        DB::table('configuration_change_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'validation_result' => $this->json($result),
            'status' => $result['valid'] ? 'validated' : 'validation_failed',
            'updated_at' => now(),
        ]);

        $updated = $this->row('configuration_change_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'configuration_change_validated', 'ConfigurationChangeRequest', $id, $change, $updated);

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function reviewConfigurationChange(int $tenantId, int $id, array $data, User $actor): array
    {
        $change = $this->row('configuration_change_requests', $tenantId, $id);
        DB::table('configuration_reviews')->insert([
            'tenant_id' => $tenantId,
            'configuration_change_request_id' => $id,
            'reviewer_id' => $actor->id,
            'review_type' => $data['review_type'],
            'decision' => $data['decision'],
            'notes' => $data['notes'] ?? null,
            'reviewed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $updates = [
            'reviewed_at' => now(),
            'updated_at' => now(),
        ];
        if ($data['review_type'] === 'technical') {
            $updates['technical_reviewer_id'] = $actor->id;
        } elseif ($data['review_type'] === 'business') {
            $updates['business_owner_id'] = $actor->id;
        } elseif ($data['review_type'] === 'security') {
            $updates['security_reviewer_id'] = $actor->id;
        }
        $updates['status'] = $data['decision'] === 'reject' ? 'rejected' : 'pending_approval';
        DB::table('configuration_change_requests')->where('tenant_id', $tenantId)->where('id', $id)->update($updates);

        $updated = $this->row('configuration_change_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'configuration_change_reviewed', 'ConfigurationChangeRequest', $id, $change, $updated, $data['notes'] ?? null);

        return $updated;
    }

    /**
     * @return array<string, mixed>
     */
    public function approveConfigurationChange(int $tenantId, int $id, User $actor): array
    {
        $change = $this->row('configuration_change_requests', $tenantId, $id);
        $definition = $this->row('configuration_definitions', $tenantId, (int) $change['configuration_definition_id']);
        abort_if(in_array($change['status'], ['rejected', 'cancelled', 'active'], true), 422, 'This configuration change cannot be approved from its current status.');
        abort_if($this->requiresFourEyes($definition, $change) && (int) $change['requested_by'] === $actor->id, 422, 'Approval required: requester cannot solely approve this high-risk configuration change.');
        abort_if(($change['validation_result']['valid'] ?? false) !== true, 422, 'Approval required: validate the configuration change before approval.');

        DB::table('configuration_change_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'approver_id' => $actor->id,
            'approved_at' => now(),
            'status' => 'approved',
            'updated_at' => now(),
        ]);

        $updated = $this->row('configuration_change_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'configuration_change_approved', 'ConfigurationChangeRequest', $id, $change, $updated);

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function scheduleConfigurationChange(int $tenantId, int $id, array $data, User $actor): array
    {
        $change = $this->row('configuration_change_requests', $tenantId, $id);
        abort_unless(in_array($change['status'], ['approved', 'scheduled'], true), 422, 'Only approved configuration changes may be scheduled.');

        DB::table('configuration_change_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'effective_from' => $data['effective_from'],
            'scheduled_at' => now(),
            'status' => 'scheduled',
            'updated_at' => now(),
        ]);

        $updated = $this->row('configuration_change_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'configuration_change_scheduled', 'ConfigurationChangeRequest', $id, $change, $updated);

        return $updated;
    }

    /**
     * @return array<string, mixed>
     */
    public function activateConfigurationChange(int $tenantId, int $id, User $actor): array
    {
        return DB::transaction(function () use ($tenantId, $id, $actor) {
            $change = $this->row('configuration_change_requests', $tenantId, $id);
            abort_unless(in_array($change['status'], ['approved', 'scheduled'], true), 422, 'Only approved or scheduled changes may be activated.');

            $definition = $this->row('configuration_definitions', $tenantId, (int) $change['configuration_definition_id']);
            $latestVersion = DB::table('configuration_versions')
                ->where('tenant_id', $tenantId)
                ->where('configuration_definition_id', $definition['id'])
                ->lockForUpdate()
                ->orderByDesc('version')
                ->first();

            $nextVersion = $latestVersion ? ((int) $latestVersion->version + 1) : 1;
            $value = $change['proposed_value'];
            $effectiveFrom = $change['effective_from'] ?? now();

            DB::table('configuration_versions')
                ->where('tenant_id', $tenantId)
                ->where('configuration_definition_id', $definition['id'])
                ->whereNull('effective_to')
                ->update(['effective_to' => now(), 'activation_status' => 'superseded', 'updated_at' => now()]);

            $versionId = DB::table('configuration_versions')->insertGetId([
                'tenant_id' => $tenantId,
                'configuration_definition_id' => $definition['id'],
                'version' => $nextVersion,
                'value' => $this->json($value),
                'value_hash' => $this->hashValue($value),
                'schema_version' => 1,
                'effective_from' => $effectiveFrom,
                'requested_by' => $change['requested_by'],
                'reviewed_by' => $change['technical_reviewer_id'] ?? $change['business_owner_id'] ?? $change['security_reviewer_id'] ?? null,
                'approved_by' => $change['approver_id'],
                'activated_by' => $actor->id,
                'activation_status' => 'active',
                'change_reference' => $change['reference'],
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('configuration_change_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
                'status' => 'active',
                'activated_at' => now(),
                'updated_at' => now(),
            ]);

            $version = $this->row('configuration_versions', $tenantId, $versionId);
            $this->audit($tenantId, $actor, 'system.config.updated', 'configuration_change_activated', 'ConfigurationVersion', $versionId, $change['current_value'] ?? null, $value, $change['reason'] ?? null);

            return $version;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function rollbackConfigurationChange(int $tenantId, int $id, array $data, User $actor): array
    {
        return DB::transaction(function () use ($tenantId, $id, $data, $actor) {
            $change = DB::table('configuration_change_requests')
                ->where('tenant_id', $tenantId)
                ->where('id', $id)
                ->first();
            $definitionId = $change ? (int) $change->configuration_definition_id : $id;
            $definition = $this->row('configuration_definitions', $tenantId, $definitionId);
            abort_unless((bool) $definition['rollback_supported'], 422, 'Rollback is not supported for this configuration.');
            $current = $this->activeConfigurationVersion($tenantId, $definitionId);
            $target = $data['rollback_version_id']
                ? $this->row('configuration_versions', $tenantId, (int) $data['rollback_version_id'])
                : $this->previousConfigurationVersion($tenantId, $definitionId);
            abort_if(! $target, 422, 'No rollback target version is available.');

            DB::table('configuration_versions')
                ->where('tenant_id', $tenantId)
                ->where('configuration_definition_id', $definitionId)
                ->whereNull('effective_to')
                ->update(['effective_to' => now(), 'activation_status' => 'superseded', 'updated_at' => now()]);

            $nextVersion = ((int) (DB::table('configuration_versions')->where('tenant_id', $tenantId)->where('configuration_definition_id', $definitionId)->max('version') ?? 0)) + 1;
            $versionId = DB::table('configuration_versions')->insertGetId([
                'tenant_id' => $tenantId,
                'configuration_definition_id' => $definitionId,
                'version' => $nextVersion,
                'value' => $this->json($target['value']),
                'value_hash' => $this->hashValue($target['value']),
                'schema_version' => 1,
                'effective_from' => now(),
                'requested_by' => $actor->id,
                'approved_by' => $actor->id,
                'activated_by' => $actor->id,
                'activation_status' => 'active',
                'rollback_version_id' => $target['id'],
                'change_reference' => $this->reference('RLB'),
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($change) {
                DB::table('configuration_change_requests')
                    ->where('tenant_id', $tenantId)
                    ->where('id', $id)
                    ->update(['status' => 'rolled_back', 'rolled_back_at' => now(), 'updated_at' => now()]);
            }

            $version = $this->row('configuration_versions', $tenantId, $versionId);
            $this->audit($tenantId, $actor, 'system.config.updated', 'configuration_rolled_back', 'ConfigurationDefinition', $definitionId, $current, $version, $data['reason'] ?? null);

            return $version;
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function referenceData(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $sets = $this->rows('reference_data_sets', $tenantId, fn ($q) => $q->orderBy('domain')->orderBy('name'));
        foreach ($sets as &$set) {
            $set['items_count'] = DB::table('reference_data_items')->where('tenant_id', $tenantId)->where('reference_data_set_id', $set['id'])->count();
            $set['items'] = $this->rows('reference_data_items', $tenantId, fn ($q) => $q->where('reference_data_set_id', $set['id'])->orderBy('sequence')->orderBy('code')->limit(100));
        }

        return $sets;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function addReferenceItem(int $tenantId, int $setId, array $data, User $actor): array
    {
        $set = $this->row('reference_data_sets', $tenantId, $setId);
        abort_unless((bool) $set['extensible'], 422, 'This reference-data set is not extensible.');
        $id = DB::table('reference_data_items')->insertGetId([
            'tenant_id' => $tenantId,
            'reference_data_set_id' => $setId,
            'uuid' => (string) Str::uuid(),
            'code' => strtoupper(trim($data['code'])),
            'label_en' => $data['label_en'],
            'label_fr' => $data['label_fr'] ?? null,
            'label_pt' => $data['label_pt'] ?? null,
            'description' => $data['description'] ?? null,
            'sequence' => $data['sequence'] ?? 0,
            'effective_from' => $data['effective_from'] ?? null,
            'status' => 'active',
            'metadata' => $this->json($data['metadata'] ?? []),
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $item = $this->row('reference_data_items', $tenantId, $id);
        $this->snapshotReferenceItem($id, $item, $actor);
        $this->audit($tenantId, $actor, 'system.admin.action', 'reference_item_created', 'ReferenceDataItem', $id, null, $item);

        return $item;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateReferenceItem(int $tenantId, int $id, array $data, User $actor): array
    {
        $old = $this->row('reference_data_items', $tenantId, $id);
        DB::table('reference_data_items')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'label_en' => $data['label_en'] ?? $old['label_en'],
            'label_fr' => array_key_exists('label_fr', $data) ? $data['label_fr'] : $old['label_fr'],
            'label_pt' => array_key_exists('label_pt', $data) ? $data['label_pt'] : $old['label_pt'],
            'description' => array_key_exists('description', $data) ? $data['description'] : $old['description'],
            'sequence' => $data['sequence'] ?? $old['sequence'],
            'effective_to' => array_key_exists('effective_to', $data) ? $data['effective_to'] : $old['effective_to'],
            'metadata' => $this->json($data['metadata'] ?? $old['metadata'] ?? []),
            'version' => ((int) $old['version']) + 1,
            'updated_at' => now(),
        ]);

        $updated = $this->row('reference_data_items', $tenantId, $id);
        $this->snapshotReferenceItem($id, $updated, $actor);
        $this->audit($tenantId, $actor, 'system.admin.action', 'reference_item_updated', 'ReferenceDataItem', $id, $old, $updated);

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function deprecateReferenceItem(int $tenantId, int $id, array $data, User $actor): array
    {
        $old = $this->row('reference_data_items', $tenantId, $id);
        DB::table('reference_data_items')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => 'deprecated',
            'deprecated_at' => now(),
            'effective_to' => $data['effective_to'] ?? now(),
            'replacement_item_id' => $data['replacement_item_id'] ?? null,
            'metadata' => $this->json(array_merge($old['metadata'] ?? [], [
                'deprecation_reason' => $data['reason'] ?? null,
                'dependency_analysis' => $this->referenceDependencyAnalysis($old),
            ])),
            'version' => ((int) $old['version']) + 1,
            'updated_at' => now(),
        ]);

        $updated = $this->row('reference_data_items', $tenantId, $id);
        $this->snapshotReferenceItem($id, $updated, $actor);
        $this->audit($tenantId, $actor, 'system.admin.action', 'reference_item_deprecated', 'ReferenceDataItem', $id, $old, $updated, $data['reason'] ?? null);

        return $updated;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    public function importReferenceData(int $tenantId, int $setId, array $rows, bool $dryRun, User $actor): array
    {
        $set = $this->row('reference_data_sets', $tenantId, $setId);
        $existingCodes = DB::table('reference_data_items')->where('tenant_id', $tenantId)->where('reference_data_set_id', $setId)->pluck('code')->map(fn ($c) => strtoupper((string) $c))->all();
        $errors = [];
        foreach ($rows as $i => $row) {
            if (empty($row['code']) || empty($row['label_en'])) {
                $errors[] = ['row' => $i + 1, 'error' => 'code and label_en are required'];
            } elseif (in_array(strtoupper((string) $row['code']), $existingCodes, true)) {
                $errors[] = ['row' => $i + 1, 'error' => 'duplicate code'];
            }
        }

        $result = [
            'dry_run' => $dryRun,
            'set_key' => $set['set_key'],
            'rows_total' => count($rows),
            'rows_valid' => count($rows) - count($errors),
            'rows_failed' => count($errors),
            'errors' => $errors,
        ];

        if (! $dryRun && $errors === []) {
            foreach ($rows as $row) {
                $this->addReferenceItem($tenantId, $setId, $row, $actor);
            }
        }

        $this->audit($tenantId, $actor, 'system.admin.action', 'reference_data_import_previewed', 'ReferenceDataSet', $setId, null, $result);

        return $result;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function featureFlags(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $flags = $this->rows('feature_flags', $tenantId, fn ($q) => $q->orderBy('flag_key'));
        foreach ($flags as &$flag) {
            $flag['targets'] = DB::table('feature_flag_targets')->where('feature_flag_id', $flag['id'])->get()->map(fn ($row) => $this->decodeRow((array) $row))->all();
        }

        return $flags;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function calendars(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $calendars = $this->rows('institutional_calendars', $tenantId, fn ($q) => $q->orderBy('name'));
        foreach ($calendars as &$calendar) {
            $calendar['days_count'] = DB::table('calendar_days')->where('institutional_calendar_id', $calendar['id'])->count();
            $calendar['days'] = DB::table('calendar_days')
                ->where('institutional_calendar_id', $calendar['id'])
                ->orderBy('date')
                ->limit(50)
                ->get()
                ->map(fn ($row) => $this->decodeRow((array) $row))
                ->all();
        }

        return $calendars;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function numberingSchemes(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $schemes = $this->rows('numbering_schemes', $tenantId, fn ($q) => $q->orderBy('scheme_key'));
        foreach ($schemes as &$scheme) {
            $scheme['sequences'] = DB::table('numbering_sequences')
                ->where('numbering_scheme_id', $scheme['id'])
                ->orderByDesc('period_key')
                ->limit(20)
                ->get()
                ->map(fn ($row) => $this->decodeRow((array) $row))
                ->all();
        }

        return $schemes;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function localisation(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $keys = $this->rows('localisation_keys', $tenantId, fn ($q) => $q->orderBy('module')->orderBy('translation_key')->limit(200));
        foreach ($keys as &$key) {
            $key['values'] = DB::table('localisation_values')
                ->where('localisation_key_id', $key['id'])
                ->orderBy('language')
                ->get()
                ->map(fn ($row) => $this->decodeRow((array) $row))
                ->all();
        }

        return $keys;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function integrations(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $integrations = $this->rows('integration_definitions', $tenantId, fn ($q) => $q->orderBy('name'));
        foreach ($integrations as &$integration) {
            $integration['secret_reference'] = $integration['secret_reference'] ? 'Protected: '.$integration['secret_reference'] : null;
            $integration['recent_health'] = DB::table('integration_health_events')
                ->where('integration_definition_id', $integration['id'])
                ->orderByDesc('detected_at')
                ->limit(10)
                ->get()
                ->map(fn ($row) => $this->decodeRow((array) $row))
                ->all();
        }

        return $integrations;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createFeatureFlag(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('feature_flags')->insertGetId([
            'tenant_id' => $tenantId,
            'flag_key' => $data['flag_key'],
            'description' => $data['description'] ?? null,
            'owner_id' => $data['owner_id'] ?? $actor->id,
            'flag_type' => $data['flag_type'] ?? 'release',
            'default_enabled' => (bool) ($data['default_enabled'] ?? false),
            'environment' => $data['environment'] ?? app()->environment(),
            'start_at' => $data['start_at'] ?? null,
            'end_at' => $data['end_at'] ?? null,
            'status' => 'draft',
            'configuration' => $this->json($data['configuration'] ?? []),
            'rollback_plan' => $data['rollback_plan'] ?? null,
            'created_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($data['targets'] ?? [] as $target) {
            DB::table('feature_flag_targets')->insert([
                'feature_flag_id' => $id,
                'target_type' => $target['target_type'],
                'target_value' => $target['target_value'],
                'metadata' => $this->json($target['metadata'] ?? []),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $flag = $this->row('feature_flags', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'feature_flag_created', 'FeatureFlag', $id, null, $flag);

        return $flag;
    }

    public function approveFeatureFlag(int $tenantId, int $id, User $actor): array
    {
        $flag = $this->row('feature_flags', $tenantId, $id);
        if ($this->requiresIndependentApproval($flag['flag_type'] ?? null, $flag['configuration'] ?? null)) {
            abort_if((int) $flag['created_by'] === $actor->id, 422, 'Approval required: requester cannot approve their own high-risk feature flag.');
        }

        return $this->transitionFeatureFlag($tenantId, $id, $actor, 'approved');
    }

    public function activateFeatureFlag(int $tenantId, int $id, User $actor): array
    {
        return $this->transitionFeatureFlag($tenantId, $id, $actor, 'active', ['activated_at' => now()]);
    }

    public function disableFeatureFlag(int $tenantId, int $id, User $actor): array
    {
        return $this->transitionFeatureFlag($tenantId, $id, $actor, 'disabled', ['retired_at' => now()]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function scheduledJobs(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);

        return $this->rows('scheduled_jobs', $tenantId, fn ($q) => $q->orderBy('job_key'));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function jobRuns(int $tenantId): array
    {
        return $this->rows('scheduled_job_runs', $tenantId, fn ($q) => $q->orderByDesc('id')->limit(100));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function runJob(int $tenantId, int $id, array $data, User $actor): array
    {
        $job = $this->row('scheduled_jobs', $tenantId, $id);
        if ($job['concurrency_policy'] === 'single_instance') {
            $running = DB::table('scheduled_job_runs')->where('tenant_id', $tenantId)->where('scheduled_job_id', $id)->whereIn('status', ['queued', 'running'])->exists();
            abort_if($running, 422, 'Active job: the job is already running and does not permit concurrent execution.');
        }

        $runId = DB::table('scheduled_job_runs')->insertGetId([
            'tenant_id' => $tenantId,
            'scheduled_job_id' => $id,
            'run_uuid' => (string) Str::uuid(),
            'trigger_type' => 'manual',
            'triggered_by' => $actor->id,
            'scheduled_at' => now(),
            'started_at' => now(),
            'completed_at' => now(),
            'status' => 'completed',
            'records_processed' => 0,
            'records_failed' => 0,
            'retry_count' => 0,
            'correlation_id' => (string) Str::uuid(),
            'output_reference' => 'manual-run-'.$id,
            'reason' => $data['reason'],
            'scope' => $this->json($data['scope'] ?? []),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('scheduled_jobs')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'last_run_at' => now(),
            'last_result' => 'completed',
            'updated_at' => now(),
        ]);

        $run = $this->row('scheduled_job_runs', $tenantId, $runId);
        $this->audit($tenantId, $actor, 'system.admin.action', 'scheduled_job_run_requested', 'ScheduledJobRun', $runId, null, $run, $data['reason'] ?? null);

        return $run;
    }

    /**
     * @return array<string, mixed>
     */
    public function queues(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);

        return [
            'snapshots' => $this->rows('queue_snapshots', $tenantId, fn ($q) => $q->orderBy('queue_key')->orderByDesc('captured_at')->limit(50)),
            'audit_outbox' => $this->auditOutboxSummary($tenantId),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function deadLetters(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);
        $local = $this->rows('dead_letter_records', $tenantId, fn ($q) => $q->orderByDesc('id')->limit(100));
        $audit = [];
        if (Schema::hasTable('audit_event_dead_letters')) {
            $audit = DB::table('audit_event_dead_letters')
                ->where('tenant_id', $tenantId)
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->map(fn ($row) => array_merge($this->decodeRow((array) $row), ['source_service' => 'audit-trail']))
                ->all();
        }

        return array_values(array_merge($local, $audit));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function resolveDeadLetter(int $tenantId, int $id, array $data, User $actor): array
    {
        $old = $this->row('dead_letter_records', $tenantId, $id);
        DB::table('dead_letter_records')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => $data['status'] ?? 'closed_accepted_exception',
            'resolution' => $this->json([
                'action' => $data['action'] ?? 'close_as_accepted_exception',
                'reason' => $data['reason'],
                'resolved_at' => now()->toIso8601String(),
            ]),
            'resolved_by' => $actor->id,
            'resolved_at' => now(),
            'updated_at' => now(),
        ]);
        $updated = $this->row('dead_letter_records', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'dead_letter_resolved', 'DeadLetterRecord', $id, $old, $updated, $data['reason'] ?? null);

        return $updated;
    }

    /**
     * @return array<string, mixed>
     */
    public function replayDeadLetter(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row('dead_letter_records', $tenantId, $id);
        abort_unless((bool) $old['replay_safe'], 422, 'Unsafe replay: this message cannot be replayed automatically because it may create a duplicate business consequence.');

        DB::table('dead_letter_records')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => 'replayed',
            'attempts' => ((int) $old['attempts']) + 1,
            'resolution' => $this->json(['action' => 'replayed', 'replayed_at' => now()->toIso8601String()]),
            'resolved_by' => $actor->id,
            'resolved_at' => now(),
            'updated_at' => now(),
        ]);
        $updated = $this->row('dead_letter_records', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'dead_letter_replayed', 'DeadLetterRecord', $id, $old, $updated);

        return $updated;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function systemHealth(int $tenantId): array
    {
        return array_values($this->platformStatus($tenantId)['services']);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createMaintenanceWindow(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('maintenance_windows')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('MTN'),
            'title' => $data['title'],
            'purpose' => $data['purpose'],
            'affected_services' => $this->json($data['affected_services'] ?? []),
            'planned_start' => $data['planned_start'],
            'planned_end' => $data['planned_end'],
            'expected_impact' => $data['expected_impact'] ?? null,
            'read_only_services' => $this->json($data['read_only_services'] ?? []),
            'unavailable_services' => $this->json($data['unavailable_services'] ?? []),
            'business_owner_id' => $data['business_owner_id'] ?? null,
            'technical_owner_id' => $data['technical_owner_id'] ?? $actor->id,
            'communication_plan' => $data['communication_plan'] ?? null,
            'rollback_plan' => $data['rollback_plan'] ?? null,
            'maintenance_mode' => $data['maintenance_mode'] ?? 'notice_only',
            'status' => 'proposed',
            'requested_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $row = $this->row('maintenance_windows', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'maintenance_window_created', 'MaintenanceWindow', $id, null, $row);

        return $row;
    }

    public function approveMaintenanceWindow(int $tenantId, int $id, User $actor): array
    {
        $window = $this->row('maintenance_windows', $tenantId, $id);
        abort_if((int) $window['requested_by'] === $actor->id, 422, 'Approval required: requester cannot approve their own maintenance window.');

        return $this->transitionMaintenance($tenantId, $id, $actor, 'approved', ['approved_by' => $actor->id, 'approved_at' => now()]);
    }

    public function startMaintenanceWindow(int $tenantId, int $id, User $actor): array
    {
        return $this->transitionMaintenance($tenantId, $id, $actor, 'active', ['actual_start' => now()]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function completeMaintenanceWindow(int $tenantId, int $id, array $data, User $actor): array
    {
        return $this->transitionMaintenance($tenantId, $id, $actor, 'completed', ['actual_end' => now(), 'outcome' => $data['outcome'] ?? null]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createSystemBanner(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('system_banners')->insertGetId([
            'tenant_id' => $tenantId,
            'banner_type' => $data['banner_type'],
            'priority' => $data['priority'] ?? 'normal',
            'audience' => $this->json($data['audience'] ?? ['all']),
            'language' => $data['language'] ?? 'en',
            'message' => $data['message'],
            'start_at' => $data['start_at'] ?? now(),
            'end_at' => $data['end_at'] ?? null,
            'dismissible' => (bool) ($data['dismissible'] ?? true),
            'acknowledgement_required' => (bool) ($data['acknowledgement_required'] ?? false),
            'secure_link' => $data['secure_link'] ?? null,
            'status' => 'active',
            'created_by' => $actor->id,
            'approved_by' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $row = $this->row('system_banners', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'system_banner_published', 'SystemBanner', $id, null, $row);

        return $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function dataQualityIssues(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);

        return $this->rows('data_quality_issues', $tenantId, fn ($q) => $q->orderByDesc('id')->limit(100));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createDataCorrection(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('data_correction_requests')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('DCR'),
            'module' => $data['module'],
            'subject_type' => $data['subject_type'],
            'subject_id' => (string) $data['subject_id'],
            'current_value_snapshot' => $this->json($data['current_value_snapshot'] ?? []),
            'proposed_change' => $this->json($data['proposed_change'] ?? []),
            'reason' => $data['reason'],
            'evidence_document_id' => $data['evidence_document_id'] ?? null,
            'business_owner_id' => $data['business_owner_id'] ?? null,
            'requested_by' => $actor->id,
            'execution_method' => $data['execution_method'] ?? null,
            'dry_run_result' => $this->json(['status' => 'not_run', 'note' => 'Execution is blocked until approval.']),
            'status' => 'requested',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $row = $this->row('data_correction_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'data_correction_requested', 'DataCorrectionRequest', $id, null, $row, $data['reason']);

        return $row;
    }

    public function approveDataCorrection(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row('data_correction_requests', $tenantId, $id);
        abort_if((int) $old['requested_by'] === $actor->id, 422, 'Approval required: requester cannot solely approve this data correction.');
        DB::table('data_correction_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'approved_by' => $actor->id,
            'technical_reviewer_id' => $actor->id,
            'status' => 'approved',
            'updated_at' => now(),
        ]);
        $updated = $this->row('data_correction_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'data_correction_approved', 'DataCorrectionRequest', $id, $old, $updated);

        return $updated;
    }

    public function executeDataCorrection(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row('data_correction_requests', $tenantId, $id);
        abort_unless($old['status'] === 'approved', 422, 'Approval required before a controlled correction can execute.');
        DB::table('data_correction_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'executed_by' => $actor->id,
            'executed_at' => now(),
            'verification_result' => $this->json([
                'status' => 'recorded_only',
                'note' => 'No arbitrary database write was performed by the Admin Console.',
            ]),
            'status' => 'executed',
            'updated_at' => now(),
        ]);
        $updated = $this->row('data_correction_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'data_correction_execution_recorded', 'DataCorrectionRequest', $id, $old, $updated);

        return $updated;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function backupStatus(int $tenantId): array
    {
        $this->ensureSeeded($tenantId);

        return $this->rows('backup_status_records', $tenantId, fn ($q) => $q->orderBy('backup_type'));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function requestRestore(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('restore_requests')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('RST'),
            'restore_type' => $data['restore_type'],
            'reason' => $data['reason'],
            'scope' => $this->json($data['scope'] ?? []),
            'target_environment' => $data['target_environment'],
            'requested_by' => $actor->id,
            'data_loss_impact' => $data['data_loss_impact'] ?? null,
            'security_review' => $data['security_review'] ?? null,
            'execution_owner_id' => $data['execution_owner_id'] ?? null,
            'status' => 'requested',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = $this->row('restore_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'restore_requested', 'RestoreRequest', $id, null, $row, $data['reason']);

        return $row;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function restoreRequests(int $tenantId): array
    {
        return $this->rows('restore_requests', $tenantId, fn ($q) => $q->orderByDesc('id')->limit(100));
    }

    public function approveRestore(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row('restore_requests', $tenantId, $id);
        abort_if((int) $old['requested_by'] === $actor->id, 422, 'Approval required: restore requester cannot approve their own recovery request.');
        abort_unless($old['status'] === 'requested', 422, 'Only requested restore operations can be approved.');

        DB::table('restore_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'approved_by' => $actor->id,
            'status' => 'approved',
            'updated_at' => now(),
        ]);

        $updated = $this->row('restore_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'restore_approved', 'RestoreRequest', $id, $old, $updated);

        return $updated;
    }

    /**
     * Record the controlled recovery hand-off and verification. The actual
     * infrastructure restore remains owned by the approved recovery process.
     *
     * @param  array<string, mixed>  $data
     */
    public function executeRestore(int $tenantId, int $id, array $data, User $actor): array
    {
        $old = $this->row('restore_requests', $tenantId, $id);
        abort_unless($old['status'] === 'approved', 422, 'Approval required before a restore operation can execute.');

        $verification = [
            'status' => $data['verification_status'] ?? 'recorded_for_recovery_procedure',
            'verified_by' => $actor->id,
            'verified_at' => now()->toIso8601String(),
            'notes' => $data['verification_notes'] ?? null,
            'execution_mode' => 'controlled_admin_record',
        ];

        DB::table('restore_requests')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'execution_owner_id' => $old['execution_owner_id'] ?: $actor->id,
            'verification' => $this->json($verification),
            'outcome' => $data['outcome'] ?? 'Execution handed to the approved recovery procedure.',
            'status' => ($data['verification_status'] ?? 'completed') === 'failed' ? 'failed' : 'completed',
            'updated_at' => now(),
        ]);

        $updated = $this->row('restore_requests', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'restore_execution_recorded', 'RestoreRequest', $id, $old, $updated, $data['outcome'] ?? null);

        return $updated;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function imports(int $tenantId): array
    {
        return $this->rows('import_jobs', $tenantId, fn ($q) => $q->orderByDesc('id')->limit(100));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function migrations(int $tenantId): array
    {
        return $this->rows('migration_register', $tenantId, fn ($q) => $q->orderByDesc('id')->limit(100));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createSupportSession(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('support_access_sessions')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('SUP'),
            'support_user_id' => $data['support_user_id'] ?? $actor->id,
            'ticket_reference' => $data['ticket_reference'],
            'reason' => $data['reason'],
            'scope' => $this->json($data['scope'] ?? []),
            'starts_at' => $data['starts_at'] ?? now(),
            'expires_at' => $data['expires_at'] ?? now()->addMinutes(60),
            'status' => 'requested',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $row = $this->row('support_access_sessions', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'support_session_requested', 'SupportAccessSession', $id, null, $row, $data['reason']);

        return $row;
    }

    public function approveSupportSession(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row('support_access_sessions', $tenantId, $id);
        abort_if((int) $old['support_user_id'] === $actor->id, 422, 'Approval required: support user cannot approve their own support session.');
        DB::table('support_access_sessions')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'status' => 'active',
            'updated_at' => now(),
        ]);
        $updated = $this->row('support_access_sessions', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'support_session_approved', 'SupportAccessSession', $id, $old, $updated);

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function closeSupportSession(int $tenantId, int $id, array $data, User $actor): array
    {
        $old = $this->row('support_access_sessions', $tenantId, $id);
        DB::table('support_access_sessions')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => 'closed',
            'closed_at' => now(),
            'post_session_review' => $this->json($data['post_session_review'] ?? ['closed_by' => $actor->id]),
            'updated_at' => now(),
        ]);
        $updated = $this->row('support_access_sessions', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'support_session_closed', 'SupportAccessSession', $id, $old, $updated);

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function requestBreakGlass(int $tenantId, array $data, User $actor): array
    {
        $id = DB::table('break_glass_sessions')->insertGetId([
            'tenant_id' => $tenantId,
            'reference' => $this->reference('BRK'),
            'user_id' => $actor->id,
            'incident_reference' => $data['incident_reference'],
            'reason' => $data['reason'],
            'requested_permissions' => $this->json($data['requested_permissions'] ?? []),
            'starts_at' => $data['starts_at'] ?? null,
            'expires_at' => $data['expires_at'] ?? now()->addMinutes(30),
            'status' => 'pending_approval',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $row = $this->row('break_glass_sessions', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'break_glass_requested', 'BreakGlassSession', $id, null, $row, $data['reason']);

        return $row;
    }

    public function approveBreakGlass(int $tenantId, int $id, User $actor): array
    {
        $old = $this->row('break_glass_sessions', $tenantId, $id);
        abort_if((int) $old['user_id'] === $actor->id, 422, 'Approval required: requester cannot approve their own break-glass access.');
        DB::table('break_glass_sessions')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => 'active',
            'approved_by' => $actor->id,
            'approved_at' => now(),
            'starts_at' => now(),
            'updated_at' => now(),
        ]);
        $updated = $this->row('break_glass_sessions', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'break_glass_approved', 'BreakGlassSession', $id, $old, $updated);

        return $updated;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function closeBreakGlass(int $tenantId, int $id, array $data, User $actor): array
    {
        $old = $this->row('break_glass_sessions', $tenantId, $id);
        DB::table('break_glass_sessions')->where('tenant_id', $tenantId)->where('id', $id)->update([
            'status' => 'closed',
            'closed_at' => now(),
            'post_use_review' => $this->json($data['post_use_review'] ?? ['closed_by' => $actor->id]),
            'updated_at' => now(),
        ]);
        $updated = $this->row('break_glass_sessions', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'break_glass_closed', 'BreakGlassSession', $id, $old, $updated);

        return $updated;
    }

    private function seedModules(int $tenantId): void
    {
        foreach ($this->moduleCatalogue() as $module) {
            DB::table('platform_modules')->updateOrInsert(
                ['tenant_id' => $tenantId, 'module_key' => $module['module_key']],
                [
                    'name' => $module['name'],
                    'description' => $module['description'],
                    'version' => $module['version'] ?? '1.0',
                    'status' => $module['status'] ?? 'active',
                    'availability' => $module['availability'] ?? 'operational',
                    'routes' => $this->json($module['routes'] ?? []),
                    'required_permissions' => $this->json($module['required_permissions'] ?? []),
                    'background_jobs' => $this->json($module['background_jobs'] ?? []),
                    'integration_events' => $this->json($module['integration_events'] ?? []),
                    'health_status' => $module['health_status'] ?? 'operational',
                    'release_version' => $module['release_version'] ?? null,
                    'feature_flags' => $this->json($module['feature_flags'] ?? []),
                    'metadata' => $this->json($module['metadata'] ?? []),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $ids = DB::table('platform_modules')->where('tenant_id', $tenantId)->pluck('id', 'module_key');
        foreach ($this->dependencyCatalogue() as $dep) {
            if (! isset($ids[$dep['source']], $ids[$dep['depends_on']])) {
                continue;
            }
            DB::table('module_dependencies')->updateOrInsert(
                [
                    'tenant_id' => $tenantId,
                    'source_module_id' => $ids[$dep['source']],
                    'depends_on_key' => $dep['depends_on'],
                ],
                [
                    'depends_on_module_id' => $ids[$dep['depends_on']],
                    'dependency_type' => $dep['dependency_type'] ?? 'shared_service',
                    'criticality' => $dep['criticality'] ?? 'medium',
                    'description' => $dep['description'] ?? null,
                    'metadata' => $this->json([]),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function seedConfiguration(int $tenantId): void
    {
        foreach ($this->configurationCatalogue() as $definition) {
            DB::table('configuration_definitions')->updateOrInsert(
                ['tenant_id' => $tenantId, 'config_key' => $definition['config_key']],
                [
                    'domain' => $definition['domain'],
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'data_type' => $definition['data_type'],
                    'allowed_values' => $this->json($definition['allowed_values'] ?? null),
                    'default_value' => $this->json(['value' => $definition['default_value'] ?? null]),
                    'environment_scope' => $definition['environment_scope'] ?? 'tenant',
                    'organisational_scope' => $definition['organisational_scope'] ?? null,
                    'sensitivity' => $definition['sensitivity'] ?? 'operational',
                    'change_authority' => $definition['change_authority'] ?? null,
                    'validation_rule' => $this->json($definition['validation_rule'] ?? []),
                    'restart_required' => (bool) ($definition['restart_required'] ?? false),
                    'rollback_supported' => (bool) ($definition['rollback_supported'] ?? true),
                    'status' => 'active',
                    'metadata' => $this->json([]),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $defs = DB::table('configuration_definitions')->where('tenant_id', $tenantId)->get();
        foreach ($defs as $def) {
            $exists = DB::table('configuration_versions')->where('tenant_id', $tenantId)->where('configuration_definition_id', $def->id)->exists();
            if ($exists) {
                continue;
            }
            $value = json_decode($def->default_value ?: 'null', true);
            DB::table('configuration_versions')->insert([
                'tenant_id' => $tenantId,
                'configuration_definition_id' => $def->id,
                'version' => 1,
                'value' => $this->json($value),
                'value_hash' => $this->hashValue($value),
                'schema_version' => 1,
                'effective_from' => now(),
                'activation_status' => 'active',
                'change_reference' => 'SEED',
                'activated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function seedReferenceData(int $tenantId): void
    {
        foreach ($this->referenceSetCatalogue() as $set) {
            DB::table('reference_data_sets')->updateOrInsert(
                ['tenant_id' => $tenantId, 'set_key' => $set['set_key']],
                [
                    'name' => $set['name'],
                    'description' => $set['description'],
                    'domain' => $set['domain'],
                    'hierarchical' => (bool) ($set['hierarchical'] ?? false),
                    'multilingual' => true,
                    'effective_dated' => true,
                    'extensible' => true,
                    'status' => 'active',
                    'metadata' => $this->json([]),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $setIds = DB::table('reference_data_sets')->where('tenant_id', $tenantId)->pluck('id', 'set_key');
        foreach ($this->referenceItemCatalogue() as $setKey => $items) {
            if (! isset($setIds[$setKey])) {
                continue;
            }
            foreach ($items as $index => $item) {
                DB::table('reference_data_items')->updateOrInsert(
                    ['reference_data_set_id' => $setIds[$setKey], 'code' => $item['code']],
                    [
                        'tenant_id' => $tenantId,
                        'uuid' => $item['uuid'] ?? (string) Str::uuid(),
                        'label_en' => $item['label_en'],
                        'label_fr' => $item['label_fr'] ?? $item['label_en'],
                        'label_pt' => $item['label_pt'] ?? $item['label_en'],
                        'sequence' => $index + 1,
                        'effective_from' => now(),
                        'status' => 'active',
                        'metadata' => $this->json([]),
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }
        }
    }

    private function seedFeatureFlags(int $tenantId): void
    {
        foreach ($this->featureFlagCatalogue() as $flag) {
            DB::table('feature_flags')->updateOrInsert(
                ['tenant_id' => $tenantId, 'flag_key' => $flag['flag_key'], 'environment' => $flag['environment']],
                [
                    'description' => $flag['description'],
                    'flag_type' => $flag['flag_type'],
                    'default_enabled' => (bool) $flag['default_enabled'],
                    'status' => $flag['status'],
                    'configuration' => $this->json($flag['configuration'] ?? []),
                    'rollback_plan' => $flag['rollback_plan'] ?? null,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function seedCalendarsAndNumbering(int $tenantId): void
    {
        DB::table('institutional_calendars')->updateOrInsert(
            ['tenant_id' => $tenantId, 'calendar_key' => 'sadc-pf-hq'],
            [
                'name' => 'SADC PF Headquarters Calendar',
                'duty_station' => 'Windhoek',
                'timezone' => 'Africa/Windhoek',
                'working_days' => $this->json(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
                'working_hours' => $this->json(['start' => '08:00', 'end' => '17:00']),
                'effective_year' => (int) now()->format('Y'),
                'source_authority' => 'Admin Console Seed',
                'status' => 'active',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        foreach ($this->numberingCatalogue() as $scheme) {
            DB::table('numbering_schemes')->updateOrInsert(
                ['tenant_id' => $tenantId, 'scheme_key' => $scheme['scheme_key']],
                [
                    'name' => $scheme['name'],
                    'prefix' => $scheme['prefix'],
                    'year_component' => 'yyyy',
                    'sequence_length' => 5,
                    'reset_rule' => 'yearly',
                    'separator' => '-',
                    'example' => $scheme['prefix'].'-'.now()->format('Y').'-00001',
                    'effective_from' => now(),
                    'status' => 'active',
                    'metadata' => $this->json([]),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function seedLocalisation(int $tenantId): void
    {
        $keys = [
            ['translation_key' => 'admin.console.title', 'module' => 'admin-console', 'text_en' => 'Admin Console'],
            ['translation_key' => 'admin.console.status.operational', 'module' => 'admin-console', 'text_en' => 'Operational'],
        ];

        foreach ($keys as $row) {
            DB::table('localisation_keys')->updateOrInsert(
                ['tenant_id' => $tenantId, 'translation_key' => $row['translation_key']],
                [
                    'module' => $row['module'],
                    'text_en' => $row['text_en'],
                    'status' => 'active',
                    'version' => 1,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function seedIntegrationsAndJobs(int $tenantId): void
    {
        foreach ($this->integrationCatalogue() as $integration) {
            DB::table('integration_definitions')->updateOrInsert(
                ['tenant_id' => $tenantId, 'integration_key' => $integration['integration_key']],
                [
                    'name' => $integration['name'],
                    'system_name' => $integration['system_name'],
                    'purpose' => $integration['purpose'],
                    'direction' => $integration['direction'],
                    'data_classes' => $this->json($integration['data_classes']),
                    'authentication_type' => $integration['authentication_type'],
                    'environment' => app()->environment(),
                    'endpoint_reference' => $integration['endpoint_reference'],
                    'status' => $integration['status'],
                    'retry_policy' => $this->json(['max_attempts' => 3, 'backoff' => 'exponential']),
                    'service_account' => $integration['service_account'] ?? null,
                    'secret_reference' => $integration['secret_reference'] ?? null,
                    'metadata' => $this->json([]),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        foreach ($this->jobCatalogue() as $job) {
            DB::table('scheduled_jobs')->updateOrInsert(
                ['tenant_id' => $tenantId, 'job_key' => $job['job_key']],
                [
                    'name' => $job['name'],
                    'description' => $job['description'],
                    'owner' => $job['owner'],
                    'schedule' => $job['schedule'],
                    'timezone' => 'Africa/Windhoek',
                    'enabled' => true,
                    'concurrency_policy' => $job['concurrency_policy'] ?? 'single_instance',
                    'retry_policy' => $this->json(['max_attempts' => 3]),
                    'timeout_seconds' => $job['timeout_seconds'] ?? 300,
                    'dependencies' => $this->json($job['dependencies'] ?? []),
                    'criticality' => $job['criticality'],
                    'status' => 'active',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        foreach (['audit-events', 'notifications', 'documents', 'search-index', 'reports'] as $queue) {
            DB::table('queue_snapshots')->updateOrInsert(
                ['tenant_id' => $tenantId, 'queue_key' => $queue],
                [
                    'queue_depth' => 0,
                    'worker_status' => 'unknown',
                    'retry_count' => 0,
                    'captured_at' => now(),
                    'metadata' => $this->json(['source' => 'admin-console-seed']),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    private function seedDataQualityAndBackup(int $tenantId): void
    {
        foreach ($this->dataQualityRuleCatalogue() as $rule) {
            DB::table('data_quality_rules')->updateOrInsert(
                ['tenant_id' => $tenantId, 'rule_key' => $rule['rule_key']],
                [
                    'module' => $rule['module'],
                    'name' => $rule['name'],
                    'description' => $rule['description'],
                    'severity' => $rule['severity'],
                    'enabled' => true,
                    'version' => 1,
                    'definition' => $this->json($rule['definition'] ?? []),
                    'status' => 'active',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        foreach (['database', 'documents', 'offsite-immutable'] as $backupType) {
            DB::table('backup_status_records')->updateOrInsert(
                ['tenant_id' => $tenantId, 'backup_type' => $backupType],
                [
                    'status' => 'unknown',
                    'recovery_point_status' => 'not_verified',
                    'capacity' => $this->json([]),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function moduleCatalogue(): array
    {
        return [
            ['module_key' => 'admin-console', 'name' => 'Admin Console', 'description' => 'Controlled platform administration and operational control.', 'routes' => ['/admin'], 'required_permissions' => ['admin-console.view']],
            ['module_key' => 'access-control', 'name' => 'Roles and Permissions', 'description' => 'Deny-by-default roles, permissions, scopes, SoD, and access reviews.', 'routes' => ['/admin/access'], 'required_permissions' => ['admin.roles.view']],
            ['module_key' => 'platform-audit', 'name' => 'Platform Audit Trail', 'description' => 'Immutable audit evidence, integrity checks, alerts, and forensics.', 'routes' => ['/admin/audit-trail'], 'required_permissions' => ['audit-trail.search']],
            ['module_key' => 'workflow-engine', 'name' => 'Workflow Engine', 'description' => 'Definition versions, routing, decisions, delegation and workflow history.', 'routes' => ['/admin/workflows'], 'required_permissions' => ['workflows.admin']],
            ['module_key' => 'notifications', 'name' => 'Notifications', 'description' => 'Templates, delivery, broadcasts, maintenance alerts and preferences.', 'routes' => ['/admin/notifications'], 'required_permissions' => ['notifications.admin']],
            ['module_key' => 'documents', 'name' => 'Document Repository', 'description' => 'Document versions, classification, retention and file access.', 'routes' => ['/admin/documents'], 'required_permissions' => ['documents.admin']],
            ['module_key' => 'pif', 'name' => 'Programme Implementation Form', 'description' => 'Programme requests, finance review and SG approval workflow.', 'routes' => ['/pif'], 'required_permissions' => ['pif.view']],
            ['module_key' => 'procurement', 'name' => 'Procurement', 'description' => 'Procurement requests, RFQs, suppliers, bids and awards.', 'routes' => ['/procurement'], 'required_permissions' => ['procurement.view']],
            ['module_key' => 'mande', 'name' => 'Monitoring and Evaluation', 'description' => 'Strategic plans, indicators, activity reports and evidence.', 'routes' => ['/mande'], 'required_permissions' => ['mande.view']],
            ['module_key' => 'travel', 'name' => 'Travel', 'description' => 'Travel requisitions, DSA, logistics and travel accountability.', 'routes' => ['/travel'], 'required_permissions' => ['travel.view']],
            ['module_key' => 'leave', 'name' => 'Leave', 'description' => 'Leave requests, calendars and leave balances.', 'routes' => ['/leave'], 'required_permissions' => ['leave.view']],
            ['module_key' => 'hr', 'name' => 'Human Resources', 'description' => 'Employee profiles, performance, files, timesheets and HR settings.', 'routes' => ['/hr', '/settings/hr'], 'required_permissions' => ['hr.view']],
            ['module_key' => 'finance', 'name' => 'Finance', 'description' => 'Budgets, salary advances and finance controls.', 'routes' => ['/finance', '/salary-advances'], 'required_permissions' => ['finance.view']],
            ['module_key' => 'risk', 'name' => 'Risk Register', 'description' => 'Risk records, controls, KRI, BCP and policy evidence.', 'routes' => ['/risk'], 'required_permissions' => ['risk.view']],
            ['module_key' => 'assignments', 'name' => 'Assignments', 'description' => 'Work assignment tracking and accountability.', 'routes' => ['/assignments'], 'required_permissions' => ['assignments.view']],
            ['module_key' => 'correspondence', 'name' => 'Correspondence', 'description' => 'Registry, routing, retention and dispatch.', 'routes' => ['/correspondence'], 'required_permissions' => ['correspondence.view']],
            ['module_key' => 'reports', 'name' => 'Reports', 'description' => 'Permission-aware reports, exports and management information.', 'routes' => ['/reports'], 'required_permissions' => ['reports.view']],
        ];
    }

    /**
     * @return list<array<string, string>>
     */
    private function dependencyCatalogue(): array
    {
        return [
            ['source' => 'pif', 'depends_on' => 'workflow-engine', 'criticality' => 'critical'],
            ['source' => 'pif', 'depends_on' => 'documents', 'criticality' => 'critical'],
            ['source' => 'pif', 'depends_on' => 'notifications', 'criticality' => 'high'],
            ['source' => 'pif', 'depends_on' => 'procurement', 'criticality' => 'medium'],
            ['source' => 'pif', 'depends_on' => 'mande', 'criticality' => 'medium'],
            ['source' => 'travel', 'depends_on' => 'finance', 'criticality' => 'high'],
            ['source' => 'risk', 'depends_on' => 'assignments', 'criticality' => 'medium'],
            ['source' => 'platform-audit', 'depends_on' => 'notifications', 'criticality' => 'medium'],
            ['source' => 'admin-console', 'depends_on' => 'platform-audit', 'criticality' => 'critical'],
            ['source' => 'admin-console', 'depends_on' => 'access-control', 'criticality' => 'critical'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function configurationCatalogue(): array
    {
        return [
            ['config_key' => 'platform.default_timezone', 'domain' => 'platform', 'name' => 'Default timezone', 'description' => 'Default platform timezone for administrative display.', 'data_type' => 'text', 'default_value' => 'Africa/Windhoek', 'allowed_values' => ['Africa/Windhoek', 'UTC'], 'sensitivity' => 'operational'],
            ['config_key' => 'platform.maintenance_mode', 'domain' => 'maintenance', 'name' => 'Maintenance mode', 'description' => 'Server-side maintenance mode state.', 'data_type' => 'controlled_selection', 'default_value' => 'off', 'allowed_values' => ['off', 'notice_only', 'read_only', 'selected_module_disabled', 'full_platform_maintenance', 'emergency_lockdown'], 'sensitivity' => 'system_critical'],
            ['config_key' => 'security.break_glass.default_minutes', 'domain' => 'security', 'name' => 'Break-glass default duration', 'description' => 'Default emergency access duration in minutes.', 'data_type' => 'integer', 'default_value' => 30, 'sensitivity' => 'security_critical'],
            ['config_key' => 'notifications.maintenance_notice_hours', 'domain' => 'notifications', 'name' => 'Maintenance notice lead time', 'description' => 'Minimum lead time for planned maintenance notifications.', 'data_type' => 'integer', 'default_value' => 48, 'sensitivity' => 'operational'],
            ['config_key' => 'localisation.enabled_languages', 'domain' => 'localisation', 'name' => 'Enabled languages', 'description' => 'Primary languages enabled for Nexus UI and templates.', 'data_type' => 'structured', 'default_value' => ['en', 'fr', 'pt'], 'sensitivity' => 'operational'],
            ['config_key' => 'audit.reconciliation.stale_outbox_minutes', 'domain' => 'audit', 'name' => 'Audit stale outbox threshold', 'description' => 'Threshold used by audit reconciliation to flag delayed events.', 'data_type' => 'integer', 'default_value' => 15, 'sensitivity' => 'security_critical'],
        ];
    }

    /**
     * @return list<array<string, string>>
     */
    private function referenceSetCatalogue(): array
    {
        return [
            ['set_key' => 'currencies', 'name' => 'Currencies', 'description' => 'Currency codes used by finance, travel and procurement.', 'domain' => 'finance'],
            ['set_key' => 'languages', 'name' => 'Languages', 'description' => 'Supported interface and document languages.', 'domain' => 'localisation'],
            ['set_key' => 'travel_classes', 'name' => 'Travel Classes', 'description' => 'Controlled travel class values.', 'domain' => 'travel'],
            ['set_key' => 'procurement_categories', 'name' => 'Procurement Categories', 'description' => 'Procurement category code list.', 'domain' => 'procurement'],
            ['set_key' => 'risk_categories', 'name' => 'Risk Categories', 'description' => 'Risk taxonomy categories.', 'domain' => 'risk'],
        ];
    }

    /**
     * @return array<string, list<array<string, string>>>
     */
    private function referenceItemCatalogue(): array
    {
        return [
            'currencies' => [
                ['code' => 'NAD', 'label_en' => 'Namibian Dollar', 'label_fr' => 'Dollar namibien', 'label_pt' => 'Dolar namibiano'],
                ['code' => 'USD', 'label_en' => 'US Dollar', 'label_fr' => 'Dollar des Etats-Unis', 'label_pt' => 'Dolar dos EUA'],
                ['code' => 'EUR', 'label_en' => 'Euro', 'label_fr' => 'Euro', 'label_pt' => 'Euro'],
            ],
            'languages' => [
                ['code' => 'en', 'label_en' => 'English', 'label_fr' => 'Anglais', 'label_pt' => 'Ingles'],
                ['code' => 'fr', 'label_en' => 'French', 'label_fr' => 'Francais', 'label_pt' => 'Frances'],
                ['code' => 'pt', 'label_en' => 'Portuguese', 'label_fr' => 'Portugais', 'label_pt' => 'Portugues'],
            ],
            'travel_classes' => [
                ['code' => 'ECONOMY', 'label_en' => 'Economy'],
                ['code' => 'BUSINESS', 'label_en' => 'Business'],
            ],
            'procurement_categories' => [
                ['code' => 'GOODS', 'label_en' => 'Goods'],
                ['code' => 'SERVICES', 'label_en' => 'Services'],
                ['code' => 'WORKS', 'label_en' => 'Works'],
            ],
            'risk_categories' => [
                ['code' => 'STRATEGIC', 'label_en' => 'Strategic'],
                ['code' => 'OPERATIONAL', 'label_en' => 'Operational'],
                ['code' => 'FINANCIAL', 'label_en' => 'Financial'],
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function featureFlagCatalogue(): array
    {
        return [
            ['flag_key' => 'admin-console.phase1', 'description' => 'Admin Console Phase 1 operational control surfaces.', 'flag_type' => 'release', 'default_enabled' => true, 'environment' => app()->environment(), 'status' => 'active'],
            ['flag_key' => 'maintenance.read_only_enforcement', 'description' => 'Server-side maintenance read-only enforcement switch.', 'flag_type' => 'emergency_kill_switch', 'default_enabled' => false, 'environment' => app()->environment(), 'status' => 'approved'],
        ];
    }

    /**
     * @return list<array<string, string>>
     */
    private function numberingCatalogue(): array
    {
        return [
            ['scheme_key' => 'pif', 'name' => 'PIF Reference', 'prefix' => 'PIF'],
            ['scheme_key' => 'travel', 'name' => 'Travel Reference', 'prefix' => 'TRV'],
            ['scheme_key' => 'procurement', 'name' => 'Procurement Reference', 'prefix' => 'PRC'],
            ['scheme_key' => 'correspondence', 'name' => 'Correspondence Reference', 'prefix' => 'COR'],
            ['scheme_key' => 'risk', 'name' => 'Risk Reference', 'prefix' => 'RSK'],
            ['scheme_key' => 'audit', 'name' => 'Audit Reference', 'prefix' => 'AUD'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function integrationCatalogue(): array
    {
        return [
            ['integration_key' => 'notification-delivery', 'name' => 'Notification Delivery', 'system_name' => 'Mail / Push Providers', 'purpose' => 'Send governed notifications.', 'direction' => 'outbound', 'data_classes' => ['internal'], 'authentication_type' => 'secret_reference', 'endpoint_reference' => 'secret://notifications/provider', 'status' => 'unknown'],
            ['integration_key' => 'object-storage', 'name' => 'Object Storage', 'system_name' => 'Document Storage', 'purpose' => 'Store and retrieve controlled documents.', 'direction' => 'internal', 'data_classes' => ['confidential', 'restricted'], 'authentication_type' => 'service_identity', 'endpoint_reference' => 'storage://documents', 'status' => 'unknown'],
            ['integration_key' => 'search-index', 'name' => 'Search Index', 'system_name' => 'Search Service', 'purpose' => 'Index permission-filtered records.', 'direction' => 'internal', 'data_classes' => ['internal'], 'authentication_type' => 'service_identity', 'endpoint_reference' => 'search://default', 'status' => 'unknown'],
            ['integration_key' => 'audit-ingestion', 'name' => 'Audit Ingestion', 'system_name' => 'Platform Audit Trail', 'purpose' => 'Append immutable audit events.', 'direction' => 'internal', 'data_classes' => ['audit'], 'authentication_type' => 'service_identity', 'endpoint_reference' => '/api/v1/audit-events', 'status' => 'healthy'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function jobCatalogue(): array
    {
        return [
            ['job_key' => 'audit.reconciliation', 'name' => 'Audit Reconciliation', 'description' => 'Detect missing audit events and outbox exceptions.', 'owner' => 'Audit Trail Administrator', 'schedule' => 'hourly', 'criticality' => 'security_critical'],
            ['job_key' => 'notifications.maintenance', 'name' => 'Maintenance Notification Revalidation', 'description' => 'Revalidate maintenance notification state.', 'owner' => 'Notification Administrator', 'schedule' => 'hourly', 'criticality' => 'operational'],
            ['job_key' => 'search.reindex', 'name' => 'Search Reindex', 'description' => 'Repair search projection mismatches.', 'owner' => 'Technical Administrator', 'schedule' => 'on_demand', 'criticality' => 'operational'],
            ['job_key' => 'backup.verify', 'name' => 'Backup Verification', 'description' => 'Record latest backup verification evidence.', 'owner' => 'Technical Administrator', 'schedule' => 'daily', 'criticality' => 'system_critical'],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function dataQualityRuleCatalogue(): array
    {
        return [
            ['rule_key' => 'audit.missing_events', 'module' => 'platform-audit', 'name' => 'Missing audit events', 'description' => 'Detect unprocessed outbox and missing-event exceptions.', 'severity' => 'critical'],
            ['rule_key' => 'reference.owner_missing', 'module' => 'admin-console', 'name' => 'Reference data owner missing', 'description' => 'Reference data set lacks business owner.', 'severity' => 'medium'],
            ['rule_key' => 'localisation.missing_translations', 'module' => 'localisation', 'name' => 'Missing translations', 'description' => 'Translation key lacks French or Portuguese values.', 'severity' => 'medium'],
        ];
    }

    private function activeConfigurationVersion(int $tenantId, int $definitionId): ?array
    {
        $row = DB::table('configuration_versions')
            ->where('tenant_id', $tenantId)
            ->where('configuration_definition_id', $definitionId)
            ->where('activation_status', 'active')
            ->whereNull('effective_to')
            ->orderByDesc('version')
            ->first();

        return $row ? $this->decodeRow((array) $row) : null;
    }

    private function previousConfigurationVersion(int $tenantId, int $definitionId): ?array
    {
        $row = DB::table('configuration_versions')
            ->where('tenant_id', $tenantId)
            ->where('configuration_definition_id', $definitionId)
            ->where('activation_status', 'superseded')
            ->orderByDesc('version')
            ->first();

        return $row ? $this->decodeRow((array) $row) : null;
    }

    private function normaliseConfigValue(mixed $value, array $definition): array
    {
        $type = $definition['data_type'];
        if ($type === 'integer') {
            $value = (int) $value;
        } elseif ($type === 'decimal') {
            $value = (float) $value;
        } elseif ($type === 'boolean') {
            $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
        }

        return ['value' => $value];
    }

    private function requiresFourEyes(array $definition, array $change): bool
    {
        return in_array($definition['sensitivity'], ['business_critical', 'financial_critical', 'security_critical', 'privacy_critical', 'system_critical'], true)
            || in_array($change['risk_assessment'], ['business_critical', 'financial_critical', 'security_critical', 'privacy_critical', 'system_critical'], true);
    }

    /**
     * @return list<string>
     */
    private function affectedModulesForConfig(int $tenantId, string $domain): array
    {
        return DB::table('platform_modules')
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($domain) {
                $q->where('module_key', $domain)
                    ->orWhere('description', 'like', '%'.$domain.'%');
            })
            ->pluck('module_key')
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function dependencyWarnings(int $tenantId, array $definition): array
    {
        return DB::table('module_dependencies')
            ->join('platform_modules as source', 'source.id', '=', 'module_dependencies.source_module_id')
            ->where('module_dependencies.tenant_id', $tenantId)
            ->where(function ($q) use ($definition) {
                $q->where('source.module_key', $definition['domain'])
                    ->orWhere('module_dependencies.depends_on_key', $definition['domain']);
            })
            ->select('source.module_key', 'module_dependencies.depends_on_key', 'module_dependencies.criticality')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function snapshotReferenceItem(int $id, array $item, User $actor): void
    {
        DB::table('reference_data_item_versions')->insert([
            'reference_data_item_id' => $id,
            'version' => $item['version'],
            'snapshot' => $this->json($item),
            'changed_by' => $actor->id,
            'changed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function referenceDependencyAnalysis(array $item): array
    {
        return [
            'used_records' => 0,
            'active_workflows' => 0,
            'replacement_required' => true,
            'note' => 'Cross-module dependency counts require module-specific adapters before enforcement.',
            'item_uuid' => $item['uuid'] ?? null,
        ];
    }

    private function transitionFeatureFlag(int $tenantId, int $id, User $actor, string $status, array $extra = []): array
    {
        $old = $this->row('feature_flags', $tenantId, $id);
        abort_if($status === 'active' && ! in_array($old['status'], ['approved', 'scheduled', 'paused', 'active'], true), 422, 'Approval required before feature flag activation.');

        $updates = array_merge($extra, [
            'status' => $status,
            'updated_at' => now(),
        ]);
        if ($status === 'approved') {
            $updates['approved_by'] = $actor->id;
        }
        DB::table('feature_flags')->where('tenant_id', $tenantId)->where('id', $id)->update($updates);

        $updated = $this->row('feature_flags', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'feature_flag_'.$status, 'FeatureFlag', $id, $old, $updated);

        return $updated;
    }

    private function transitionMaintenance(int $tenantId, int $id, User $actor, string $status, array $extra = []): array
    {
        $old = $this->row('maintenance_windows', $tenantId, $id);
        if ($status === 'active') {
            abort_unless(in_array($old['status'], ['approved', 'active'], true), 422, 'Approval required before maintenance can start.');
        }
        DB::table('maintenance_windows')->where('tenant_id', $tenantId)->where('id', $id)->update(array_merge($extra, [
            'status' => $status,
            'updated_at' => now(),
        ]));
        $updated = $this->row('maintenance_windows', $tenantId, $id);
        $this->audit($tenantId, $actor, 'system.admin.action', 'maintenance_'.$status, 'MaintenanceWindow', $id, $old, $updated);

        return $updated;
    }

    private function requiresIndependentApproval(?string $flagType, mixed $configuration): bool
    {
        if (in_array((string) $flagType, ['emergency_kill_switch', 'permission_gated', 'module', 'integration'], true)) {
            return true;
        }

        $config = is_array($configuration) ? $configuration : [];

        return in_array(strtolower((string) ($config['risk_level'] ?? '')), ['high', 'critical', 'financial_critical', 'security_critical'], true);
    }

    private function count(string $table, int $tenantId, array $where = []): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }
        $q = DB::table($table)->where('tenant_id', $tenantId);
        foreach ($where as $column => $value) {
            $q->where($column, $value);
        }

        return $q->count();
    }

    private function openDeadLetterCount(int $tenantId): int
    {
        $count = $this->count('dead_letter_records', $tenantId, ['status' => 'open']);
        if (Schema::hasTable('audit_event_dead_letters')) {
            $count += DB::table('audit_event_dead_letters')->where('tenant_id', $tenantId)->where('status', 'open')->count();
        }

        return $count;
    }

    /**
     * @param  callable(\Illuminate\Database\Query\Builder): void|null  $callback
     * @return list<array<string, mixed>>
     */
    private function rows(string $table, int $tenantId, ?callable $callback = null): array
    {
        if (! Schema::hasTable($table)) {
            return [];
        }
        $query = DB::table($table)->where('tenant_id', $tenantId);
        if ($callback) {
            $callback($query);
        }

        return $query->get()->map(fn ($row) => $this->decodeRow((array) $row))->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function row(string $table, int $tenantId, int $id): array
    {
        $row = DB::table($table)->where('tenant_id', $tenantId)->where('id', $id)->first();
        abort_if(! $row, 404);

        return $this->decodeRow((array) $row);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function decodeRow(array $row): array
    {
        foreach (self::JSON_COLUMNS as $column) {
            if (! array_key_exists($column, $row) || $row[$column] === null || is_array($row[$column])) {
                continue;
            }
            $decoded = json_decode((string) $row[$column], true);
            $row[$column] = json_last_error() === JSON_ERROR_NONE ? $decoded : $row[$column];
        }

        return $row;
    }

    private function json(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function hashValue(mixed $value): string
    {
        return hash('sha256', $this->json($value) ?? 'null');
    }

    private function reference(string $prefix): string
    {
        return $prefix.'-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
    }

    private function availabilityForModuleStatus(string $status): string
    {
        return match ($status) {
            'degraded' => 'degraded',
            'temporarily_disabled' => 'partial_outage',
            'read_only' => 'degraded',
            'retired', 'archived' => 'maintenance',
            default => 'operational',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function serviceStatus(string $name, string $status, array $meta = []): array
    {
        return ['name' => $name, 'status' => $status, 'meta' => $meta];
    }

    /**
     * @return array<string, mixed>
     */
    private function moduleServiceStatus(int $tenantId, string $key, string $name): array
    {
        $module = DB::table('platform_modules')->where('tenant_id', $tenantId)->where('module_key', $key)->first();
        if (! $module) {
            return $this->serviceStatus($name, 'unknown');
        }

        return $this->serviceStatus($name, $this->normaliseServiceStatus($module->health_status), [
            'module_status' => $module->status,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function integrationServiceStatus(int $tenantId, string $key, string $name): array
    {
        $integration = DB::table('integration_definitions')->where('tenant_id', $tenantId)->where('integration_key', $key)->first();
        if (! $integration) {
            return $this->serviceStatus($name, 'unknown');
        }

        return $this->serviceStatus($name, $this->normaliseServiceStatus($integration->status), [
            'last_success_at' => $integration->last_success_at,
            'last_failure_at' => $integration->last_failure_at,
            'credential_expires_at' => $integration->credential_expires_at,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function integrationAggregateStatus(int $tenantId): array
    {
        $failing = DB::table('integration_definitions')->where('tenant_id', $tenantId)->whereIn('status', ['failing', 'authentication_expired'])->count();
        $unknown = DB::table('integration_definitions')->where('tenant_id', $tenantId)->where('status', 'unknown')->count();

        return $this->serviceStatus('Integrations', $failing > 0 ? 'degraded' : ($unknown > 0 ? 'unknown' : 'operational'), [
            'failing' => $failing,
            'unknown' => $unknown,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function jobAggregateStatus(int $tenantId): array
    {
        $failed = DB::table('scheduled_job_runs')->where('tenant_id', $tenantId)->where('status', 'failed')->count();

        return $this->serviceStatus('Background Jobs', $failed > 0 ? 'degraded' : 'operational', [
            'failed_runs' => $failed,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditTrailStatus(int $tenantId): array
    {
        $summary = $this->auditOutboxSummary($tenantId);
        $status = ($summary['failed_outbox'] ?? 0) > 0 || ($summary['open_dead_letters'] ?? 0) > 0
            ? 'degraded'
            : 'operational';

        return $this->serviceStatus('Audit Trail', $status, $summary);
    }

    /**
     * @return array<string, mixed>
     */
    private function backupAggregateStatus(int $tenantId): array
    {
        $unknown = DB::table('backup_status_records')->where('tenant_id', $tenantId)->where('status', 'unknown')->count();
        $failed = DB::table('backup_status_records')->where('tenant_id', $tenantId)->where('status', 'failed')->count();

        return $this->serviceStatus('Backups', $failed > 0 ? 'degraded' : ($unknown > 0 ? 'unknown' : 'operational'), [
            'unknown' => $unknown,
            'failed' => $failed,
        ]);
    }

    /**
     * @return array<string, int>
     */
    private function auditOutboxSummary(int $tenantId): array
    {
        if (! Schema::hasTable('audit_event_outbox')) {
            return ['pending_outbox' => 0, 'failed_outbox' => 0, 'open_dead_letters' => 0];
        }

        return [
            'pending_outbox' => DB::table('audit_event_outbox')->where('tenant_id', $tenantId)->where('status', 'pending')->count(),
            'failed_outbox' => DB::table('audit_event_outbox')->where('tenant_id', $tenantId)->whereIn('status', ['failed', 'dead_lettered'])->count(),
            'open_dead_letters' => Schema::hasTable('audit_event_dead_letters')
                ? DB::table('audit_event_dead_letters')->where('tenant_id', $tenantId)->where('status', 'open')->count()
                : 0,
        ];
    }

    private function normaliseServiceStatus(?string $status): string
    {
        return match ($status) {
            'healthy', 'active' => 'operational',
            'failing', 'authentication_expired' => 'degraded',
            'disabled' => 'maintenance',
            null => 'unknown',
            default => $status,
        };
    }

    private function audit(int $tenantId, User $actor, string $eventKey, string $action, string $subjectType, int|string|null $subjectId, mixed $old = null, mixed $new = null, ?string $reason = null): void
    {
        if (! Schema::hasTable('audit_events')) {
            return;
        }

        try {
            app(AuditEventIngestionService::class)->ingest([
                'tenant_id' => $tenantId,
                'event_key' => $eventKey,
                'actor_id' => $actor->id,
                'actor_type' => 'human',
                'outcome' => 'success',
                'source_module' => 'admin-console',
                'subject_type' => $subjectType,
                'subject_id' => is_numeric($subjectId) ? (int) $subjectId : null,
                'action' => $action,
                'reason' => $reason,
                'old_values' => is_array($old) ? $old : null,
                'new_values' => is_array($new) ? $new : ['value' => $new],
            ]);
        } catch (Throwable) {
            // Administrative state changes must not be rolled back by optional
            // audit projection failures; the audit service keeps its own dead letters.
        }
    }
}
