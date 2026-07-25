<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TenderCommitteeMember extends Model
{
    protected $fillable = [
        'tender_committee_id', 'user_id', 'role', 'joined_at', 'left_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'left_at'   => 'datetime',
    ];

    public function committee()
    {
        return $this->belongsTo(TenderCommittee::class, 'tender_committee_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
