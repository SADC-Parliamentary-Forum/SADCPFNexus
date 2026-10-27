<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class SetRlsContext
{
    /** Session settings read by RLS policies; cleared after every request. */
    private const CONTEXT_SETTINGS = ['app.tenant_id', 'app.user_id', 'app.user_role', 'app.classification'];

    /**
     * PostgreSQL SET does not support bound parameters ($1); use literal values.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            $tenantId = (int) $user->tenant_id;
            $userId = (int) $user->id;

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
            $connection = DB::connection();
            $baseTransactionLevel = $connection->transactionLevel();

            // Everything after the first SET is inside try: if a later SET (e.g.
            // SET ROLE) fails, the settings already applied are still reset.
            try {
                DB::statement("SET app.tenant_id = {$tenantId}");
                DB::statement("SET app.user_id = {$userId}");
                DB::statement("SET app.user_role = '".str_replace("'", "''", $role)."'");
                DB::statement("SET app.classification = '".str_replace("'", "''", $classification)."'");

                // Set the runtime role for RLS
                DB::statement('SET ROLE app_user');

                return $next($request);
            } finally {
                $this->resetContext($connection, $baseTransactionLevel);
            }
        }

        return $next($request);
    }

    /**
     * Restore the connection to its pre-request state, including when the
     * request threw. A reused connection (persistent PDO, Octane, long-lived
     * workers) must never carry one user's role or tenant context into the
     * next request.
     */
    private function resetContext(ConnectionInterface $connection, int $baseTransactionLevel): void
    {
        try {
            // Postgres rejects every statement inside an aborted transaction until
            // it is rolled back, and a transaction the request left open would keep
            // its SET values. Roll back only what this request opened.
            if ($connection->transactionLevel() > $baseTransactionLevel) {
                $connection->rollBack($baseTransactionLevel);
            }

            $connection->statement('RESET ROLE');
            foreach (self::CONTEXT_SETTINGS as $setting) {
                $connection->statement("RESET {$setting}");
            }
        } catch (Throwable $e) {
            report($e);
            // The session state cannot be proven clean: drop the connection so it
            // is never reused. The next query opens a fresh session.
            DB::purge($connection->getName());
        }
    }
}
