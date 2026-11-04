<?php

use App\Modules\Assets\Import\AssetCategoryMapper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Assets stored a category's display name or alias ("IT Equipment", "Fleet") next to its catalog
 * code ("it", "fleet"), so the register showed IT Equipment as two categories. Rewrite every
 * known name/alias to its code; values the catalog does not know are left alone.
 */
return new class extends Migration
{
    public function up(): void
    {
        $values = DB::table('assets')->whereNotNull('category')->distinct()->pluck('category');
        foreach ($values as $value) {
            $code = AssetCategoryMapper::toCode((string) $value);
            if ($code !== null && $code !== $value) {
                DB::table('assets')->where('category', $value)->update(['category' => $code]);
            }
        }
    }

    public function down(): void
    {
        // Not reversible: the original spelling of each value is not kept, and the codes are the correct data.
    }
};
