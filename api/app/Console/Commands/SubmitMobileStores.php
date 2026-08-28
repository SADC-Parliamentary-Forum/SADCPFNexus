<?php

namespace App\Console\Commands;

use App\Modules\Admin\Services\MobileStoreSubmitClient;
use Illuminate\Console\Command;

class SubmitMobileStores extends Command
{
    protected $signature = 'mobile:submit-store {target : play|appstore}';

    protected $description = 'Submit mobile artifacts via configured HTTP store endpoints (fails closed without credentials)';

    public function handle(MobileStoreSubmitClient $client): int
    {
        $target = strtolower((string) $this->argument('target'));
        $result = match ($target) {
            'play' => $client->submitPlay(['requested_at' => now()->toIso8601String()]),
            'appstore', 'asc' => $client->submitAppStore(['requested_at' => now()->toIso8601String()]),
            default => ['ok' => false, 'code' => 'unknown_target', 'message' => 'Use play or appstore.'],
        };

        $this->line(($result['ok'] ? 'OK' : 'FAIL').' '.$result['code'].' '.$result['message']);

        return $result['ok'] ? self::SUCCESS : self::FAILURE;
    }
}
