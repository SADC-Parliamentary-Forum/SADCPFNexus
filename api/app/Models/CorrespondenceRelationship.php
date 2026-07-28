<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceRelationship extends Model
{
    protected $table = 'correspondence_relationships';

    protected $fillable = [
        'from_correspondence_id', 'to_correspondence_id', 'type', 'created_by',
    ];

    public function from(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class, 'from_correspondence_id');
    }

    public function to(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class, 'to_correspondence_id');
    }
}
