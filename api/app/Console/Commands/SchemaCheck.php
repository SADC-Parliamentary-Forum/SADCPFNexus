<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Startup guard used by docker/php/entrypoint.sh.
 *
 * Exit codes:
 *   0 — database reachable and every migration file has run
 *   1 — database reachable but migrations are pending (or the migrations table is missing)
 *   2 — database unreachable within the wait window
 *
 * Read-only: never runs migrations itself. Production deployments run
 * `php artisan migrate --force` as an explicit job before starting the app.
 */
class SchemaCheck extends Command
{
    protected $signature = 'schema:check
        {--wait=0 : Seconds to keep retrying the database connection before giving up}';

    protected $description = 'Verify the database is reachable and has no pending migrations';

    public function handle(Migrator $migrator): int
    {
        $deadline = time() + max(0, (int) $this->option('wait'));

        while (true) {
            try {
                DB::connection()->getPdo();
                break;
            } catch (Throwable $e) {
                if (time() >= $deadline) {
                    $this->error('Database unreachable: '.$e->getMessage());

                    return 2;
                }
                $this->line('Waiting for database...');
                sleep(3);
            }
        }

        $repository = $migrator->getRepository();
        if (! $repository->repositoryExists()) {
            $this->error('Migrations table not found: the schema has never been migrated.');

            return 1;
        }

        $files = $migrator->getMigrationFiles(array_merge([database_path('migrations')], $migrator->paths()));
        $ran = $repository->getRan();
        $pending = array_values(array_diff(array_keys($files), $ran));

        if ($pending !== []) {
            $this->error(count($pending).' pending migration(s):');
            foreach (array_slice($pending, 0, 20) as $name) {
                $this->line("  - {$name}");
            }

            return 1;
        }

        $this->info('Schema is current ('.count($ran).' migrations applied).');

        return 0;
    }
}
