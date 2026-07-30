<?php

namespace App\Http\Middleware;

use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use Closure;
use Illuminate\Http\Request;

/**
 * Middleware PEP: authorize:<permission>
 */
class EnforceAccessPermission
{
    public function __construct(private readonly PolicyDecisionPoint $pdp) {}

    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = $request->user();
        if (! $user) {
            abort(401);
        }

        $this->pdp->assert($user, $permission, null, [
            'route' => $request->path(),
        ]);

        return $next($request);
    }
}
