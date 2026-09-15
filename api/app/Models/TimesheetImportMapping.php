<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetImportMapping extends Model
{
    public const KIND_EMPLOYEE_EMAIL = 'employee_email';

    public const KIND_PROJECT = 'project';

    public const KIND_ACTIVITY = 'activity';

    public const KIND_DEPARTMENT = 'department';

    protected $fillable = [
        'tenant_id', 'kind', 'historical_value', 'nexus_value', 'mapped_user_id', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'bool',
        ];
    }

    public function mappedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mapped_user_id');
    }
}
