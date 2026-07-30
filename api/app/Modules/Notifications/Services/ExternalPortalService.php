<?php

namespace App\Modules\Notifications\Services;

use App\Models\Notifications\NotificationExternalToken;
use Illuminate\Support\Str;

/**
 * Tokenised external recipient portal — minimal content, expiry, no internal dump.
 */
class ExternalPortalService
{
    public function issue(int $tenantId, array $data): array
    {
        $plain = Str::random(48);
        $ttl = (int) config('notifications.external_token_ttl_hours', 72);

        $row = NotificationExternalToken::create([
            'tenant_id' => $tenantId,
            'uuid' => (string) Str::uuid(),
            'token_hash' => hash('sha256', $plain),
            'recipient_email' => $data['recipient_email'] ?? null,
            'recipient_name' => $data['recipient_name'] ?? null,
            'subject' => Str::limit($data['subject'] ?? 'Nexus notice', 255),
            'minimal_body' => Str::limit($data['minimal_body'] ?? 'Sign in or use this secure link for a summary only.', 2000),
            'secure_route' => app(SecureLinkService::class)->normalizeRoute($data['secure_route'] ?? '/notifications'),
            'source_module' => $data['source_module'] ?? null,
            'source_id' => $data['source_id'] ?? null,
            'expires_at' => now()->addHours($ttl),
        ]);

        $base = app(SecureLinkService::class)->frontendBase() ?: '';
        $url = ($base ?: '').'/external/notifications/'.$plain;

        return [
            'token_id' => $row->id,
            'uuid' => $row->uuid,
            'expires_at' => $row->expires_at->toIso8601String(),
            'url' => $url,
            // Plain token returned once to issuer only — never logged.
            'token' => $plain,
        ];
    }

    public function resolve(string $plainToken): array
    {
        $hash = hash('sha256', $plainToken);
        $row = NotificationExternalToken::query()->where('token_hash', $hash)->first();

        if (! $row) {
            return ['ok' => false, 'code' => 'not_found', 'message' => 'Token not found'];
        }
        if ($row->revoked_at) {
            return ['ok' => false, 'code' => 'revoked', 'message' => 'Token revoked'];
        }
        if ($row->expires_at->isPast()) {
            return ['ok' => false, 'code' => 'expired', 'message' => 'Token expired'];
        }

        if (! $row->viewed_at) {
            $row->update(['viewed_at' => now()]);
        }

        // Minimal payload only — never dump internal records.
        return [
            'ok' => true,
            'data' => [
                'subject' => $row->subject,
                'body' => $row->minimal_body,
                'expires_at' => $row->expires_at->toIso8601String(),
                'recipient_name' => $row->recipient_name,
                // Intentionally omit source_id internals / tenant data dumps.
            ],
        ];
    }

    public function revoke(int $tenantId, int $tokenId): void
    {
        NotificationExternalToken::query()
            ->where('tenant_id', $tenantId)
            ->where('id', $tokenId)
            ->update(['revoked_at' => now()]);
    }
}
