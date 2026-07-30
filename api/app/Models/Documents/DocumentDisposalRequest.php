<?php

namespace App\Models\Documents;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentDisposalRequest extends Model
{
    protected $table = 'document_disposal_requests';

    protected $fillable = [
        'tenant_id', 'managed_document_id', 'requested_by', 'status',
        'reason', 'decided_by', 'decided_at', 'decision_notes',
    ];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(ManagedDocument::class, 'managed_document_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
