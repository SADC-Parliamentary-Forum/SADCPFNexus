<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeActivity extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_id', 'name', 'description', 'budget_allocation',
        'responsible', 'location', 'start_date', 'end_date', 'status',
    ];

    protected $casts = [
        'start_date'        => 'date',
        'end_date'          => 'date',
        'budget_allocation' => 'decimal:2',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }
}
