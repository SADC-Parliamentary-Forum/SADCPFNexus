<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAttestationCampaign;
use App\Models\AssetAttestationResponse;
use App\Models\AssetEquipmentTemplate;
use App\Models\AssetHandover;
use App\Models\AssetKit;
use App\Models\AssetKitItem;
use App\Models\AssetLocation;
use App\Models\AssetPlannerSlot;
use App\Models\AssetScanBasket;
use App\Models\AssetScanBasketItem;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssetPhase2Service
{
    public function __construct(private readonly AssetHandoverService $handovers) {}

    public function createBasket(User $actor): AssetScanBasket
    {
        $this->assertScan($actor);

        return AssetScanBasket::create([
            'tenant_id' => $actor->tenant_id,
            'status' => 'open',
            'created_by' => $actor->id,
        ]);
    }

    /**
     * @param  array{token?: string, nfc_uid?: string}  $data
     */
    public function addBasketItem(AssetScanBasket $basket, User $actor, array $data): AssetScanBasketItem
    {
        $this->assertScan($actor);
        $this->assertTenant($basket->tenant_id, $actor);
        if ($basket->status !== 'open') {
            throw ValidationException::withMessages(['status' => 'This scan basket is no longer open.']);
        }

        $asset = $this->resolveScannedAsset($actor, $data);
        if (AssetScanBasketItem::query()->where('basket_id', $basket->id)->where('asset_id', $asset->id)->exists()) {
            throw ValidationException::withMessages(['token' => 'This asset is already in the basket.']);
        }

        $method = isset($data['nfc_uid']) && trim((string) $data['nfc_uid']) !== '' ? 'nfc' : 'qr';

        return AssetScanBasketItem::create([
            'tenant_id' => $actor->tenant_id,
            'basket_id' => $basket->id,
            'asset_id' => $asset->id,
            'scan_method' => $method,
            'token' => $data['token'] ?? null,
            'nfc_uid' => isset($data['nfc_uid']) ? $this->normalizeNfc((string) $data['nfc_uid']) : null,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function startHandoverFromBasket(AssetScanBasket $basket, User $actor, array $data): AssetHandover
    {
        $this->assertScan($actor);
        $this->assertTenant($basket->tenant_id, $actor);
        if ($basket->status !== 'open') {
            throw ValidationException::withMessages(['status' => 'This scan basket has already started a handover.']);
        }
        $assetIds = $basket->items()->pluck('asset_id')->map(fn ($id) => (int) $id)->all();
        if ($assetIds === []) {
            throw ValidationException::withMessages(['items' => 'Scan at least one asset before starting a handover.']);
        }

        $handover = $this->handovers->create($actor, array_merge($data, [
            'asset_ids' => $assetIds,
            'keep_draft' => true,
        ]));

        $basket->status = 'started';
        $basket->handover_id = $handover->id;
        $basket->save();

        return $handover;
    }

    /**
     * @param  array{name: string, asset_ids?: list<int>, notes?: string|null}  $data
     */
    public function createKit(User $actor, array $data): AssetKit
    {
        $this->assertManage($actor);
        $kit = AssetKit::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $actor->id,
        ]);
        foreach (array_unique(array_map('intval', $data['asset_ids'] ?? [])) as $assetId) {
            $asset = Asset::query()->where('tenant_id', $actor->tenant_id)->findOrFail($assetId);
            AssetKitItem::create([
                'tenant_id' => $actor->tenant_id,
                'kit_id' => $kit->id,
                'asset_id' => $asset->id,
            ]);
        }

        return $kit->fresh(['items.asset']) ?? $kit;
    }

    public function presentKit(AssetKit $kit): array
    {
        $kit->loadMissing(['items.asset']);

        return [
            'id' => $kit->id,
            'name' => $kit->name,
            'notes' => $kit->notes,
            'items' => $kit->items->map(fn (AssetKitItem $item) => [
                'id' => $item->id,
                'asset_id' => $item->asset_id,
                'name' => $item->asset?->name,
                'tag_number' => $item->asset?->tag_number,
            ])->values()->all(),
        ];
    }

    public function setParent(Asset $asset, User $actor, ?int $parentAssetId): Asset
    {
        $this->assertManage($actor);
        $this->assertTenant($asset->tenant_id, $actor);
        if ($parentAssetId === null) {
            $asset->parent_asset_id = null;
            $asset->save();

            return $asset->fresh() ?? $asset;
        }
        if ((int) $parentAssetId === (int) $asset->id) {
            throw ValidationException::withMessages(['parent_asset_id' => 'An asset cannot be its own parent.']);
        }
        $parent = Asset::query()->where('tenant_id', $actor->tenant_id)->findOrFail($parentAssetId);
        if ($this->wouldCreateCycle($asset, $parent)) {
            throw ValidationException::withMessages(['parent_asset_id' => 'That parent would create a cycle.']);
        }
        $asset->parent_asset_id = $parent->id;
        $asset->save();

        return $asset->fresh() ?? $asset;
    }

    public function issueRoomToken(AssetLocation $location, User $actor): AssetLocation
    {
        $this->assertManage($actor);
        $this->assertTenant($location->tenant_id, $actor);
        if (! $location->qr_token) {
            $location->qr_token = 'rm_'.Str::lower(bin2hex(random_bytes(8)));
            $location->save();
        }

        return $location;
    }

    /**
     * @return array{location: array<string, mixed>, assets: list<array<string, mixed>>}
     */
    public function roomByToken(string $token, User $actor): array
    {
        $this->assertScan($actor);
        $location = AssetLocation::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('qr_token', $token)
            ->firstOrFail();

        $assets = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('location_id', $location->id)
            ->orderBy('tag_number')
            ->get(['id', 'name', 'tag_number', 'asset_code', 'status', 'category', 'condition', 'assigned_to']);

        return [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'code' => $location->code,
                'qr_token' => $location->qr_token,
            ],
            'assets' => $assets->map(fn (Asset $asset) => [
                'id' => $asset->id,
                'name' => $asset->name,
                'tag_number' => $asset->tag_number,
                'asset_code' => $asset->asset_code,
                'status' => $asset->status,
                'category' => $asset->category,
                'condition' => $asset->condition,
                'assigned_to' => $asset->assigned_to,
            ])->values()->all(),
        ];
    }

    /**
     * @param  array{name: string, role_name: string, required_categories: list<string>}  $data
     */
    public function createTemplate(User $actor, array $data): AssetEquipmentTemplate
    {
        $this->assertManage($actor);

        return AssetEquipmentTemplate::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'],
            'role_name' => $data['role_name'],
            'required_categories' => array_values($data['required_categories']),
            'created_by' => $actor->id,
        ]);
    }

    /**
     * @return array{user_id: int, missing_categories: list<string>, held_categories: list<string>}
     */
    public function templateGaps(User $actor, int $userId): array
    {
        $this->assertManage($actor);
        $user = User::query()->where('tenant_id', $actor->tenant_id)->findOrFail($userId);
        $roleNames = $user->getRoleNames()->map(fn ($name) => strtolower((string) $name))->all();
        $templates = AssetEquipmentTemplate::query()
            ->where('tenant_id', $actor->tenant_id)
            ->get()
            ->filter(fn (AssetEquipmentTemplate $template) => in_array(strtolower((string) $template->role_name), $roleNames, true));

        $required = [];
        foreach ($templates as $template) {
            foreach ((array) $template->required_categories as $category) {
                $required[strtoupper((string) $category)] = (string) $category;
            }
        }

        $held = Asset::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('assigned_to', $user->id)
            ->pluck('category')
            ->filter()
            ->map(fn ($category) => strtoupper((string) $category))
            ->unique()
            ->values()
            ->all();

        $missing = [];
        foreach ($required as $upper => $original) {
            if (! in_array($upper, $held, true)) {
                $missing[] = $original;
            }
        }

        return [
            'user_id' => $user->id,
            'missing_categories' => array_values($missing),
            'held_categories' => $held,
        ];
    }

    /**
     * @param  array{name: string, due_on?: string|null}  $data
     */
    public function createAttestation(User $actor, array $data): AssetAttestationCampaign
    {
        $this->assertManage($actor);

        return AssetAttestationCampaign::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'],
            'due_on' => $data['due_on'] ?? null,
            'status' => 'open',
            'created_by' => $actor->id,
        ]);
    }

    /**
     * @param  array{asset_ids: list<int>, confirmed?: bool}  $data
     */
    public function attest(AssetAttestationCampaign $campaign, User $actor, array $data): AssetAttestationCampaign
    {
        $this->assertTenant($campaign->tenant_id, $actor);
        if ($campaign->status !== 'open') {
            throw ValidationException::withMessages(['status' => 'This attestation campaign is closed.']);
        }
        $confirmed = array_key_exists('confirmed', $data) ? (bool) $data['confirmed'] : true;
        foreach (array_unique(array_map('intval', $data['asset_ids'] ?? [])) as $assetId) {
            $asset = Asset::query()->where('tenant_id', $actor->tenant_id)->findOrFail($assetId);
            if ((int) $asset->assigned_to !== (int) $actor->id && ! AssetAccess::canManage($actor)) {
                throw ValidationException::withMessages(['asset_ids' => 'You can only attest assets in your custody.']);
            }
            AssetAttestationResponse::updateOrCreate(
                [
                    'campaign_id' => $campaign->id,
                    'user_id' => $actor->id,
                    'asset_id' => $asset->id,
                ],
                [
                    'tenant_id' => $actor->tenant_id,
                    'confirmed' => $confirmed,
                    'attested_at' => now(),
                ]
            );
            AuditLog::record('assets.attestation_recorded', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'new_values' => [
                    'campaign_id' => $campaign->id,
                    'confirmed' => $confirmed,
                    'assigned_to' => $asset->assigned_to,
                    'status' => $asset->status,
                ],
                'tags' => 'assets',
            ]);
        }

        return $campaign->fresh(['responses']) ?? $campaign;
    }

    /**
     * @param  array{asset_id: int, to_user_id: int, notes?: string|null}  $data
     */
    public function createPlannerSlot(User $actor, array $data): AssetPlannerSlot
    {
        $handover = $this->handovers->create($actor, [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $data['to_user_id'],
            'asset_ids' => [$data['asset_id']],
            'notes' => $data['notes'] ?? null,
            'keep_draft' => true,
        ]);

        return AssetPlannerSlot::create([
            'tenant_id' => $actor->tenant_id,
            'asset_id' => $data['asset_id'],
            'to_user_id' => $data['to_user_id'],
            'handover_id' => $handover->id,
            'notes' => $data['notes'] ?? null,
            'created_by' => $actor->id,
        ]);
    }

    public function presentBasket(AssetScanBasket $basket): array
    {
        $basket->loadMissing(['items.asset']);

        return [
            'id' => $basket->id,
            'status' => $basket->status,
            'handover_id' => $basket->handover_id,
            'items' => $basket->items->map(fn (AssetScanBasketItem $item) => [
                'id' => $item->id,
                'asset_id' => $item->asset_id,
                'name' => $item->asset?->name,
                'tag_number' => $item->asset?->tag_number,
                'scan_method' => $item->scan_method,
            ])->values()->all(),
        ];
    }

    /**
     * @param  array{token?: string, nfc_uid?: string}  $data
     */
    private function resolveScannedAsset(User $actor, array $data): Asset
    {
        $nfc = isset($data['nfc_uid']) ? $this->normalizeNfc((string) $data['nfc_uid']) : '';
        $token = isset($data['token']) ? trim((string) $data['token']) : '';
        if ($token !== '' && preg_match('#/a/([A-Za-z0-9_-]+)#', $token, $matches)) {
            $token = $matches[1];
        }
        $query = Asset::query()->where('tenant_id', $actor->tenant_id);
        if ($nfc !== '') {
            $asset = (clone $query)->whereRaw('upper(nfc_uid) = ?', [$nfc])->first();
        } elseif ($token !== '') {
            $asset = (clone $query)->where('qr_token', $token)->first();
        } else {
            throw ValidationException::withMessages(['token' => 'Provide a QR token or NFC UID.']);
        }
        if (! $asset) {
            throw ValidationException::withMessages(['token' => 'No asset matches that scan.']);
        }

        return $asset;
    }

    private function normalizeNfc(string $uid): string
    {
        return strtoupper(preg_replace('/[^A-Fa-f0-9]/', '', $uid) ?? $uid);
    }

    private function wouldCreateCycle(Asset $child, Asset $parent): bool
    {
        $seen = [(int) $child->id => true];
        $current = $parent;
        $guard = 0;
        while ($current && $guard < 50) {
            if (isset($seen[(int) $current->id])) {
                return true;
            }
            $seen[(int) $current->id] = true;
            $current = $current->parentAsset;
            $guard++;
        }

        return false;
    }

    private function assertScan(User $actor): void
    {
        if (! AssetAccess::canScan($actor) && ! AssetAccess::canManageHandover($actor)) {
            abort(403, 'Not authorised to scan assets.');
        }
    }

    private function assertManage(User $actor): void
    {
        if (! AssetAccess::canManage($actor) && ! AssetAccess::canManageHandover($actor)) {
            abort(403, 'Not authorised to manage asset operations.');
        }
    }

    private function assertTenant(mixed $tenantId, User $actor): void
    {
        if ((int) $tenantId !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
