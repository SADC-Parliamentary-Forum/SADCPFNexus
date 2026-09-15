<?php

namespace Tests\Feature\Procurement;

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SupplierPortalAccessTest extends TestCase
{
    public function test_supplier_can_load_own_profile_and_active_categories(): void
    {
        $tenant = Tenant::factory()->create();
        $active = $this->makeSupplierCategory($tenant, ['name' => 'ICT', 'is_active' => true]);
        $this->makeSupplierCategory($tenant, ['name' => 'Hidden', 'is_active' => false]);
        [$http] = $this->asSupplier($tenant);

        $http->getJson('/api/v1/procurement/supplier/me')->assertOk();

        $http->getJson('/api/v1/procurement/supplier-categories')->assertForbidden();

        $response = $http->getJson('/api/v1/procurement/supplier/categories');
        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertContains($active->id, $ids);
        $this->assertCount(1, $ids);
    }

    public function test_supplier_can_read_own_unread_notification_count(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asSupplier($tenant);

        DB::table('notifications')->insert([
            'tenant_id'  => $user->tenant_id,
            'user_id'    => $user->id,
            'type'       => 'App\Notifications\ModuleNotification',
            'trigger'    => 'test.supplier.unread',
            'subject'    => 'Please update your documents',
            'body'       => 'A procurement officer requested more information.',
            'is_read'    => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $http->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('count', 1);

        $http->getJson('/api/v1/notifications')->assertOk();
    }
}
