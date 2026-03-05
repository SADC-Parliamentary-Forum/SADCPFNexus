<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_id', 'name', 'target_date', 'achieved_date', 'completion_pct', 'status',
    ];

    protected $casts = [
        'target_date'   => 'date',
        'achieved_date' => 'date',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }
}
