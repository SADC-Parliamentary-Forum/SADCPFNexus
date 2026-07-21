<?php

namespace App\Http\Requests\MAndE;

use Illuminate\Foundation\Http\FormRequest;

class UpdateIndicatorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'                   => ['sometimes', 'string', 'max:500'],
            'result_level'           => ['sometimes', 'string', 'in:impact,outcome,output,activity'],
            'unit'                   => ['nullable', 'string', 'max:80'],
            'baseline_value'         => ['nullable', 'numeric'],
            'baseline_year'          => ['nullable', 'string', 'max:20'],
            'annual_target'          => ['nullable', 'numeric'],
            'cumulative_target'      => ['nullable', 'numeric'],
            'disaggregation'         => ['nullable', 'array'],
            'disaggregation.*'       => ['string', 'max:60'],
            'data_source'            => ['nullable', 'string', 'max:300'],
            'evidence_required'      => ['nullable', 'boolean'],
            'frequency'              => ['nullable', 'string', 'in:monthly,quarterly,bi_annual,annual'],
            'responsible_person_id'  => ['nullable', 'integer', 'exists:users,id'],
            'is_active'              => ['nullable', 'boolean'],
            'description'            => ['nullable', 'string', 'max:2000'],
            'results_framework_id'   => ['nullable', 'integer', 'exists:results_frameworks,id'],
            'strategic_objective_id' => ['nullable', 'integer', 'exists:strategic_objectives,id'],
            'strategic_output_id'    => ['nullable', 'integer', 'exists:strategic_outputs,id'],
            'programme_id'           => ['nullable', 'integer', 'exists:programmes,id'],
        ];
    }
}
