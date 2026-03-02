<?php
namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $vendors = Vendor::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'registration_number', 'contact_email', 'is_approved']);

        return response()->json(['data' => $vendors]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                => ['required', 'string', 'max:300'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'contact_email'       => ['nullable', 'email'],
            'contact_phone'       => ['nullable', 'string', 'max:50'],
            'address'             => ['nullable', 'string', 'max:500'],
        ]);

        $vendor = Vendor::create([...$data, 'tenant_id' => $request->user()->tenant_id]);

        return response()->json(['message' => 'Vendor created.', 'data' => $vendor], 201);
    }
}
