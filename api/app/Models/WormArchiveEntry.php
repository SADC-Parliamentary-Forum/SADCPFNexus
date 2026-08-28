<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WormArchiveEntry extends Model
{
    protected $fillable = [
        'tenant_id', 'event_key', 'payload', 'content_hash', 'previous_hash', 'sequence',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }
}
