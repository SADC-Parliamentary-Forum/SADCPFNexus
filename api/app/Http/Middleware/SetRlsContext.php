<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class SetRlsContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            // Set PostgreSQL session variables for RLS enforcement
            DB::statement("SET app.tenant_id = ?", [$user->tenant_id]);
            DB::statement("SET app.user_id = ?", [$user->id]);
            DB::statement("SET app.user_role = ?", [$user->getRoleNames()->first() ?? 'staff']);
            DB::statement("SET app.classification = ?", [$user->classification]);

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
