<?php

use App\Modules\AccessControl\Services\CanonicalRoleManager;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;

/**
 * Register Contract Management permissions (PRD §93) and re-synchronise the
 * canonical role catalogue so existing tenants receive the grants defined in
 * config/access_control_role_templates.php. Idempotent by design.
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $permissions = [
        'contract.view', 'contract.view_all', 'contract.create', 'contract.edit_draft', 'contract.submit',
        'contract.review', 'contract.approve', 'contract.reject', 'contract.generate_document', 'contract.send',
        'contract.sign_internal', 'contract.manage_external_signature', 'contract.accept_deliverable',
        'contract.create_amendment', 'contract.approve_amendment', 'contract.suspend', 'contract.terminate',
        'contract.close', 'contract.manage_template', 'contract.manage_authority', 'contract.report', 'contract.audit_view',
    ];

    public function up(): void
    {
        foreach ($this->permissions as $name) {
            foreach (['sanctum', 'web'] as $guard) {
                Permission::firstOrCreate(['name' => $name, 'guard_name' => $guard]);
            }
        }

        // Apply the role template grants (Procurement Officer, Finance Officer,
        // Secretary General, etc.) via the single canonical sync point.
        app(CanonicalRoleManager::class)->synchronize();
    }

    public function down(): void
    {
        // Permissions are catalogue data; re-synchronise so role assignments
        // reflect the (reverted) templates, then remove the permission rows.
        app(CanonicalRoleManager::class)->synchronize();

        Permission::whereIn('name', $this->permissions)->delete();
    }
};
