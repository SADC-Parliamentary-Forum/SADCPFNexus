<?php

namespace Tests\Unit\Workplan;

use PHPUnit\Framework\TestCase;

/**
 * Source contract for destroy(): managers may delete system and in-use types.
 * Does not extend Tests\TestCase — no Postgres / RefreshDatabase.
 */
class WorkplanEventTypeControllerTest extends TestCase
{
    public function test_destroy_authorizes_managers_and_deletes_without_system_or_in_use_guards(): void
    {
        $source = (string) file_get_contents(
            dirname(__DIR__, 3).'/app/Http/Controllers/Api/V1/Workplan/WorkplanEventTypeController.php'
        );

        $this->assertNotSame('', $source, 'WorkplanEventTypeController.php must be readable.');
        $this->assertStringContainsString('public function destroy', $source);
        $this->assertStringContainsString('$this->authorizeManage($request->user())', $source);
        $this->assertStringContainsString('$eventType->delete()', $source);
        $this->assertStringNotContainsString('System event types cannot be deleted', $source);
        $this->assertStringNotContainsString('isInUse()', $source);
        $this->assertDoesNotMatchRegularExpression(
            '/function destroy\([^}]*(is_system|in use)/s',
            $source,
            'destroy() must not block system or in-use event types.'
        );
    }
}
