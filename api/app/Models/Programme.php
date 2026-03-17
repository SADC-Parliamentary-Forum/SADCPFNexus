<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Programme extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'created_by', 'approved_by', 'reference_number', 'title', 'status',
        'strategic_alignment', 'strategic_pillar', 'strategic_pillars', 'implementing_department',
        'implementing_departments', 'supporting_departments',
        'background', 'overall_objective', 'specific_objectives', 'expected_outputs',
        'target_beneficiaries', 'gender_considerations',
        'primary_currency', 'base_currency', 'exchange_rate', 'contingency_pct', 'total_budget',
        'funding_source', 'funding_sources', 'responsible_officer', 'responsible_officer_id',
        'responsible_officer_ids', 'start_date', 'end_date',
        'travel_required', 'delegates_count', 'member_states', 'travel_services',
        'procurement_required', 'media_options',
        'submitted_at', 'approved_at', 'rejection_reason',
    ];

    protected $casts = [
        'start_date'               => 'date',
        'end_date'                 => 'date',
        'submitted_at'             => 'datetime',
        'approved_at'              => 'datetime',
        'travel_required'          => 'boolean',
        'procurement_required'     => 'boolean',
        'exchange_rate'            => 'decimal:4',
        'contingency_pct'          => 'decimal:2',
        'total_budget'             => 'decimal:2',
        'strategic_alignment'      => 'array',
        'strategic_pillars'        => 'array',
        'implementing_departments' => 'array',
        'responsible_officer_ids'  => 'array',
        'funding_sources'          => 'array',
        'supporting_departments'   => 'array',
        'specific_objectives'      => 'array',
        'expected_outputs'        => 'array',
        'target_beneficiaries'     => 'array',
        'member_states'            => 'array',
        'travel_services'          => 'array',
        'media_options'            => 'array',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function responsibleOfficer()
    {
        return $this->belongsTo(User::class, 'responsible_officer_id');
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, User> */
    public function responsibleOfficers()
    {
        $ids = $this->responsible_officer_ids ?? [];
        if (empty($ids)) {
            return User::query()->whereRaw('1 = 0')->get();
        }
        return User::whereIn('id', $ids)->get()->sortBy(fn (User $u) => array_search($u->id, $ids));
    }

    public function activities()
    {
        return $this->hasMany(ProgrammeActivity::class);
    }

    public function milestones()
    {
        return $this->hasMany(ProgrammeMilestone::class);
    }

    public function deliverables()
    {
        return $this->hasMany(ProgrammeDeliverable::class);
    }

    public function budgetLines()
    {
        return $this->hasMany(ProgrammeBudgetLine::class);
    }

    public function procurementItems()
    {
        return $this->hasMany(ProgrammeProcurementItem::class);
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
}
