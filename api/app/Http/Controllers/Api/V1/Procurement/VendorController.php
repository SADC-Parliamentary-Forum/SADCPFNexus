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
        $query = Vendor::withCount('quotes')
            ->orderBy('name');

        if ($request->filled('search')) {
            $q = '%' . $request->search . '%';
            $query->where(function ($qb) use ($q) {
                $qb->where('name', 'like', $q)
                   ->orWhere('registration_number', 'like', $q)
                   ->orWhere('contact_email', 'like', $q);
            });
        }

        if ($request->filled('status')) {
            if ($request->status === 'approved') {
                $query->where('is_approved', true);
            } elseif ($request->status === 'pending') {
                $query->where('is_approved', false);
            } elseif ($request->status === 'inactive') {
                $query->where('is_active', false);
            } else {
                // 'all' — no extra filter
            }
        } else {
            // default: active only
            $query->where('is_active', true);
        }

        $vendors = $query->get([
            'id', 'name', 'registration_number',
            'contact_email', 'contact_phone', 'address',
            'is_approved', 'is_active', 'created_at',
        ]);

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
            'is_approved'         => ['sometimes', 'boolean'],
        ]);

        $vendor = Vendor::create([...$data, 'tenant_id' => $request->user()->tenant_id]);

        return response()->json(['message' => 'Vendor created.', 'data' => $vendor->loadCount('quotes')], 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        $vendor->loadCount('quotes');

        // Load recent quotes with their procurement requests
        $quotes = $vendor->quotes()
            ->with(['procurementRequest:id,reference_number,title,status,category,estimated_value,currency'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => array_merge($vendor->toArray(), ['recent_quotes' => $quotes]),
        ]);
    }

    public function update(Request $request, Vendor $vendor): JsonResponse
    {
        $data = $request->validate([
            'name'                => ['sometimes', 'required', 'string', 'max:300'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'contact_email'       => ['nullable', 'email'],
            'contact_phone'       => ['nullable', 'string', 'max:50'],
            'address'             => ['nullable', 'string', 'max:500'],
            'is_approved'         => ['sometimes', 'boolean'],
            'is_active'           => ['sometimes', 'boolean'],
        ]);

        $vendor->update($data);

        return response()->json(['message' => 'Vendor updated.', 'data' => $vendor->loadCount('quotes')]);
    }

    public function destroy(Vendor $vendor): JsonResponse
    {
        // Soft-delete by marking inactive rather than hard deleting (preserves quote history)
        $vendor->update(['is_active' => false]);

        return response()->json(['message' => 'Vendor deactivated.']);
    }
}
