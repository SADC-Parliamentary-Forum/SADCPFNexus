<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BalanceAcknowledgement extends Model
{
    protected $fillable = [
        'register_id', 'transaction_id', 'employee_id',
        'status', 'dispute_reason', 'responded_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
    ];

    public function register()
    {
        return $this->belongsTo(BalanceRegister::class, 'register_id');
    }

    public function transaction()
    {
        return $this->belongsTo(BalanceTransaction::class, 'transaction_id');
    }

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }
}
