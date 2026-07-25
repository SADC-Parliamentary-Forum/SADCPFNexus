<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TenderCommittee extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'name', 'code', 'quorum_minimum', 'is_standing', 'is_active', 'notes', 'created_by',
    ];

    protected $casts = [
        'is_standing'    => 'boolean',
        'is_active'      => 'boolean',
        'quorum_minimum' => 'integer',
    ];

    public function members()
    {
        return $this->hasMany(TenderCommitteeMember::class);
    }

    public function meetings()
    {
        return $this->hasMany(TenderCommitteeMeeting::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tenders()
    {
        return $this->hasMany(Tender::class);
    }

    public function activeMemberCount(): int
    {
        return $this->members()->whereNull('left_at')->count();
    }

    public function quorumMet(int $membersPresent): bool
    {
        $minimum = max(1, (int) $this->quorum_minimum);

        return $membersPresent >= $minimum;
    }
}
