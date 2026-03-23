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
            $userId   = (int) $user->id;

            // Whitelist role — prevents any unrecognised value reaching the SQL SET
            $rawRole = $user->getRoleNames()->first() ?? 'staff';
            $allowedRoles = [
                'System Admin', 'HR Manager', 'Finance Controller', 'Staff',
                'Procurement Officer', 'Governance Officer', 'Secretary General',
                'super-admin', 'staff', 'hr', 'finance', 'procurement', 'governance', 'sg',
            ];
            $role = in_array($rawRole, $allowedRoles, true) ? $rawRole : 'staff';

            // Whitelist classification — prevents any unrecognised value reaching the SQL SET
            $rawClassification = $user->classification ?? '';
            $allowedClassifications = ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', ''];
            $classification = in_array($rawClassification, $allowedClassifications, true)
                ? $rawClassification
                : 'UNCLASSIFIED';

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
