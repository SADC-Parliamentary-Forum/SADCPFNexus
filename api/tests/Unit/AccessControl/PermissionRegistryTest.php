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
}
