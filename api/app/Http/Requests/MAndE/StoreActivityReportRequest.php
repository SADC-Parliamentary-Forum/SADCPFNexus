<?php

namespace App\Http\Requests\MAndE;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreActivityReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'programme_id'           => ['nullable', 'integer', 'exists:programmes,id'],
            'non_pif_reason'         => ['nullable', 'string', 'max:2000'],
            'activity_title'         => ['required', 'string', 'max:500'],
            'responsible_officer_id' => ['nullable', 'integer', 'exists:users,id'],
            'thematic_area_id'       => ['nullable', 'integer', 'exists:me_thematic_areas,id'],
            'strategic_goal_id'      => ['nullable', 'integer', 'exists:strategic_goals,id'],
            'start_date'             => ['nullable', 'date'],
            'end_date'               => ['nullable', 'date', 'after_or_equal:start_date'],
            'planned_output'         => ['nullable', 'string', 'max:5000'],
            'actual_output'          => ['nullable', 'string', 'max:5000'],
            'planned_participants'   => ['nullable', 'integer', 'min:0'],
            'actual_participants'    => ['nullable', 'integer', 'min:0'],
            'narrative'              => ['nullable', 'string', 'max:10000'],
            'challenges'             => ['nullable', 'string', 'max:5000'],
            'lessons_learned'        => ['nullable', 'string', 'max:5000'],
            'recommendations'        => ['nullable', 'string', 'max:5000'],
            'follow_up_actions'      => ['nullable', 'string', 'max:5000'],
            'indicators'             => ['nullable', 'array'],
            'indicators.*.indicator_id'  => ['required', 'integer', 'exists:indicators,id'],
            'indicators.*.planned_value' => ['nullable', 'numeric'],
            'indicators.*.actual_value'  => ['nullable', 'numeric'],
            'indicators.*.notes'         => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $programmeId = $this->input('programme_id');
            $reason = trim((string) $this->input('non_pif_reason', ''));
            if (! $programmeId && strlen($reason) < 5) {
                $v->errors()->add('non_pif_reason', 'A reason is required when creating a non-PIF activity report.');
            }
        });
    }
}
