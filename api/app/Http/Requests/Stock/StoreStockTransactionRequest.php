<?php

namespace App\Http\Requests\Stock;

use App\Models\StockTransaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isSystemAdmin()
            || $user->hasPermissionTo('stock.admin')
            || $user->hasPermissionTo('stock.manage')
            || $user->hasPermissionTo('stock.issue'));
    }

    public function rules(): array
    {
        $tenantId = $this->user()->tenant_id;
        $tenantScoped = fn (string $table) => Rule::exists($table, 'id')->where('tenant_id', $tenantId);

        return [
            'stock_item_id'           => ['required', 'integer', $tenantScoped('stock_items')],
            'type'                    => ['required', Rule::in(StockTransaction::TYPES)],
            // Magnitude for in/out; adjustments may be negative (handled in service).
            'quantity'                => ['required', 'integer'],
            'issued_to_user_id'       => ['nullable', 'integer', $tenantScoped('users')],
            'issued_to_department_id' => ['nullable', 'integer', $tenantScoped('departments')],
            'issued_to_other'         => ['nullable', 'string', 'max:255'],
            'unit_cost'               => ['nullable', 'numeric', 'min:0'],
            'reference'               => ['nullable', 'string', 'max:255'],
            'reason'                  => ['nullable', 'string', 'max:255'],
            'reason_code'             => ['nullable', 'string', Rule::in(StockTransaction::REASON_CODES)],
            'stock_location_id'       => ['nullable', 'integer', $tenantScoped('stock_locations')],
            'notes'                   => ['nullable', 'string', 'max:2000'],
            'transaction_date'        => ['required', 'date'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('type');
            $qty = (int) $this->input('quantity');

            if (in_array($type, [StockTransaction::TYPE_IN, StockTransaction::TYPE_OUT], true) && $qty < 1) {
                $validator->errors()->add('quantity', 'Quantity must be at least 1 for stock-in and stock-out movements.');
            }

            if ($type === StockTransaction::TYPE_ADJUSTMENT && $qty === 0) {
                $validator->errors()->add('quantity', 'Adjustment quantity cannot be zero.');
            }
        });
    }
}
