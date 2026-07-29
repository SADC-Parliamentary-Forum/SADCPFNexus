<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Modules\Correspondence\Services\CorrespondenceArchiveImportService;
use Illuminate\Console\Command;

class CorrespondenceImportArchiveCommand extends Command
{
    protected $signature = 'correspondence:import-archive {path?} {--tenant=} {--user=}';

    protected $description = 'Import multilingual correspondence archive rows from a JSON/JSONL file (drafts only)';

    public function handle(CorrespondenceArchiveImportService $imports): int
    {
        $path = $this->argument('path');
        $rows = [];
        if ($path && is_readable($path)) {
            $raw = file_get_contents($path);
            $decoded = json_decode($raw ?: '[]', true);
            if (is_array($decoded) && array_is_list($decoded)) {
                $rows = $decoded;
            } elseif (is_array($decoded) && isset($decoded['rows']) && is_array($decoded['rows'])) {
                $rows = $decoded['rows'];
            } else {
                foreach (preg_split("/\r\n|\n|\r/", $raw ?: '') as $line) {
                    if (trim($line) === '') continue;
                    $row = json_decode($line, true);
                    if (is_array($row)) $rows[] = $row;
                }
            }
        } else {
            $rows = [[
                'reference' => 'ARC-DEMO-1',
                'subject' => 'Archive import stub',
                'language' => 'en',
                'body' => 'Demo archive row — replace with --path JSONL',
            ]];
            $this->warn('No path provided/readable; importing a single demo draft row.');
        }

        $tenantId = $this->option('tenant');
        $userId = $this->option('user');
        $user = $userId
            ? User::findOrFail($userId)
            : User::query()->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->first();
        if (! $user) {
            $this->error('No user found for import.');
            return self::FAILURE;
        }

        $result = $imports->importRows($rows, $user);
        $this->info('Imported '.$result['imported'].' draft archive rows.');

        return self::SUCCESS;
    }
}
