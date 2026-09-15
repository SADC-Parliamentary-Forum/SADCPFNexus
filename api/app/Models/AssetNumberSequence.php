<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetNumberSequence extends Model
{
    protected $fillable = ['tenant_id', 'category_code', 'subcategory_code', 'next_number'];

    protected function casts(): array
    {
        return ['next_number' => 'integer'];
    }
}
