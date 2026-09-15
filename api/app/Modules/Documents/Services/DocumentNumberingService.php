<?php

namespace App\Modules\Documents\Services;

use App\Models\AuditLog;
use App\Models\NumberingAllocation;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class DocumentNumberingService
{
    public const DOCUMENT_TYPE_PURCHASE_ORDER = 'purchase_order';

    public const SCHEME_KEY_LPO = 'lpo';

    /** @var list<string> */
    public const SUPPORTED_TOKENS = ['SEQ', 'YYYY', 'YY', 'MM', 'FY'];

    /** @var list<string> */
    public const DEFERRED_TOKENS = ['PROJECT', 'DEPARTMENT', 'FUND', 'COUNTRY'];

    public function normalize(string $display): string
    {
        $value = strtoupper(trim($display));
        $value = preg_replace('/[\s\-_\/]+/', '', $value) ?? $value;

        return $value;
    }

    /**
     * @return array{prefix: string, separator: string, sequence: int, padding: int}
     */
    public function parseLegacyReference(string $raw): array
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            throw ValidationException::withMessages([
                'last_existing_reference' => 'Enter the last existing purchase order reference.',
            ]);
        }
        if (! preg_match('/^(.*?)(\d+)\s*$/', $trimmed, $m)) {
            throw ValidationException::withMessages([
                'last_existing_reference' => 'Could not detect a trailing sequence number.',
            ]);
        }
        $head = $m[1];
        $digits = $m[2];
        $prefix = 'S';
        $separator = ' ';
        if (preg_match('/^(.*?)([\s\-\/]*)$/', $head, $h)) {
            $candidate = rtrim($h[1]);
            $sep = $h[2] ?? '';
            if ($candidate !== '') {
                $prefix = $candidate;
            }
            if ($sep !== '') {
                $separator = str_contains($sep, '/') ? '/' : (str_contains($sep, '-') ? '-' : ' ');
            }
        }

        return [
            'prefix' => $prefix,
            'separator' => $separator,
            'sequence' => (int) $digits,
            'padding' => max(strlen($digits), 1),
        ];
    }

    public function formatFromPattern(string $pattern, int $sequence, ?\DateTimeInterface $at = null): string
    {
        $this->assertPatternSupported($pattern);
        $at = $at ?? now();
        $year = (int) $at->format('Y');
        $month = (int) $at->format('n');
        $fyStart = $month >= 4 ? $year : $year - 1;
        $fy = $fyStart.'-'.substr((string) ($fyStart + 1), -2);

        $formatted = preg_replace_callback('/\{([A-Z]+)(?::(\d+))?\}/', function (array $m) use ($sequence, $at, $fy) {
            $token = $m[1];
            $pad = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 0;

            return match ($token) {
                'SEQ' => $pad > 0 ? str_pad((string) $sequence, $pad, '0', STR_PAD_LEFT) : (string) $sequence,
                'YYYY' => $at->format('Y'),
                'YY' => $at->format('y'),
                'MM' => $at->format('m'),
                'FY' => $fy,
                default => $m[0],
            };
        }, $pattern) ?? $pattern;

        return trim($formatted);
    }

    public function patternFromParts(string $prefix, string $separator, int $padding): string
    {
        $pad = max(1, $padding);

        return $prefix.$separator.'{SEQ:'.$pad.'}';
    }

    public function assertPatternSupported(string $pattern): void
    {
        if (! preg_match_all('/\{([A-Z]+)(?::\d+)?\}/', $pattern, $matches)) {
            if (! str_contains($pattern, '{SEQ')) {
                throw ValidationException::withMessages([
                    'pattern' => 'Pattern must include a {SEQ} token.',
                ]);
            }

            return;
        }
        $hasSeq = false;
        foreach ($matches[1] as $token) {
            if ($token === 'SEQ') {
                $hasSeq = true;
            }
            if (in_array($token, self::DEFERRED_TOKENS, true)) {
                throw ValidationException::withMessages([
                    'pattern' => 'Token {'.$token.'} is not enabled yet. Use {SEQ}, {YYYY}, {YY}, {MM} or {FY}.',
                ]);
            }
            if (! in_array($token, self::SUPPORTED_TOKENS, true)) {
                throw ValidationException::withMessages([
                    'pattern' => 'Unknown numbering token {'.$token.'}.',
                ]);
            }
        }
        if (! $hasSeq) {
            throw ValidationException::withMessages([
                'pattern' => 'Pattern must include a {SEQ} token.',
            ]);
        }
    }

    /**
     * @return array{formatted: string, sequence: int, scheme_id: int, allocation_id: int|null, normalised: string}
     */
    public function allocateAuto(
        int $tenantId,
        string $documentType,
        string $schemeKey,
        ?User $actor = null,
        ?Model $subject = null,
    ): array {
        return DB::transaction(function () use ($tenantId, $documentType, $schemeKey, $actor, $subject) {
            $scheme = $this->lockScheme($tenantId, $schemeKey, $documentType);
            if ($scheme->status !== 'active') {
                throw ValidationException::withMessages([
                    'sequence' => 'Numbering sequence is not activated. Administration must confirm the last legacy number.',
                ]);
            }
            $sequenceRow = $this->lockSequence((int) $scheme->id);
            $next = (int) $sequenceRow->current_value + 1;
            DB::table('numbering_sequences')->where('id', $sequenceRow->id)->update([
                'current_value' => $next,
                'updated_at' => now(),
            ]);
            $pattern = $this->effectivePattern($scheme);
            $formatted = $this->formatFromPattern($pattern, $next);
            $normalised = $this->normalize($formatted);
            $this->assertUnique($tenantId, $documentType, $normalised);

            $allocationId = NumberingAllocation::query()->insertGetId([
                'tenant_id' => $tenantId,
                'numbering_scheme_id' => $scheme->id,
                'document_type' => $documentType,
                'subject_type' => $subject ? $subject->getMorphClass() : null,
                'subject_id' => $subject?->getKey(),
                'sequence_number' => $next,
                'display_reference' => $formatted,
                'normalised_reference' => $normalised,
                'allocation_type' => 'auto',
                'allocated_by' => $actor?->id,
                'allocated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return [
                'formatted' => $formatted,
                'sequence' => $next,
                'scheme_id' => (int) $scheme->id,
                'allocation_id' => $allocationId,
                'normalised' => $normalised,
            ];
        });
    }

    /**
     * @return array{formatted: string, sequence: int|null, scheme_id: int, allocation_id: int, normalised: string}
     */
    public function allocateCustom(
        int $tenantId,
        string $documentType,
        string $schemeKey,
        string $customReference,
        string $reason,
        User $actor,
        ?Model $subject = null,
        bool $continueSequence = false,
    ): array {
        if (trim($reason) === '') {
            throw ValidationException::withMessages([
                'custom_reason' => 'A reason is required for a custom purchase order reference.',
            ]);
        }
        $display = trim($customReference);
        if ($display === '') {
            throw ValidationException::withMessages([
                'custom_reference' => 'Enter a custom reference.',
            ]);
        }

        return DB::transaction(function () use ($tenantId, $documentType, $schemeKey, $display, $reason, $actor, $subject, $continueSequence) {
            $scheme = $this->lockScheme($tenantId, $schemeKey, $documentType);
            $normalised = $this->normalize($display);
            $this->assertUnique($tenantId, $documentType, $normalised);

            $sequenceNumber = null;
            if ($continueSequence) {
                if (! $actor->hasAnyPermission(['procurement.sequence.manage', 'procurement.admin']) && ! $actor->hasRole('System Admin')) {
                    abort(403);
                }
                try {
                    $parsed = $this->parseLegacyReference($display);
                    $sequenceRow = $this->lockSequence((int) $scheme->id);
                    if ($parsed['sequence'] > (int) $sequenceRow->current_value) {
                        DB::table('numbering_sequences')->where('id', $sequenceRow->id)->update([
                            'current_value' => $parsed['sequence'],
                            'updated_at' => now(),
                        ]);
                    }
                    $sequenceNumber = $parsed['sequence'];
                } catch (ValidationException) {
                    // Custom donor refs that do not parse stay outside the automatic sequence.
                }
            }

            $allocationId = NumberingAllocation::query()->insertGetId([
                'tenant_id' => $tenantId,
                'numbering_scheme_id' => $scheme->id,
                'document_type' => $documentType,
                'subject_type' => $subject ? $subject->getMorphClass() : null,
                'subject_id' => $subject?->getKey(),
                'sequence_number' => $sequenceNumber,
                'display_reference' => $display,
                'normalised_reference' => $normalised,
                'allocation_type' => 'custom',
                'reason' => $reason,
                'continue_sequence' => $continueSequence,
                'allocated_by' => $actor->id,
                'allocated_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            AuditLog::record('procurement.reference.custom_assigned', [
                'auditable_type' => $subject ? $subject::class : Tenant::class,
                'auditable_id' => $subject?->getKey() ?? $tenantId,
                'new_values' => [
                    'reference' => $display,
                    'reason' => $reason,
                    'continue_sequence' => $continueSequence,
                ],
                'tags' => 'procurement',
            ]);

            return [
                'formatted' => $display,
                'sequence' => $sequenceNumber,
                'scheme_id' => (int) $scheme->id,
                'allocation_id' => $allocationId,
                'normalised' => $normalised,
            ];
        });
    }

    public function activate(
        int $tenantId,
        User $actor,
        int $lastLegacyNumber,
        string $reason,
        string $schemeKey = self::SCHEME_KEY_LPO,
        string $documentType = self::DOCUMENT_TYPE_PURCHASE_ORDER,
        ?string $prefix = null,
        ?string $separator = null,
        ?int $padding = null,
        ?string $pattern = null,
    ): array {
        if (! $actor->hasAnyPermission(['procurement.admin', 'procurement.sequence.manage']) && ! $actor->hasRole('System Admin')) {
            abort(403);
        }
        if (trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required to activate numbering.']);
        }

        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', $schemeKey)
            ->first();

        $prefix = $prefix ?? ($scheme->prefix ?? 'S');
        $separator = $separator ?? ($scheme->separator ?? ' ');
        $padding = $padding ?? (int) ($scheme->sequence_length ?? 5);
        $pattern = $pattern ?: $this->patternFromParts($prefix, $separator, $padding);
        $this->assertPatternSupported($pattern);

        if ($scheme) {
            $this->assertSequenceNotRewound($tenantId, (int) $scheme->id, $lastLegacyNumber + 1, 'last_legacy_number');
        }

        if (! $scheme) {
            $id = DB::table('numbering_schemes')->insertGetId([
                'tenant_id' => $tenantId,
                'scheme_key' => $schemeKey,
                'document_type' => $documentType,
                'name' => 'Local Purchase Order',
                'prefix' => $prefix,
                'year_component' => 'none',
                'sequence_length' => $padding,
                'reset_rule' => 'never',
                'separator' => $separator,
                'example' => $this->formatFromPattern($pattern, 1),
                'pattern' => $pattern,
                'scope_type' => 'organisation',
                'status' => 'pending_activation',
                'metadata' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $scheme = DB::table('numbering_schemes')->where('id', $id)->first();
        }

        DB::table('numbering_schemes')->where('id', $scheme->id)->update([
            'status' => 'active',
            'document_type' => $documentType,
            'prefix' => $prefix,
            'separator' => $separator,
            'sequence_length' => $padding,
            'pattern' => $pattern,
            'example' => $this->formatFromPattern($pattern, $lastLegacyNumber + 1),
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

        AuditLog::record('procurement.sequence.activated', [
            'auditable_type' => Tenant::class,
            'auditable_id' => $tenantId,
            'new_values' => [
                'last_legacy_number' => $lastLegacyNumber,
                'reason' => $reason,
                'next_example' => $this->formatFromPattern($pattern, $lastLegacyNumber + 1),
            ],
            'tags' => 'procurement',
        ]);

        return $this->status($tenantId, $schemeKey);
    }

    public function setNext(int $tenantId, User $actor, int $nextSequence, string $reason, string $schemeKey = self::SCHEME_KEY_LPO): array
    {
        if (! $actor->hasAnyPermission(['procurement.admin', 'procurement.sequence.manage']) && ! $actor->hasRole('System Admin')) {
            abort(403);
        }
        if (trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required to change the next sequence.']);
        }
        if ($nextSequence < 1) {
            throw ValidationException::withMessages(['next_sequence' => 'Next sequence must be at least 1.']);
        }

        return DB::transaction(function () use ($tenantId, $actor, $nextSequence, $reason, $schemeKey) {
            $scheme = DB::table('numbering_schemes')
                ->where('tenant_id', $tenantId)
                ->where('scheme_key', $schemeKey)
                ->lockForUpdate()
                ->first();
            if (! $scheme || $scheme->status !== 'active') {
                throw ValidationException::withMessages(['sequence' => 'Activate numbering before changing the next sequence.']);
            }

            $this->assertSequenceNotRewound($tenantId, (int) $scheme->id, $nextSequence, 'next_sequence');

            $seq = $this->lockSequence((int) $scheme->id);
            $previous = (int) $seq->current_value;
            $newCurrent = $nextSequence - 1;
            DB::table('numbering_sequences')->where('id', $seq->id)->update([
                'current_value' => $newCurrent,
                'updated_at' => now(),
            ]);

            AuditLog::record('procurement.sequence.next_changed', [
                'auditable_type' => Tenant::class,
                'auditable_id' => $tenantId,
                'new_values' => [
                    'previous_next' => $previous + 1,
                    'new_next' => $nextSequence,
                    'reason' => $reason,
                    'changed_by' => $actor->id,
                ],
                'tags' => 'procurement',
            ]);

            return $this->status($tenantId, $schemeKey);
        });
    }

    public function status(int $tenantId, string $schemeKey = self::SCHEME_KEY_LPO): array
    {
        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', $schemeKey)
            ->first();

        if (! $scheme) {
            return [
                'configured' => false,
                'status' => 'missing',
                'prefix' => 'S',
                'padding' => 5,
                'separator' => ' ',
                'pattern' => 'S {SEQ:5}',
                'current_value' => 0,
                'next_example' => 'S 00001',
                'scheme_key' => $schemeKey,
                'document_type' => self::DOCUMENT_TYPE_PURCHASE_ORDER,
            ];
        }

        $seq = DB::table('numbering_sequences')
            ->where('numbering_scheme_id', $scheme->id)
            ->where('period_key', 'lifetime')
            ->first();
        $current = (int) ($seq->current_value ?? 0);
        $meta = is_string($scheme->metadata) ? json_decode($scheme->metadata, true) : (array) ($scheme->metadata ?? []);
        $pattern = $this->effectivePattern($scheme);

        return [
            'configured' => true,
            'status' => $scheme->status,
            'prefix' => $scheme->prefix,
            'padding' => (int) $scheme->sequence_length,
            'separator' => $scheme->separator,
            'pattern' => $pattern,
            'current_value' => $current,
            'next_example' => $this->formatFromPattern($pattern, $current + 1),
            'last_legacy_number' => $meta['last_legacy_number'] ?? null,
            'activated_at' => $meta['activated_at'] ?? null,
            'scheme_key' => $scheme->scheme_key,
            'scheme_id' => (int) $scheme->id,
            'document_type' => $scheme->document_type ?? self::DOCUMENT_TYPE_PURCHASE_ORDER,
            'name' => $scheme->name,
        ];
    }

    public function recordVoid(int $tenantId, string $formatted, string $schemeKey = self::SCHEME_KEY_LPO): void
    {
        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', $schemeKey)
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

    public function applyToPurchaseOrder(PurchaseOrder $po, array $allocated, string $type): void
    {
        $po->lpo_number = $allocated['formatted'];
        $po->lpo_sequence_number = $allocated['sequence'];
        $po->reference_number = $allocated['formatted'];
        $po->normalised_reference = $allocated['normalised'];
        $po->numbering_scheme_id = $allocated['scheme_id'];
        $po->allocation_id = $allocated['allocation_id'];
        $po->reference_allocation_type = $type;
        if (! $po->lpo_date) {
            $po->lpo_date = now()->toDateString();
        }
    }

    private function effectivePattern(object $scheme): string
    {
        $pattern = trim((string) ($scheme->pattern ?? ''));
        if ($pattern !== '') {
            return $pattern;
        }

        return $this->patternFromParts(
            (string) $scheme->prefix,
            (string) $scheme->separator,
            (int) $scheme->sequence_length,
        );
    }

    private function lockScheme(int $tenantId, string $schemeKey, string $documentType): object
    {
        $scheme = DB::table('numbering_schemes')
            ->where('tenant_id', $tenantId)
            ->where('scheme_key', $schemeKey)
            ->lockForUpdate()
            ->first();
        if (! $scheme) {
            throw ValidationException::withMessages([
                'sequence' => 'Numbering scheme is not configured for this tenant.',
            ]);
        }
        if ($scheme->document_type && $scheme->document_type !== $documentType) {
            throw ValidationException::withMessages([
                'sequence' => 'Numbering scheme does not match this document type.',
            ]);
        }

        return $scheme;
    }

    private function lockSequence(int $schemeId): object
    {
        $sequence = DB::table('numbering_sequences')
            ->where('numbering_scheme_id', $schemeId)
            ->where('period_key', 'lifetime')
            ->lockForUpdate()
            ->first();
        if (! $sequence) {
            $id = DB::table('numbering_sequences')->insertGetId([
                'numbering_scheme_id' => $schemeId,
                'period_key' => 'lifetime',
                'current_value' => 0,
                'voided_references' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $sequence = DB::table('numbering_sequences')->where('id', $id)->lockForUpdate()->first();
        }

        return $sequence;
    }

    private function assertSequenceNotRewound(int $tenantId, int $schemeId, int $nextSequence, string $field): void
    {
        $maxAllocated = NumberingAllocation::query()
            ->where('tenant_id', $tenantId)
            ->where('numbering_scheme_id', $schemeId)
            ->whereNotNull('sequence_number')
            ->max('sequence_number');
        if ($maxAllocated !== null && $nextSequence <= (int) $maxAllocated) {
            throw ValidationException::withMessages([
                $field => 'Next sequence cannot rewind into an already allocated number.',
            ]);
        }
    }

    private function assertUnique(int $tenantId, string $documentType, string $normalised): void
    {
        $exists = NumberingAllocation::query()
            ->where('tenant_id', $tenantId)
            ->where('document_type', $documentType)
            ->where('normalised_reference', $normalised)
            ->exists();
        if ($exists || $this->purchaseOrderHoldsNormalised($tenantId, $normalised)) {
            throw ValidationException::withMessages([
                'reference' => 'Purchase Order reference already exists.',
            ]);
        }
    }

    private function purchaseOrderHoldsNormalised(int $tenantId, string $normalised): bool
    {
        $query = PurchaseOrder::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) use ($normalised) {
                $q->where('normalised_reference', $normalised);
                if ($this->supportsNormalisedSql()) {
                    $q->orWhere(function ($inner) use ($normalised) {
                        $inner->whereNotNull('lpo_number')
                            ->where('lpo_number', 'not like', 'PROC-DRAFT-%')
                            ->whereRaw($this->normalisedEqualsSql('lpo_number'), [$normalised]);
                    })->orWhere(function ($inner) use ($normalised) {
                        $inner->whereNotNull('reference_number')
                            ->where('reference_number', 'not like', 'PROC-DRAFT-%')
                            ->whereRaw($this->normalisedEqualsSql('reference_number'), [$normalised]);
                    });
                }
            });

        if ($query->exists()) {
            return true;
        }

        if ($this->supportsNormalisedSql()) {
            return false;
        }

        return PurchaseOrder::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->whereNotNull('lpo_number')->orWhereNotNull('reference_number');
            })
            ->get(['lpo_number', 'reference_number', 'normalised_reference'])
            ->contains(function (PurchaseOrder $order) use ($normalised): bool {
                if ($order->normalised_reference === $normalised) {
                    return true;
                }
                foreach ([$order->lpo_number, $order->reference_number] as $raw) {
                    if (! is_string($raw) || $raw === '' || str_starts_with($raw, 'PROC-DRAFT-')) {
                        continue;
                    }
                    if ($this->normalize($raw) === $normalised) {
                        return true;
                    }
                }

                return false;
            });
    }

    private function supportsNormalisedSql(): bool
    {
        return DB::connection()->getDriverName() === 'pgsql';
    }

    private function normalisedEqualsSql(string $column): string
    {
        $allowed = ['lpo_number', 'reference_number'];
        if (! in_array($column, $allowed, true)) {
            throw new \InvalidArgumentException('Unsupported numbering column.');
        }

        return "upper(regexp_replace(btrim({$column}), '[\\s\\-_\\/]+', '', 'g')) = ?";
    }
}
