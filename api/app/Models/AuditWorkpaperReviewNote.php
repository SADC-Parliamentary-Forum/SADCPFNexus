<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditWorkpaperReviewNote extends Model
{
    protected $fillable = [
        'tenant_id', 'workpaper_id', 'author_id', 'note',
    ];
}
