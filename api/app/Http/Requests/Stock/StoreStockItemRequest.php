<?php

namespace App\Http\Requests\Stock;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        return $user && ($user->isSystemAdmin()
            || $user->hasPermissionTo('stock.admin')
            || $user->hasPermissionTo('stock.manage')
            || $user->hasPermissionTo('stock.create'));
    }

    public function rules(): array
    {
        $tenantId = $this->user()->tenant_id;
        $tenantScoped = fn (string $table) => Rule::exists($table, 'id')->where('tenant_id', $tenantId);

        return [
            'stock_category_id'      => ['nullable', 'integer', $tenantScoped('stock_categories')],
            'item_code'              => [
                'required', 'string', 'max:64',
                Rule::unique('stock_items', 'item_code')->where('tenant_id', $tenantId),
            ],
            'name'                   => ['required', 'string', 'max:255'],
            'description'            => ['nullable', 'string', 'max:2000'],
            'unit'                   => ['nullable', 'string', 'max:32'],
            'stock_unit_id'          => ['nullable', 'integer', $tenantScoped('stock_units')],
            'unit_cost'              => ['nullable', 'numeric', 'min:0'],
            'opening_balance'        => ['nullable', 'integer', 'min:0'],
            'reorder_level'          => ['nullable', 'integer', 'min:0'],
            'storage_location'       => ['nullable', 'string', 'max:255'],
            'stock_location_id'      => ['nullable', 'integer', $tenantScoped('stock_locations')],
            'vendor_id'              => ['nullable', 'integer', $tenantScoped('vendors')],
            'procurement_request_id' => ['nullable', 'integer', $tenantScoped('procurement_requests')],
            'purchase_order_id'      => ['nullable', 'integer', $tenantScoped('purchase_orders')],
            'status'                 => ['nullable', 'string', 'in:active,archived'],
            'notes'                  => ['nullable', 'string', 'max:2000'],
        ];
    }
}
