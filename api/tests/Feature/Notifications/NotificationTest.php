<?php

namespace Tests\Feature\Notifications;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    /**
     * Insert a test notification directly into the notifications table.
     */
    private function createNotification(User $user, array $overrides = []): int
    {
        return DB::table('notifications')->insertGetId(array_merge([
            'tenant_id'    => $user->tenant_id,
            'user_id'      => $user->id,
            'type'         => 'App\Notifications\ModuleNotification',
            'trigger'      => 'test.notification',
            'subject'      => 'Test Notification',
            'body'         => 'This is a test notification body.',
            'is_read'      => false,
            'created_at'   => now(),
            'updated_at'   => now(),
        ], $overrides));
    }

    public function test_unauthenticated_cannot_list_notifications(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
    }

    public function test_user_can_list_own_notifications(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $this->createNotification($user);
        $this->createNotification($user);

        $response = $http->getJson('/api/v1/notifications');

        $response->assertOk()
                 ->assertJsonStructure(['data', 'meta']);

        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_user_only_sees_own_notifications(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $myUser] = $this->asStaff($tenant);
        $otherUser = $this->makeUser('staff', $tenant);

        $this->createNotification($myUser);
        $this->createNotification($otherUser); // should NOT appear in my list

        $response = $http->getJson('/api/v1/notifications');
        $response->assertOk();

        $userIds = collect($response->json('data'))->pluck('user_id')->unique()->values()->toArray();
        $this->assertNotContains($otherUser->id, $userIds);
    }

    public function test_unread_count_returns_integer(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $this->createNotification($user, ['is_read' => false]);
        $this->createNotification($user, ['is_read' => false]);
        $this->createNotification($user, ['is_read' => true]);

        $response = $http->getJson('/api/v1/notifications/unread-count');

        $response->assertOk()
                 ->assertJsonStructure(['count']);

        $this->assertEquals(2, $response->json('count'));
    }

    public function test_user_can_mark_notification_as_read(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $id = $this->createNotification($user, ['is_read' => false]);

        $http->postJson("/api/v1/notifications/{$id}/read")
             ->assertOk();

        $this->assertDatabaseHas('notifications', ['id' => $id, 'is_read' => true]);
    }

    public function test_user_can_mark_all_notifications_as_read(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $idA = $this->createNotification($user, ['is_read' => false]);
        $idB = $this->createNotification($user, ['is_read' => false]);

        $http->postJson('/api/v1/notifications/read-all')
             ->assertOk();

        $this->assertDatabaseHas('notifications', ['id' => $idA, 'is_read' => true]);
        $this->assertDatabaseHas('notifications', ['id' => $idB, 'is_read' => true]);
    }

    public function test_user_can_delete_own_notification(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $id = $this->createNotification($user);

        $http->deleteJson("/api/v1/notifications/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('notifications', ['id' => $id]);
    }

    public function test_user_cannot_delete_another_users_notification(): void
    {
        $tenant = Tenant::factory()->create();
        [$httpA, $userA] = $this->asStaff($tenant);
        [$httpB, $userB] = $this->asStaff($tenant);

        $id = $this->createNotification($userA);

        // User B attempts to delete User A's notification
        $httpB->deleteJson("/api/v1/notifications/{$id}")
              ->assertNotFound();

        $this->assertDatabaseHas('notifications', ['id' => $id]);
    }

    public function test_unread_count_is_zero_when_no_notifications(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/notifications/unread-count');
        $response->assertOk();

        $this->assertEquals(0, $response->json('count'));
    }
}
