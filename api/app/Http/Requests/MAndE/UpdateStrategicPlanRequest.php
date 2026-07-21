<?php

namespace App\Http\Requests\MAndE;

use Illuminate\Foundation\Http\FormRequest;

class UpdateStrategicPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'        => ['sometimes', 'string', 'max:300'],
            'period'      => ['nullable', 'string', 'max:50'],
            'start_date'  => ['nullable', 'date'],
            'end_date'    => ['nullable', 'date', 'after_or_equal:start_date'],
            'status'      => ['nullable', 'string', 'in:draft,active,archived'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
