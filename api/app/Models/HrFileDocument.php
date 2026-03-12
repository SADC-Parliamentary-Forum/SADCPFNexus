<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class HrFileDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'hr_file_id', 'uploaded_by', 'verified_by',
        'document_type', 'title', 'description', 'file_path', 'file_name',
        'file_size', 'confidentiality_level', 'issue_date', 'effective_date',
        'expiry_date', 'verified_at', 'source_module', 'version', 'tags', 'remarks',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'effective_date' => 'date',
            'expiry_date' => 'date',
            'verified_at' => 'datetime',
            'tags' => 'array',
        ];
    }

    public function hrFile(): BelongsTo
    {
        return $this->belongsTo(HrPersonalFile::class, 'hr_file_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
