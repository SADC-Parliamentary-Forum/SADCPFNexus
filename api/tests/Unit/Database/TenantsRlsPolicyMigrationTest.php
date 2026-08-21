<?php

namespace Tests\Unit\Database;

use PHPUnit\Framework\TestCase;

class TenantsRlsPolicyMigrationTest extends TestCase
{
    public function test_tenants_rls_policy_matches_rows_by_id_not_tenant_id(): void
    {
        $migrations = glob(dirname(__DIR__, 3).'/database/migrations/*tenants*rls*.php')
            ?: glob(dirname(__DIR__, 3).'/database/migrations/*add_tenants_rls*.php');

        $this->assertNotEmpty($migrations, 'Expected a tenants RLS policy migration.');

        $source = (string) file_get_contents($migrations[0]);
        $this->assertStringContainsString('ON tenants', $source);
        $this->assertStringContainsString("app.tenant_id", $source);
        $this->assertMatchesRegularExpression('/USING\s*\(\s*id\s*=/', $source);
        $this->assertDoesNotMatchRegularExpression('/CREATE POLICY[^;]*ON tenants[^;]*USING\s*\(\s*tenant_id\s*=/', $source);
    }
}
