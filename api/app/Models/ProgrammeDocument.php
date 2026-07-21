<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgrammeDocument extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'programme_id', 'title', 'document_type', 'word_count',
        'translation_required', 'source_language', 'target_languages',
        'owner_user_id', 'owner_name', 'owner_organisation',
        'deadline', 'budget_line', 'comments',
    ];

    protected $casts = [
        'translation_required' => 'boolean',
        'target_languages'     => 'array',
        'deadline'              => 'date',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
