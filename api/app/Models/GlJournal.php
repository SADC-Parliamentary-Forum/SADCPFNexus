<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GlJournal extends Model
{
    protected $fillable = [
        'tenant_id', 'journal_no', 'budget_line_id', 'source_module', 'source_id',
        'status', 'memo', 'posted_by', 'posted_at',
    ];

    protected function casts(): array
    {
        return ['posted_at' => 'datetime'];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(GlJournalLine::class);
    }
}
