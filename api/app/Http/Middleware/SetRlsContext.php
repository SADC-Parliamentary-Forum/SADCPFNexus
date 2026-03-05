<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class SetRlsContext
{
    /**
     * PostgreSQL SET does not support bound parameters ($1); use literal values.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            $tenantId = (int) $user->tenant_id;
            $userId = (int) $user->id;
            $role = $user->getRoleNames()->first() ?? 'staff';
            $classification = $user->classification ?? '';

            // Set PostgreSQL session variables for RLS (literals only; SET does not support bindings)
            DB::statement("SET app.tenant_id = {$tenantId}");
            DB::statement("SET app.user_id = {$userId}");
            DB::statement("SET app.user_role = '" . str_replace("'", "''", $role) . "'");
            DB::statement("SET app.classification = '" . str_replace("'", "''", $classification) . "'");

            // Set the runtime role for RLS
            DB::statement("SET ROLE app_user");
        }

        $response = $next($request);

        // Reset role after request
        if ($user) {
            DB::statement("RESET ROLE");
        }

        return $response;
    }
}
