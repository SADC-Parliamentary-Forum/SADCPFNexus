<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\BudgetLine;
use App\Models\User;

class Budget extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'year',
        'name',
        'type',
        'currency',
        'total_amount',
        'description',
        'created_by',
    ];

    public function lines()
    {
        return $this->hasMany(BudgetLine::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
