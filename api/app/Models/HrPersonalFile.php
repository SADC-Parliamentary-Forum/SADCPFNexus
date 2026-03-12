<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrPersonalFile extends Model
{
    protected $fillable = [
        'tenant_id', 'employee_id', 'created_by', 'current_hr_officer_id',
        'department_id', 'supervisor_id', 'file_status', 'confidentiality_classification',
        'staff_number', 'date_of_birth', 'gender', 'nationality', 'id_passport_number',
        'marital_status', 'residential_address', 'emergency_contact_name',
        'emergency_contact_relationship', 'emergency_contact_phone', 'next_of_kin_details',
        'appointment_date', 'employment_status', 'contract_type', 'probation_status',
        'confirmation_date', 'current_position', 'grade_scale', 'contract_expiry_date',
        'separation_date', 'separation_reason', 'promotion_history', 'transfer_history',
        'payroll_number', 'latest_appraisal_summary', 'active_warning_flag',
        'commendation_count', 'open_development_action_count', 'training_hours_current_cycle',
        'last_file_review_date', 'archival_status',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'appointment_date' => 'date',
            'confirmation_date' => 'date',
            'contract_expiry_date' => 'date',
            'separation_date' => 'date',
            'last_file_review_date' => 'date',
            'promotion_history' => 'array',
            'transfer_history' => 'array',
            'active_warning_flag' => 'boolean',
            'archival_status' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function hrOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_hr_officer_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(HrFileDocument::class, 'hr_file_id');
    }

    public function timelineEvents(): HasMany
    {
        return $this->hasMany(HrFileTimelineEvent::class, 'hr_file_id');
    }
}
