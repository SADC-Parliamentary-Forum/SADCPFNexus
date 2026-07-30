<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class PeopleDirectorySyncRun extends Model
{
    protected $table = 'people_directory_sync_runs';

    protected $fillable = [
        'tenant_id',
        'driver',
        'dry_run',
        'status',
        'fetched_count',
        'matched_count',
        'created_count',
        'updated_count',
        'skipped_count',
        'summary',
        'error_message',
        'started_by',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'dry_run' => 'boolean',
        'summary' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];
}
