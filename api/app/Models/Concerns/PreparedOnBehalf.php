<?php

namespace App\Models\Concerns;

use App\Models\DelegatedAuthority;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * WS1 — shared "prepared on behalf of" relations for workflowable request
 * models (Programme/PIF, Travel, Leave, Salary Advance, Procurement).
 *
 * The owning model must have nullable `prepared_by`, `prepared_on_behalf_of`
 * and `delegated_authority_id` columns (see the 2026_06_25 migration) and
 * include them in its $fillable.
 */
trait PreparedOnBehalf
{
    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function preparedOnBehalfOf(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_on_behalf_of');
    }

    public function delegatedAuthority(): BelongsTo
    {
        return $this->belongsTo(DelegatedAuthority::class, 'delegated_authority_id');
    }

    /** True when this request was prepared by someone other than its owner. */
    public function wasPreparedOnBehalf(): bool
    {
        return $this->prepared_on_behalf_of !== null
            && (int) $this->prepared_by !== (int) $this->prepared_on_behalf_of;
    }
}
