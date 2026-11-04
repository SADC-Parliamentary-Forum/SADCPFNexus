<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Tests\TestCase;

class AuditLogTenantFallbackTest extends TestCase
{
    public function test_event_about_a_user_with_nobody_signed_in_takes_that_users_tenant(): void
    {
        $user = User::factory()->create();

        // The MFA step of login records before the user is signed in.
        $log = AuditLog::record('auth.mfa.success', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'tags' => 'auth',
        ]);

        $this->assertSame($user->tenant_id, $log->tenant_id);
    }

    public function test_explicit_tenant_still_wins(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $log = AuditLog::record('auth.mfa.success', [
            'tenant_id' => $other->tenant_id,
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
        ]);

        $this->assertSame($other->tenant_id, $log->tenant_id);
    }
}
