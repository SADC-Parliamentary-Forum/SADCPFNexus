<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WorkplanEvent extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'created_by', 'title', 'type', 'date', 'end_date',
        'description', 'responsible', 'linked_module', 'linked_id',
    ];

    protected $casts = [
        'date'     => 'date',
        'end_date' => 'date',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
