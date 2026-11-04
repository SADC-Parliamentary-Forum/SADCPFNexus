<?php

namespace Tests\Unit\Logging;

use Illuminate\Foundation\Testing\TestCase;

/** Reads logging config only, so it skips the base TestCase's database refresh. */
class CliLogFileTest extends TestCase
{
    public function test_cli_processes_log_to_their_own_file(): void
    {
        // Tests run under the CLI SAPI, like queue workers and the scheduler.
        $this->assertSame(storage_path('logs/laravel-cli.log'), config('logging.channels.daily.path'));
        $this->assertSame(storage_path('logs/laravel-cli.log'), config('logging.channels.single.path'));
    }
}
