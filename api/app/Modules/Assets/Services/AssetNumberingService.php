<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetNumberingPolicy;
use App\Models\AssetNumberSequence;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetNumberingService
{
    public function policy(int $tenantId): AssetNumberingPolicy
    {
        return AssetNumberingPolicy::query()->firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'prefix' => 'PF',
                'separator' => '/',
                'sequence_length' => 3,
                'include_category' => true,
                'include_subcategory' => true,
                'auto_assign' => true,
            ]
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updatePolicy(User $actor, array $data): AssetNumberingPolicy
    {
        if (! AssetAccess::canManage($actor)) {
            abort(403);
        }
        $policy = $this->policy((int) $actor->tenant_id);
        $policy->fill([
            'prefix' => strtoupper((string) ($data['prefix'] ?? $policy->prefix)),
            'separator' => (string) ($data['separator'] ?? $policy->separator),
            'sequence_length' => (int) ($data['sequence_length'] ?? $policy->sequence_length),
            'include_category' => (bool) ($data['include_category'] ?? $policy->include_category),
            'include_subcategory' => (bool) ($data['include_subcategory'] ?? $policy->include_subcategory),
            'auto_assign' => (bool) ($data['auto_assign'] ?? $policy->auto_assign),
            'updated_by' => $actor->id,
        ]);
        $policy->save();

        return $policy->fresh();
    }

    public function issue(int $tenantId, string $categoryCode, ?string $subcategoryCode = null): string
    {
        $policy = $this->policy($tenantId);
        $category = strtoupper(trim($categoryCode));
        $sub = $subcategoryCode ? strtoupper(trim($subcategoryCode)) : '';

        return DB::transaction(function () use ($policy, $tenantId, $category, $sub) {
            $seq = AssetNumberSequence::query()
                ->where('tenant_id', $tenantId)
                ->where('category_code', $category)
                ->where('subcategory_code', $sub)
                ->lockForUpdate()
                ->first();

            if (! $seq) {
                $seq = AssetNumberSequence::create([
                    'tenant_id' => $tenantId,
                    'category_code' => $category,
                    'subcategory_code' => $sub,
                    'next_number' => 1,
                ]);
                $seq = AssetNumberSequence::query()->where('id', $seq->id)->lockForUpdate()->first();
            }

            $n = (int) $seq->next_number;
            $seq->next_number = $n + 1;
            $seq->save();

            $parts = [$policy->prefix];
            $sep = $policy->separator ?: '/';
            if ($policy->include_category) {
                $parts[] = $category;
            }
            if ($policy->include_subcategory && $sub) {
                $parts[] = $sub;
            }
            $parts[] = str_pad((string) $n, max(1, (int) $policy->sequence_length), '0', STR_PAD_LEFT);
            $tag = implode($sep, $parts);

            $exists = Asset::query()->where('tenant_id', $tenantId)->where(function ($q) use ($tag) {
                $q->where('tag_number', $tag)->orWhere('asset_code', $tag);
            })->exists();
            if ($exists) {
                throw ValidationException::withMessages(['tag_number' => 'Generated asset number already exists.']);
            }

            return $tag;
        });
    }
}
