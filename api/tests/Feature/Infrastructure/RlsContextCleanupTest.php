<?php

namespace Tests\Feature\Infrastructure;

use App\Http\Middleware\SetRlsContext;
use App\Models\Tenant;
use App\Models\User;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

/**
 * Runs SetRlsContext against real PostgreSQL (TestCase disables it for HTTP
 * tests) to prove the role and tenant context never outlive a request —
 * including requests that throw or leave an aborted transaction behind.
 */
class RlsContextCleanupTest extends TestCase
{
    private function runAs(User $user, Closure $next): Response
    {
        $request = Request::create('/api/v1/rls-probe');
        $request->setUserResolver(fn () => $user);

        return (new SetRlsContext)->handle($request, $next);
    }

    private function currentRole(): string
    {
        return (string) DB::selectOne('select current_user as u')->u;
    }

    private function setting(string $name): string
    {
        return (string) DB::selectOne('select current_setting(?, true) as v', [$name])->v;
    }

    private function assertContextCleared(string $expectedRole): void
    {
        $this->assertSame($expectedRole, $this->currentRole());
        foreach (['app.tenant_id', 'app.user_id', 'app.user_role', 'app.classification'] as $name) {
            $this->assertSame('', $this->setting($name), "{$name} survived the request");
        }
    }

    public function test_role_and_context_are_reset_when_the_request_throws(): void
    {
        $owner = $this->currentRole();
        $user = $this->makeUser('staff');

        try {
            $this->runAs($user, function () use ($user) {
                $this->assertSame('app_user', $this->currentRole());
                $this->assertSame((string) $user->tenant_id, $this->setting('app.tenant_id'));
                throw new RuntimeException('handler failed');
            });
            $this->fail('Exception was swallowed');
        } catch (RuntimeException $e) {
            $this->assertSame('handler failed', $e->getMessage());
        }

        $this->assertContextCleared($owner);
    }

    public function test_cleanup_recovers_from_an_aborted_transaction_left_open_by_the_request(): void
    {
        $owner = $this->currentRole();
        $baseLevel = DB::transactionLevel();
        $user = $this->makeUser('staff');

        try {
            $this->runAs($user, function () {
                DB::beginTransaction();
                try {
                    DB::statement('select 1/0');
                } catch (QueryException) {
                    // The transaction is now aborted and rejects further statements.
                }
                throw new RuntimeException('left transaction open');
            });
            $this->fail('Exception was swallowed');
        } catch (RuntimeException) {
        }

        $this->assertSame($baseLevel, DB::transactionLevel());
        $this->assertContextCleared($owner);
    }

    public function test_next_request_for_another_tenant_never_sees_the_previous_context(): void
    {
        $owner = $this->currentRole();
        $userA = $this->makeUser('staff');
        $userB = $this->makeUser('staff', Tenant::factory()->create());
        $this->assertNotSame($userA->tenant_id, $userB->tenant_id);

        try {
            $this->runAs($userA, fn () => throw new RuntimeException('tenant A failed'));
        } catch (RuntimeException) {
        }

        $seen = null;
        $this->runAs($userB, function () use (&$seen) {
            $seen = [
                'tenant' => $this->setting('app.tenant_id'),
                'user' => $this->setting('app.user_id'),
            ];

            return response()->json([]);
        });

        $this->assertSame(['tenant' => (string) $userB->tenant_id, 'user' => (string) $userB->id], $seen);
        $this->assertContextCleared($owner);
    }

    public function test_successful_request_also_clears_context(): void
    {
        $owner = $this->currentRole();
        $this->runAs($this->makeUser('staff'), fn () => response()->json(['ok' => true]));

        $this->assertContextCleared($owner);
    }
}
