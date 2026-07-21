<?php

namespace App\Http\Requests\MAndE;

use Illuminate\Foundation\Http\FormRequest;

class StoreResultsFrameworkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'              => ['required', 'string', 'max:300'],
            'type'              => ['nullable', 'string', 'in:sadc_pf,srhr,giz,donor,institutional'],
            'donor_name'        => ['nullable', 'string', 'max:200'],
            'description'       => ['nullable', 'string', 'max:5000'],
            'strategic_plan_id' => ['nullable', 'integer', 'exists:strategic_plans,id'],
            'strategic_goal_id' => ['nullable', 'integer', 'exists:strategic_goals,id'],
            'start_date'        => ['nullable', 'date'],
            'end_date'          => ['nullable', 'date', 'after_or_equal:start_date'],
            'status'            => ['nullable', 'string', 'in:active,inactive,archived'],
        ];
    }
}
