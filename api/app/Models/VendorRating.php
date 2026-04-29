<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendorRating extends Model
{
    protected $fillable = ['tenant_id', 'vendor_id', 'rated_by', 'rating', 'review'];

    protected $casts = ['rating' => 'integer'];

    public function rater()
    {
        return $this->belongsTo(User::class, 'rated_by');
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }
}
