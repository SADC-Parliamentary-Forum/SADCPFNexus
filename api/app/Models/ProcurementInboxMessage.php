<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProcurementInboxMessage extends Model
{
    protected $fillable = [
        'tenant_id', 'message_id', 'from_email', 'subject',
        'received_at', 'status', 'intake_id', 'payload',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'payload' => 'array',
    ];

    public function intake()
    {
        return $this->belongsTo(ProcurementDocumentIntake::class, 'intake_id');
    }
}
