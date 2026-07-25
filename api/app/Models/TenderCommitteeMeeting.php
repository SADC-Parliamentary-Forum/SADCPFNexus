<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenderCommitteeMeeting extends Model
{
    protected $fillable = [
        'tender_committee_id', 'tenant_id', 'tender_id', 'held_at', 'title',
        'members_present', 'quorum_met', 'minutes_url', 'notes', 'recorded_by',
    ];

    protected $casts = [
        'held_at'         => 'datetime',
        'quorum_met'      => 'boolean',
        'members_present' => 'integer',
    ];

    public function committee()
    {
        return $this->belongsTo(TenderCommittee::class, 'tender_committee_id');
    }

    public function tender()
    {
        return $this->belongsTo(Tender::class);
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
