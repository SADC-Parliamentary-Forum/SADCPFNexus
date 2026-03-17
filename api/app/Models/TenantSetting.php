<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantSetting extends Model
{
    protected $fillable = ['tenant_id', 'key', 'value'];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function forTenant(int $tenantId): array
    {
        return static::where('tenant_id', $tenantId)
            ->pluck('value', 'key')
            ->map(fn($v) => json_decode($v, true) ?? $v)
            ->toArray();
    }

    public static function setForTenant(int $tenantId, string $key, mixed $value): void
    {
        static::updateOrCreate(
            ['tenant_id' => $tenantId, 'key' => $key],
            ['value' => is_string($value) ? $value : json_encode($value)]
        );
    }
}
