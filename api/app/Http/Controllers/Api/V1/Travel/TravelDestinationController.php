<?php

namespace App\Http\Controllers\Api\V1\Travel;

use App\Http\Controllers\Controller;
use App\Modules\Travel\Services\TravelDestinationCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TravelDestinationController extends Controller
{
    public function __construct(
        private readonly TravelDestinationCatalogService $catalog,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->catalog->listForTenant((int) $request->user()->tenant_id),
        ]);
    }

    public function storeCountry(Request $request): JsonResponse
    {
        $request->merge([
            'name' => $this->catalog->normalizeName((string) $request->input('name', '')),
        ]);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:100'],
            'is_sadc' => ['nullable', 'boolean'],
        ]);

        $result = $this->catalog->addCountry(
            $request->user(),
            $data['name'],
            array_key_exists('is_sadc', $data) ? (bool) $data['is_sadc'] : null,
        );
        $country = $result['country'];

        return response()->json([
            'message' => $result['created'] ? 'Country added.' : 'Country already in the catalog.',
            'data' => [
                'id' => $country->id,
                'name' => $country->name,
                'is_sadc' => (bool) $country->is_sadc,
            ],
        ], $result['created'] ? 201 : 200);
    }

    public function storeCity(Request $request): JsonResponse
    {
        $request->merge([
            'country' => $this->catalog->normalizeName((string) $request->input('country', '')),
            'name' => $this->catalog->normalizeName((string) $request->input('name', '')),
        ]);
        $data = $request->validate([
            'country' => ['required', 'string', 'min:1', 'max:100'],
            'name' => ['required', 'string', 'min:1', 'max:100'],
        ]);

        $result = $this->catalog->addCity($request->user(), $data['country'], $data['name']);
        $city = $result['city'];

        return response()->json([
            'message' => $result['created'] ? 'City added.' : 'City already in the catalog.',
            'data' => [
                'id' => $city->id,
                'name' => $city->name,
                'country' => $result['country']->name,
                'country_id' => $result['country']->id,
            ],
        ], $result['created'] ? 201 : 200);
    }
}
