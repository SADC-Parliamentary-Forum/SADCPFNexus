<?php

namespace App\Models\Documents;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentGovernanceDecision extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_DECIDED = 'decided';
    public const STATUS_NOT_APPLICABLE = 'not_applicable';

    protected $table = 'document_governance_decisions';

    protected $fillable = [
        'tenant_id', 'decision_key', 'sort_order', 'title', 'description',
        'status', 'decision_notes', 'decided_by', 'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'decided_at' => 'datetime',
        ];
    }

    public function decidedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
