<?php

namespace App\Modules\Procurement\Services;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LpoSequenceAllocator
{
    public const SCHEME_KEY = 'lpo';

    /**
     * @return array{formatted: string, sequence: int, scheme_id: int}
     */
    public function allocate(int $tenantId, ?User $actor = null): array
    {
        return DB::transaction(function () use ($tenantId) {
            $scheme = DB::table('numbering_schemes')
                ->where('tenant_id', $tenantId)
                ->where('scheme_key', self::SCHEME_KEY)
                ->lockForUpdate()
                ->first();

            if (! $scheme) {
                throw ValidationException::withMessages([
                    'sequence' => 'LPO numbering scheme is not configured for this tenant.',
                ]);
            }

            if ($scheme->status !== 'active') {
                throw ValidationException::withMessages([
                    'sequence' => 'LPO sequence is not activated. Administration must confirm the last legacy number.',
                ]);
            }

            $sequence = DB::table('numbering_sequences')
                ->where('numbering_scheme_id', $scheme->id)
                ->where('period_key', 'lifetime')
                ->lockForUpdate()
                ->first();

            if (! $sequence) {
                $id = DB::table('numbering_sequences')->insertGetId([
                    'numbering_scheme_id' => $scheme->id,
                    'period_key' => 'lifetime',
                    'current_value' => 0,
                    'voided_references' => json_encode([]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $sequence = DB::table('numbering_sequences')->where('id', $id)->lockForUpdate()->first();
            }

            $next = (int) $sequence->current_value + 1;
            DB::table('numbering_sequences')->where('id', $sequence->id)->update([
                'current_value' => $next,
                'updated_at' => now(),
            ]);

            $formatted = $this->format((string) $scheme->prefix, (string) $scheme->separator, (int) $scheme->sequence_length, $next);

            return [
                'formatted' => $formatted,
                'sequence' => $next,
                'scheme_id' => (int) $scheme->id,
            ];
        });
    }

    public function format(string $prefix, string $separator, int $padding, int $number): string
    {
        return trim($prefix.$separator.str_pad((string) $number, $padding, '0', STR_PAD_LEFT));
    }

    public function activate(int $tenantId, User $actor, int $lastLegacyNumber, string $reason): array
    {
        if (! $actor->hasAnyPermission(['procurement.admin', 'procurement.sequence.manage']) && ! $actor->hasRole('System Admin')) {
            abort(403);
        }

        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', self::SCHEME_KEY)
            ->first();

        if (! $scheme) {
            $id = DB::table('numbering_schemes')->insertGetId([
                'tenant_id' => $tenantId,
                'scheme_key' => self::SCHEME_KEY,
                'name' => 'Local Purchase Order',
                'prefix' => 'S',
                'year_component' => 'none',
                'sequence_length' => 5,
                'reset_rule' => 'never',
                'separator' => ' ',
                'example' => 'S 00001',
                'status' => 'pending_activation',
                'metadata' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $scheme = DB::table('numbering_schemes')->where('id', $id)->first();
        }

        DB::table('numbering_schemes')->where('id', $scheme->id)->update([
            'status' => 'active',
            'metadata' => json_encode([
                'last_legacy_number' => $lastLegacyNumber,
                'activated_by' => $actor->id,
                'activated_at' => now()->toIso8601String(),
                'reason' => $reason,
            ]),
            'updated_at' => now(),
        ]);

        $seq = DB::table('numbering_sequences')
            ->where('numbering_scheme_id', $scheme->id)
            ->where('period_key', 'lifetime')
            ->first();

        if (! $seq) {
            DB::table('numbering_sequences')->insert([
                'numbering_scheme_id' => $scheme->id,
                'period_key' => 'lifetime',
                'current_value' => $lastLegacyNumber,
                'voided_references' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            DB::table('numbering_sequences')->where('id', $seq->id)->update([
                'current_value' => $lastLegacyNumber,
                'updated_at' => now(),
            ]);
        }

        \App\Models\AuditLog::record('procurement.sequence.activated', [
            'auditable_type' => Tenant::class,
            'auditable_id' => $tenantId,
            'new_values' => ['last_legacy_number' => $lastLegacyNumber, 'reason' => $reason],
            'tags' => 'procurement',
        ]);

        return $this->status($tenantId);
    }

    public function status(int $tenantId): array
    {
        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', self::SCHEME_KEY)
            ->first();

        if (! $scheme) {
            return [
                'configured' => false,
                'status' => 'missing',
                'prefix' => 'S',
                'padding' => 5,
                'separator' => ' ',
                'current_value' => 0,
                'next_example' => 'S 00001',
            ];
        }

        $seq = DB::table('numbering_sequences')
            ->where('numbering_scheme_id', $scheme->id)
            ->where('period_key', 'lifetime')
            ->first();
        $current = (int) ($seq->current_value ?? 0);
        $meta = is_string($scheme->metadata) ? json_decode($scheme->metadata, true) : (array) ($scheme->metadata ?? []);

        return [
            'configured' => true,
            'status' => $scheme->status,
            'prefix' => $scheme->prefix,
            'padding' => (int) $scheme->sequence_length,
            'separator' => $scheme->separator,
            'current_value' => $current,
            'next_example' => $this->format((string) $scheme->prefix, (string) $scheme->separator, (int) $scheme->sequence_length, $current + 1),
            'last_legacy_number' => $meta['last_legacy_number'] ?? null,
            'activated_at' => $meta['activated_at'] ?? null,
        ];
    }

    public function recordVoid(int $tenantId, string $formatted): void
    {
        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', self::SCHEME_KEY)
            ->first();
        if (! $scheme) {
            return;
        }
        $seq = DB::table('numbering_sequences')
            ->where('numbering_scheme_id', $scheme->id)
            ->where('period_key', 'lifetime')
            ->first();
        if (! $seq) {
            return;
        }
        $voids = json_decode((string) $seq->voided_references, true) ?: [];
        $voids[] = $formatted;
        DB::table('numbering_sequences')->where('id', $seq->id)->update([
            'voided_references' => json_encode(array_values(array_unique($voids))),
            'updated_at' => now(),
        ]);
    }
}
