<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\AccessControl\Services\CanonicalRoleManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesCleanupCommand extends Command
{
    protected $signature = 'roles:cleanup
        {--apply : Write the changes; without it the command only reports}';

    protected $description = 'Move users off old role names onto the role catalogue and delete unused duplicate roles (dry run unless --apply)';

    private const GUARD = 'sanctum';

    /**
     * Old names left as they are. Supplier and Supplier Finance User both map to External
     * Supplier, whose aliases include both, so moving a plain Supplier would quietly grant
     * the supplier finance access too.
     */
    private const KEPT_ROLES = ['Supplier', 'Supplier Finance User'];

    public function handle(CanonicalRoleManager $roles): int
    {
        $changes = [];
        $users = User::withTrashed()->with('roles')->orderBy('id')->get();
        foreach ($users as $user) {
            $old = $user->roles->where('guard_name', self::GUARD)->pluck('name')->values()->all();
            $new = $this->movedRoles($roles, $old);
            if ($this->sorted($old) !== $this->sorted($new)) {
                $changes[$user->id] = ['user' => $user, 'old' => $old, 'new' => $new];
            }
        }

        $missing = collect($changes)->pluck('new')->flatten()->unique()
            ->reject(fn (string $name) => Role::where('name', $name)->where('guard_name', self::GUARD)->exists());
        if ($missing->isNotEmpty()) {
            $this->error('Roles missing on the '.self::GUARD.' guard (run RolesAndPermissionsSeeder first): '.$missing->implode(', '));

            return self::FAILURE;
        }

        foreach ($changes as $id => $change) {
            $this->line("user {$id}: ".implode(' + ', $change['old']).'  ->  '.implode(' + ', $change['new']));
        }
        $this->info(count($changes).' user(s) to move.');

        $holders = collect($changes)->flatMap(fn (array $c) => $c['new']);
        $retired = Role::whereIn('name', CanonicalRoleManager::RETIRED_ROLES)->orderBy('name')->get()
            ->filter(function (Role $role) use ($changes, $holders) {
                $left = DB::table('model_has_roles')->where('role_id', $role->id)
                    ->whereNotIn('model_id', array_keys($changes))->count();

                return $left === 0 && ! $holders->contains($role->name);
            });
        foreach ($retired as $role) {
            $this->line("delete role: {$role->name} ({$role->guard_name})");
        }
        $this->info($retired->count().' role(s) to delete.');

        if (! $this->option('apply')) {
            $this->comment('Dry run. Re-run with --apply to write.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($changes, $retired) {
            foreach ($changes as $change) {
                $user = $change['user'];
                $user->syncRoles(Role::whereIn('name', $change['new'])->where('guard_name', self::GUARD)->get());
                AuditLog::record('user.role_changed', [
                    'tenant_id' => $user->tenant_id,
                    'auditable_type' => User::class,
                    'auditable_id' => $user->id,
                    'old_values' => ['roles' => $change['old']],
                    'new_values' => ['roles' => $change['new']],
                    'tags' => 'user_management,roles_cleanup',
                ]);
            }
            foreach ($retired as $role) {
                $role->delete();
            }
        });
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->info('Moved '.count($changes).' user(s) and deleted '.$retired->count().' role(s).');

        return self::SUCCESS;
    }

    /**
     * Old role names become their catalogue role plus its aliases, as an admin
     * assigning that role would give. Catalogue roles and roles with no catalogue
     * equivalent are kept as they are.
     *
     * @param  list<string>  $old
     * @return list<string>
     */
    private function movedRoles(CanonicalRoleManager $roles, array $old): array
    {
        $new = [];
        foreach ($old as $name) {
            if (isset(CanonicalRoleManager::SPLIT_ROLES[$name])) {
                foreach (CanonicalRoleManager::SPLIT_ROLES[$name] as $target) {
                    $new = array_merge($new, $roles->assignmentRoleNames($target));
                }
            } elseif (in_array($name, self::KEPT_ROLES, true)) {
                $new[] = $name;
            } elseif ($roles->canonicalize($name) !== $name) {
                $new = array_merge($new, $roles->assignmentRoleNames($name));
            } else {
                $new[] = $name;
            }
        }

        return array_values(array_unique($new));
    }

    /** @param list<string> $names */
    private function sorted(array $names): array
    {
        sort($names);

        return $names;
    }
}
