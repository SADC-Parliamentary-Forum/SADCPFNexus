<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrFileTimelineEvent extends Model
{
    protected $fillable = [
        'tenant_id', 'hr_file_id', 'recorded_by', 'linked_document_id',
        'event_type', 'title', 'description', 'event_date', 'source_module',
    ];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
        ];
    }

    public function hrFile(): BelongsTo
    {
        return $this->belongsTo(HrPersonalFile::class, 'hr_file_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function linkedDocument(): BelongsTo
    {
        return $this->belongsTo(HrFileDocument::class, 'linked_document_id');
    }
}
