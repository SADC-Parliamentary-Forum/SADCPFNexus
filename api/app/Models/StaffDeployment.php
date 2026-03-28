<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class StaffDeployment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'employee_id', 'parliament_id', 'reference_number',
        'deployment_type', 'research_area', 'research_focus', 'start_date', 'end_date', 'status',
        'supervisor_name', 'supervisor_title', 'supervisor_email', 'supervisor_phone',
        'terms_of_reference', 'hr_managed_externally', 'payroll_active', 'notes',
        'created_by', 'recalled_at', 'recalled_reason',
    ];

    protected function casts(): array
    {
        return [
            'start_date'            => 'date',
            'end_date'              => 'date',
            'recalled_at'           => 'datetime',
            'hr_managed_externally' => 'boolean',
            'payroll_active'        => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function parliament(): BelongsTo
    {
        return $this->belongsTo(Parliament::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(ResearcherReport::class, 'deployment_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public static function generateReference(int $tenantId): string
    {
        $year = now()->year;
        $count = static::withTrashed()
            ->where('tenant_id', $tenantId)
            ->whereYear('created_at', $year)
            ->count();
        $seq = str_pad($count + 1, 3, '0', STR_PAD_LEFT);
        return "DPMT-{$year}-{$seq}";
    }
}
