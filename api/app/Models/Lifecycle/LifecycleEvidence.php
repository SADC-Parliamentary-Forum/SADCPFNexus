<?php

namespace App\Models\Lifecycle;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LifecycleEvidence extends Model
{
    protected $table = 'lifecycle_evidence';

    protected $fillable = [
        'tenant_id',
        'case_id',
        'task_instance_id',
        'document_id',
        'filename',
        'uploaded_by',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(LifecycleTaskInstance::class, 'task_instance_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
