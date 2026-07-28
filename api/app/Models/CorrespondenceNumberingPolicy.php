<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorrespondenceNumberingPolicy extends Model
{
    protected $table = 'correspondence_numbering_policies';

    protected $fillable = [
        'tenant_id', 'incoming_pattern', 'outgoing_pattern',
        'incoming_seq_padding', 'outgoing_seq_padding', 'assign_outgoing_on_approve',
    ];

    protected $casts = [
        'assign_outgoing_on_approve' => 'boolean',
        'incoming_seq_padding' => 'integer',
        'outgoing_seq_padding' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function forTenant(int $tenantId): self
    {
        return static::firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'incoming_pattern' => 'IN/{year}/{seq}',
                'outgoing_pattern' => '{file}/{signatory}/{preparer}/{seq}/{year}',
                'incoming_seq_padding' => 5,
                'outgoing_seq_padding' => 4,
                'assign_outgoing_on_approve' => true,
            ]
        );
    }
}
