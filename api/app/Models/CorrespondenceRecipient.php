<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceRecipient extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'correspondence_id', 'contact_id', 'recipient_type',
        'email_sent_at', 'email_status',
    ];

    protected $casts = [
        'email_sent_at' => 'datetime',
    ];

    public function contact(): BelongsTo
    {
        return $this->belongsTo(CorrespondenceContact::class);
    }

    public function correspondence(): BelongsTo
    {
        return $this->belongsTo(Correspondence::class);
    }
}
