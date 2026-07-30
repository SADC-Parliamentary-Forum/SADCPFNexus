<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PersonDocument extends Model
{
    use SoftDeletes;

    protected $table = 'person_documents';

    protected $fillable = [
        'tenant_id',
        'person_id',
        'file_class',
        'document_type',
        'title',
        'storage_path',
        'content_hash',
        'managed_document_id',
        'document_version_id',
        'is_immutable',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'is_immutable' => 'boolean',
        ];
    }
}
