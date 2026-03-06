<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory; // Added for HasFactory

class BudgetLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_id',
        'category',
        'account_code',
        'description',
        'amount_allocated',
        'amount_spent',
    ];

    public function budget()
    {
        return $this->belongsTo(Budget::class);
    }
}
