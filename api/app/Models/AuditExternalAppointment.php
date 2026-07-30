<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditExternalAppointment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'firm_name', 'plenary_resolution_ref', 'appointed_on',
        'term_starts_on', 'term_ends_on', 'independence_docs_on_file',
        'independence_doc_path', 'procurement_tender_id', 'status', 'notes',
        'renewals', 'created_by',
    ];

    protected $casts = [
        'appointed_on' => 'date',
        'term_starts_on' => 'date',
        'term_ends_on' => 'date',
        'independence_docs_on_file' => 'boolean',
        'renewals' => 'array',
    ];
}
