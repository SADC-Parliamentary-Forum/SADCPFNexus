<?php

namespace App\Http\Requests\Stock;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStockCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isSystemAdmin()
            || $user->hasPermissionTo('stock.admin')
            || $user->hasPermissionTo('stock.manage'));
    }

    public function rules(): array
    {
        $tenantId = $this->user()->tenant_id;
        $categoryId = $this->route('stockCategory')?->id;

        return [
            'name'       => ['sometimes', 'required', 'string', 'max:255'],
            'code'       => [
                'sometimes', 'required', 'string', 'max:32', 'regex:/^[a-z0-9_-]+$/',
                Rule::unique('stock_categories', 'code')->where('tenant_id', $tenantId)->ignore($categoryId),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtolower((string) $this->input('code'))]);
        }
    }
}
