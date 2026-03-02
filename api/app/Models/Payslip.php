<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payslip extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'period_month',
        'period_year',
        'gross_amount',
        'net_amount',
        'currency',
        'file_path',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'decimal:2',
            'net_amount'   => 'decimal:2',
            'issued_at'    => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function getPeriodLabelAttribute(): string
    {
        $months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return ($months[$this->period_month] ?? $this->period_month) . ' ' . $this->period_year;
    }
}
