<?php

namespace App\Modules\Hr\Services;

use Illuminate\Support\Facades\Process;
use RuntimeException;

class DatabaseBackupService
{
    /**
     * @return array{path: string, size_bytes: int}
     */
    public function backupToStorage(?string $databaseName = null): array
    {
        $database = $databaseName ?: (string) config('database.connections.pgsql.database');
        $host = (string) config('database.connections.pgsql.host', '127.0.0.1');
        $port = (string) config('database.connections.pgsql.port', '5432');
        $user = (string) config('database.connections.pgsql.username', 'postgres');
        $password = (string) config('database.connections.pgsql.password', '');

        $dir = storage_path('app/backups');
        if (! is_dir($dir) && ! mkdir($dir, 0755, true) && ! is_dir($dir)) {
            throw new RuntimeException('Could not create backup directory.');
        }

        $filename = sprintf('pre-hr-wipe-%s-%s.sql.gz', $database, now()->format('Ymd-His'));
        $path = $dir.'/'.$filename;

        $env = $password !== '' ? ['PGPASSWORD' => $password] : [];
        $result = Process::env($env)->timeout(600)->run([
            'pg_dump',
            '-h', $host,
            '-p', $port,
            '-U', $user,
            '-d', $database,
        ]);

        if (! $result->successful()) {
            throw new RuntimeException('pg_dump failed: '.$result->errorOutput());
        }

        $gz = gzencode($result->output(), 6);
        if ($gz === false) {
            throw new RuntimeException('Failed to compress backup.');
        }
        file_put_contents($path, $gz);

        return [
            'path' => $path,
            'size_bytes' => filesize($path) ?: 0,
        ];
    }
}
