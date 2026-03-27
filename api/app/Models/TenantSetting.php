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

    public static function getLetterheadSettings(int $tenantId): array
    {
        return array_merge([
            'org_name'           => 'SADC Parliamentary Forum',
            'org_abbreviation'   => 'SADC-PF',
            'org_logo_url'       => '/sadcpf-logo.png',
            'org_address'        => '129 Robert Mugabe Avenue, Windhoek, Namibia',
            'letterhead_tagline' => 'Enhancing Parliamentary Democracy in the SADC Region',
            'letterhead_phone'   => '+264 61 287 2158',
            'letterhead_fax'     => '+264 61 254 642',
            'letterhead_website' => 'www.sadcpf.org',
        ], static::forTenant($tenantId));
    }
}
