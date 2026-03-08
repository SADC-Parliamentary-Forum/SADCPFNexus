<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrIncident extends Model
{
    protected $fillable = [
        'tenant_id', 'reported_by', 'reference_number', 'subject', 'description',
        'status', 'severity', 'reported_at',
    ];

    protected function casts(): array
    {
        return ['reported_at' => 'datetime'];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public static function generateReferenceNumber(): string
    {
        $year = date('Y');
        $last = static::where('reference_number', 'like', $year . '-%')->orderByDesc('id')->first();
        $seq = $last ? (int) substr($last->reference_number, -3) + 1 : 1;
        return $year . '-' . str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
    }
}
