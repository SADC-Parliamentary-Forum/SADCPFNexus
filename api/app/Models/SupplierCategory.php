<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class SupplierCategory extends Model
{
    protected $fillable = [
        'tenant_id',
        'parent_id',
        'name',
        'code',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function vendors()
    {
        return $this->belongsToMany(Vendor::class, 'vendor_supplier_category')->withTimestamps();
    }

    public function procurementRequests()
    {
        return $this->belongsToMany(ProcurementRequest::class, 'procurement_request_supplier_category')->withTimestamps();
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('name');
    }

    /**
     * @param  list<int>  $categoryIds
     * @return list<int>
     */
    public static function expandWithAncestors(int $tenantId, array $categoryIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $categoryIds)));
        if ($ids === []) {
            return [];
        }

        $rows = self::query()
            ->where('tenant_id', $tenantId)
            ->get(['id', 'parent_id'])
            ->keyBy('id');

        $expanded = [];
        foreach ($ids as $id) {
            $current = $rows->get($id);
            $guard = 0;
            while ($current && $guard < 20) {
                $expanded[] = (int) $current->id;
                $current = $current->parent_id ? $rows->get((int) $current->parent_id) : null;
                $guard++;
            }
        }

        return array_values(array_unique($expanded));
    }

    /**
     * @param  list<int>  $categoryIds
     * @return list<int>
     */
    public static function expandWithDescendants(int $tenantId, array $categoryIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $categoryIds)));
        if ($ids === []) {
            return [];
        }

        $childrenByParent = self::query()
            ->where('tenant_id', $tenantId)
            ->get(['id', 'parent_id'])
            ->groupBy(fn ($row) => (int) ($row->parent_id ?? 0));

        $expanded = $ids;
        $queue = $ids;
        $guard = 0;
        while ($queue !== [] && $guard < 500) {
            $parent = array_shift($queue);
            foreach ($childrenByParent->get($parent, collect()) as $child) {
                $childId = (int) $child->id;
                if (! in_array($childId, $expanded, true)) {
                    $expanded[] = $childId;
                    $queue[] = $childId;
                }
            }
            $guard++;
        }

        return array_values(array_unique($expanded));
    }

    public static function treeForTenant(int $tenantId, bool $activeOnly = false): Collection
    {
        $query = self::query()->where('tenant_id', $tenantId)->orderBy('name');
        if ($activeOnly) {
            $query->where('is_active', true);
        }

        return $query->get();
    }
}
