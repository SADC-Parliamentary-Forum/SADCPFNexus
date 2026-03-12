<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppraisalKra extends Model
{
    protected $fillable = [
        'appraisal_id', 'title', 'description', 'weight',
        'self_rating', 'self_comments',
        'supervisor_rating', 'supervisor_comments', 'sort_order',
    ];

    public function appraisal(): BelongsTo
    {
        return $this->belongsTo(Appraisal::class);
    }
}
