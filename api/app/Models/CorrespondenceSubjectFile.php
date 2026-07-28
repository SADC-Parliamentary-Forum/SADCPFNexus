<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CorrespondenceSubjectFile extends Model
{
    use SoftDeletes;

    protected $table = 'correspondence_subject_files';

    protected $fillable = [
        'tenant_id', 'file_code', 'title', 'description', 'parent_id', 'status', 'created_by',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function correspondence(): BelongsToMany
    {
        return $this->belongsToMany(
            Correspondence::class,
            'correspondence_file_links',
            'subject_file_id',
            'correspondence_id'
        )->withPivot(['is_primary'])->withTimestamps();
    }
}
