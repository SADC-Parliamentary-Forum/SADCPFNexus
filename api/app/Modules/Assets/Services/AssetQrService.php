<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetQrToken;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\FrontendUrl;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\SvgWriter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AssetQrService
{
    public function publicUrl(Asset $asset): string
    {
        $token = $asset->qr_token;
        if (! $token) {
            return FrontendUrl::to('/a/missing');
        }

        return FrontendUrl::to('/a/'.$token);
    }

    public function ensure(Asset $asset, ?User $actor = null): Asset
    {
        if ($asset->qr_token && $asset->qr_path && Storage::disk('local')->exists($asset->qr_path)) {
            return $asset;
        }

        return $this->generate($asset, $actor);
    }

    public function generate(Asset $asset, ?User $actor = null, bool $replace = false): Asset
    {
        if ($replace && $asset->qr_token) {
            AssetQrToken::query()
                ->where('asset_id', $asset->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now(), 'revoke_reason' => 'QR_REPLACED']);
            $asset->label_status = 'reprint_required';
            $asset->label_reprint_reason = 'QR_REPLACED';
        }

        if (! $asset->uuid) {
            $asset->uuid = (string) Str::uuid();
        }

        $token = $this->randomToken();
        $asset->qr_token = $token;
        $asset->qr_generated_at = now();

        $url = $this->publicUrl($asset);
        $svg = Builder::create()
            ->writer(new SvgWriter)
            ->data($url)
            ->size(240)
            ->margin(8)
            ->build()
            ->getString();

        $dir = 'qr/assets/'.$asset->tenant_id;
        $path = $dir.'/'.$asset->id.'.svg';
        Storage::disk('local')->put($path, $svg);
        $asset->qr_path = $path;
        $asset->save();

        AssetQrToken::create([
            'tenant_id' => $asset->tenant_id,
            'asset_id' => $asset->id,
            'token' => $token,
            'generated_at' => now(),
            'generated_by' => $actor?->id,
        ]);

        AuditLog::record($replace ? 'assets.qr_regenerated' : 'assets.qr_generated', [
            'auditable_type' => Asset::class,
            'auditable_id' => $asset->id,
            'new_values' => ['qr_token' => $token],
            'tags' => 'assets',
        ]);

        return $asset->fresh();
    }

    public function png(Asset $asset): string
    {
        $this->ensure($asset);
        $result = Builder::create()
            ->writer(new PngWriter)
            ->data($this->publicUrl($asset))
            ->size(240)
            ->margin(8)
            ->build();

        return $result->getString();
    }

    public function findByToken(string $token): ?AssetQrToken
    {
        return AssetQrToken::query()
            ->where('token', $token)
            ->whereNull('revoked_at')
            ->first();
    }

    /**
     * Public, unauthenticated payload — no serial, location, custodian or finance.
     *
     * @return array<string, mixed>
     */
    public function publicPayload(Asset $asset): array
    {
        return [
            'organisation' => 'SADC Parliamentary Forum',
            'notice' => 'Property of SADC PF',
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'asset_name' => $asset->name,
            'contact' => 'If found, please return to SADC Parliamentary Forum, Windhoek.',
        ];
    }

    private function randomToken(): string
    {
        do {
            $token = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
        } while (AssetQrToken::query()->where('token', $token)->exists());

        return $token;
    }
}
