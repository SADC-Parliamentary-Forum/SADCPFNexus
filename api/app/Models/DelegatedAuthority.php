<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class DelegatedAuthority extends Model
{
    protected $fillable = [
        'tenant_id',
        'principal_user_id',
        'delegate_user_id',
        'start_date',
        'end_date',
        'role_scope',
        'module',
        'can_draft',
        'can_submit',
        'can_upload',
        'can_act_on_behalf',
        'requires_principal_confirmation',
        'reason',
        'created_by',
        'activated_notified_at',
        'expired_notified_at',
    ];

    protected $casts = [
        'start_date'                      => 'date',
        'end_date'                        => 'date',
        'can_draft'                       => 'boolean',
        'can_submit'                      => 'boolean',
        'can_upload'                      => 'boolean',
        'can_act_on_behalf'               => 'boolean',
        'requires_principal_confirmation' => 'boolean',
        'activated_notified_at'           => 'datetime',
        'expired_notified_at'             => 'datetime',
    ];

    public function principal(): BelongsTo
    {
        return $this->belongsTo(User::class, 'principal_user_id');
    }

    public function delegate(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegate_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isActive(): bool
    {
        $today = Carbon::today();
        return $today->greaterThanOrEqualTo($this->start_date)
            && $today->lessThanOrEqualTo($this->end_date);
    }

    /** Active (date-valid) delegations for a tenant. */
    public function scopeActive(Builder $query): Builder
    {
        $today = Carbon::today()->toDateString();
        return $query->whereDate('start_date', '<=', $today)
                     ->whereDate('end_date', '>=', $today);
    }

    /**
     * Does this delegation permit a given action for a module?
     *
     * @param  string  $action  one of draft|submit|upload|act_on_behalf
     */
    public function permits(string $action, ?string $module = null): bool
    {
        if (!$this->isActive()) {
            return false;
        }

        // A null module on the delegation means "any module".
        if ($this->module !== null && $module !== null && $this->module !== $module) {
            return false;
        }

        return match ($action) {
            'draft'         => (bool) $this->can_draft,
            'submit'        => (bool) $this->can_submit,
            'upload'        => (bool) $this->can_upload,
            'act_on_behalf' => (bool) $this->can_act_on_behalf,
            default         => false,
        };
    }

    /**
     * Find the active delegation (if any) authorising $delegate to act for
     * $principal on $module/$action. Returns the most specific match.
     */
    public static function resolve(int $delegateId, int $principalId, string $action, ?string $module = null): ?self
    {
        return static::query()
            ->active()
            ->where('delegate_user_id', $delegateId)
            ->where('principal_user_id', $principalId)
            ->where(function (Builder $q) use ($module) {
                $q->whereNull('module');
                if ($module !== null) {
                    $q->orWhere('module', $module);
                }
            })
            ->orderByRaw('module IS NULL') // prefer a module-specific row over a wildcard
            ->get()
            ->first(fn (self $d) => $d->permits($action, $module));
    }
}
