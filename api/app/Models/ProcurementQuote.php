<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class ProcurementQuote extends Model
{
    protected $fillable = [
        'procurement_request_id',
        'rfq_invitation_id',
        'vendor_id',
        'submitted_by_user_id',
        'vendor_name',
        'quoted_amount',
        'currency',
        'submission_channel',
        'is_recommended',
        'compliance_passed',
        'compliance_notes',
        'assessed_by',
        'assessed_at',
        'notes',
        'quote_date',
    ];

    protected $casts = [
        'quote_date'         => 'date',
        'is_recommended'     => 'boolean',
        'compliance_passed'  => 'boolean',
        'assessed_at'        => 'datetime',
    ];

    public function procurementRequest() { return $this->belongsTo(ProcurementRequest::class); }
    public function vendor()             { return $this->belongsTo(Vendor::class); }
    public function invitation()         { return $this->belongsTo(RfqInvitation::class, 'rfq_invitation_id'); }
    public function submitter()          { return $this->belongsTo(User::class, 'submitted_by_user_id'); }
    public function assessor()           { return $this->belongsTo(User::class, 'assessed_by'); }
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }
}
