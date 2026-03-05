<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeDeliverable extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_id', 'name', 'description', 'due_date', 'status',
    ];

    protected $casts = [
        'due_date' => 'date',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }
}
