<?php

namespace Tests\Unit\AccessControl;

use App\Modules\AccessControl\Services\PermissionRegistry;
use Tests\TestCase;

class PermissionRegistryTest extends TestCase
{
    public function test_role_permissions_expand_all_inheritance_levels(): void
    {
        config([
            'access_control.role_templates' => [
                'Base' => ['permissions' => ['base.read'], 'inherits' => []],
                'Middle' => ['permissions' => ['middle.read'], 'inherits' => ['Base']],
                'Leaf' => ['permissions' => ['leaf.read'], 'inherits' => ['Middle']],
            ],
        ]);

        $permissions = app(PermissionRegistry::class)->rolePermissions('Leaf');

        $this->assertSame(['leaf.read', 'middle.read', 'base.read'], $permissions);
    }

    public function test_role_permissions_are_cycle_safe(): void
    {
        config([
            'access_control.role_templates' => [
                'A' => ['permissions' => ['a.read'], 'inherits' => ['B']],
                'B' => ['permissions' => ['b.read'], 'inherits' => ['A']],
            ],
        ]);

        $permissions = app(PermissionRegistry::class)->rolePermissions('A');

        $this->assertSame(['a.read', 'b.read'], $permissions);
    }

    public function test_expand_legacy_indexes_dotted_keys_literally(): void
    {
        config([
            'access_control.legacy_aliases' => [
                'travel.view' => ['travel.request.read.self', 'travel.module.view'],
            ],
        ]);

        $canonicals = app(PermissionRegistry::class)->expandLegacy('travel.view');

        $this->assertSame(
            ['travel.request.read.self', 'travel.module.view'],
            $canonicals
        );
    }

    public function test_legacy_travel_view_maps_to_self_read(): void
    {
        $keys = app(PermissionRegistry::class)->resolveEquivalents('travel.view');

        $this->assertContains('travel.view', $keys);
        $this->assertContains('travel.request.read.self', $keys);
        $this->assertContains('travel.module.view', $keys);
    }

    public function test_legacy_leave_approve_maps_to_authorise(): void
    {
        $keys = app(PermissionRegistry::class)->resolveEquivalents('leave.approve');

        $this->assertContains('leave.request.authorise.assigned', $keys);
        $this->assertContains('leave.request.reject.assigned', $keys);
    }
}
