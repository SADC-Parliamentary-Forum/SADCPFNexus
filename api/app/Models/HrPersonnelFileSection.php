<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class HrPersonnelFileSection extends Model
{
    use SoftDeletes;

    protected $table = 'hr_personnel_file_sections';

    protected $fillable = [
        'tenant_id',
        'section_code',
        'section_name',
        'visibility',
        'is_editable_by_employee',
        'is_mandatory',
        'retention_months',
        'confidentiality_level',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_editable_by_employee' => 'boolean',
        'is_mandatory'            => 'boolean',
        'is_active'               => 'boolean',
        'retention_months'        => 'integer',
        'sort_order'              => 'integer',
    ];
}
