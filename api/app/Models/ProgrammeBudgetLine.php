<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProgrammeBudgetLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'programme_id', 'category', 'description', 'amount', 'actual_spent',
        'funding_source', 'account_code', 'org_budget_line_id',
    ];

    protected $casts = [
        'amount'       => 'decimal:2',
        'actual_spent' => 'decimal:2',
    ];

    public function programme()
    {
        return $this->belongsTo(Programme::class);
    }

    public function orgBudgetLine()
    {
        return $this->belongsTo(BudgetLine::class, 'org_budget_line_id');
    }
}
