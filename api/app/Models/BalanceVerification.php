<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BalanceVerification extends Model
{
    protected $fillable = [
        'transaction_id', 'verified_by', 'status', 'comments', 'verified_at',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public function transaction()
    {
        return $this->belongsTo(BalanceTransaction::class, 'transaction_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
