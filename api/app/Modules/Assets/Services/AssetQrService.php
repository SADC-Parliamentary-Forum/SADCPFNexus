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
        $tag = $asset->tag_number ?: $asset->asset_code;
        $contact = app(AssetRecoveryContactService::class)->current(
            (int) $asset->tenant_id,
            $this->categoryId($asset)
        );
        $recovery = $contact?->publicPayload() ?? [];
        $status = $this->publicStatus($asset);
        $notice = match ($status) {
            'LOST' => 'THIS SADC PF ASSET HAS BEEN REPORTED LOST. Please contact SADC Parliamentary Forum.',
            'STOLEN' => 'THIS SADC PF ASSET HAS BEEN REPORTED STOLEN. Please contact SADC Parliamentary Forum.',
            'DISPOSED' => 'This asset is no longer an active SADC PF asset.',
            default => 'This equipment is the property of the SADC Parliamentary Forum.',
        };

        return [
            'organisation' => $asset->owner_name ?: 'SADC Parliamentary Forum',
            'notice' => $notice,
            'asset_tag' => $tag,
            'assetNumber' => $tag,
            'asset_name' => $asset->name,
            'description' => $asset->name,
            'publicStatus' => $status,
            'recoveryContact' => $recovery,
            'contact' => $recovery['telephone']
                ?? $recovery['email']
                ?? ($contact?->instructions ?: 'If found, please contact SADC Parliamentary Forum Administration.'),
        ];
    }

    public function publicStatus(Asset $asset): string
    {
        if (in_array($asset->status, ['lost', 'missing'], true)) {
            return 'LOST';
        }
        if ($asset->status === 'stolen') {
            return 'STOLEN';
        }
        if ($asset->isDisposed() || $asset->status === 'retired') {
            return 'DISPOSED';
        }

        return 'REGISTERED';
    }

    private function categoryId(Asset $asset): ?int
    {
        if (! $asset->category) {
            return null;
        }
        $id = \App\Models\AssetCategory::query()
            ->where('tenant_id', $asset->tenant_id)
            ->where('code', $asset->category)
            ->value('id');

        return $id ? (int) $id : null;
    }

    private function randomToken(): string
    {
        do {
            $token = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
        } while (AssetQrToken::query()->where('token', $token)->exists());

        return $token;
    }
}
