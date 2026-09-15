<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetHandoverDeclarationVersion extends Model
{
    public const DEFAULT_KEY = 'v1';

    public const DEFAULT_STATEMENT = 'I acknowledge that I have received the assets listed above in the condition stated and accept responsibility for their reasonable care and safekeeping while they remain in my custody.';

    protected $fillable = [
        'tenant_id', 'version_key', 'statement', 'effective_from', 'is_current',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'datetime',
            'is_current' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function currentForTenant(int $tenantId): self
    {
        $row = static::query()
            ->where(function ($q) use ($tenantId) {
                $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
            })
            ->where('is_current', true)
            ->orderByDesc('tenant_id')
            ->orderByDesc('id')
            ->first();

        if ($row) {
            return $row;
        }

        return static::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'version_key' => self::DEFAULT_KEY],
            [
                'statement' => self::DEFAULT_STATEMENT,
                'effective_from' => now(),
                'is_current' => true,
            ]
        );
    }
}
