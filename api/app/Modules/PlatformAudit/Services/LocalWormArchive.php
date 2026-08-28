<?php

namespace App\Modules\PlatformAudit\Services;

use App\Models\WormArchiveEntry;
use RuntimeException;

/**
 * Append-only hash-chained archive. Entries cannot be rewritten.
 */
class LocalWormArchive
{
    public function append(int $tenantId, string $eventKey, array $payload): WormArchiveEntry
    {
        $previous = WormArchiveEntry::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('sequence')
            ->first();

        $sequence = $previous ? ((int) $previous->sequence + 1) : 1;
        $previousHash = $previous?->content_hash;
        $body = json_encode([
            'tenant_id' => $tenantId,
            'event_key' => $eventKey,
            'payload' => $payload,
            'sequence' => $sequence,
            'previous_hash' => $previousHash,
        ], JSON_THROW_ON_ERROR);
        $hash = hash('sha256', $body);

        return WormArchiveEntry::query()->create([
            'tenant_id' => $tenantId,
            'event_key' => $eventKey,
            'payload' => $payload,
            'content_hash' => $hash,
            'previous_hash' => $previousHash,
            'sequence' => $sequence,
        ]);
    }

    public function verifyChain(int $tenantId): bool
    {
        $rows = WormArchiveEntry::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('sequence')
            ->get();

        $prev = null;
        foreach ($rows as $row) {
            if ($prev !== null && $row->previous_hash !== $prev->content_hash) {
                return false;
            }
            $prev = $row;
        }

        return true;
    }

    public function rewrite(WormArchiveEntry $entry): never
    {
        throw new RuntimeException('WORM archive entries are immutable.');
    }

    public function status(): string
    {
        $driver = strtolower((string) config('audit.worm_driver', 'null'));
        if ($driver === 'local') {
            return 'Local append-only archive enabled';
        }
        if ($driver === 'http' && filled(config('audit.worm_http_url'))) {
            return 'HTTP WORM sink configured';
        }

        return 'Governance Configuration Pending';
    }
}
