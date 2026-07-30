<?php

namespace App\Models\Documents;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRetentionCampaign extends Model
{
    protected $table = 'document_retention_campaigns';

    protected $fillable = [
        'tenant_id', 'name', 'status', 'cutoff_date', 'candidate_count',
        'held_count', 'disposed_count', 'created_by', 'filters',
    ];

    protected function casts(): array
    {
        return [
            'cutoff_date' => 'date',
            'candidate_count' => 'integer',
            'held_count' => 'integer',
            'disposed_count' => 'integer',
            'filters' => 'array',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
