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
        $tenantId = $request->user()->tenant_id;
        $query = Vendor::withCount('quotes')
            ->where('tenant_id', $tenantId)
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
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        $data = $request->validate([
            'name'                => ['required', 'string', 'max:300'],
            'contact_name'        => ['nullable', 'string', 'max:255'],
            'email'               => ['nullable', 'email'],
            'phone'               => ['nullable', 'string', 'max:50'],
            'category'            => ['nullable', 'string', 'max:100'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'contact_email'       => ['nullable', 'email'],
            'contact_phone'       => ['nullable', 'string', 'max:50'],
            'address'             => ['nullable', 'string', 'max:500'],
            'is_approved'         => ['sometimes', 'boolean'],
        ]);

        $vendor = Vendor::create([
            'tenant_id'            => $request->user()->tenant_id,
            'name'                 => $data['name'],
            'registration_number'  => $data['registration_number'] ?? null,
            'contact_email'        => $data['contact_email'] ?? $data['email'] ?? null,
            'contact_phone'        => $data['contact_phone'] ?? $data['phone'] ?? null,
            'address'              => $data['address'] ?? null,
            'is_approved'          => $data['is_approved'] ?? false,
        ]);

        $payload = $vendor->loadCount('quotes')->toArray();
        $payload['email'] = $vendor->contact_email;
        return response()->json(['message' => 'Vendor created.', 'data' => $payload], 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        $vendor = Vendor::where('id', $vendor->id)
            ->where('tenant_id', request()->user()->tenant_id)
            ->firstOrFail();
        $vendor->loadCount('quotes');

        // Load recent quotes with their procurement requests
        $quotes = $vendor->quotes()
            ->with(['procurementRequest:id,reference_number,title,status,category,estimated_value,currency'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        $payload = array_merge($vendor->toArray(), ['recent_quotes' => $quotes]);
        $payload['email'] = $vendor->contact_email;
        return response()->json(['data' => $payload]);
    }

    public function update(Request $request, Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        $data = $request->validate([
            'name'                => ['sometimes', 'required', 'string', 'max:300'],
            'contact_name'        => ['nullable', 'string', 'max:255'],
            'email'               => ['nullable', 'email'],
            'phone'               => ['nullable', 'string', 'max:50'],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'contact_email'       => ['nullable', 'email'],
            'contact_phone'       => ['nullable', 'string', 'max:50'],
            'address'             => ['nullable', 'string', 'max:500'],
            'is_approved'         => ['sometimes', 'boolean'],
            'is_active'           => ['sometimes', 'boolean'],
        ]);

        $vendor->update([
            'name' => $data['name'] ?? $vendor->name,
            'registration_number' => $data['registration_number'] ?? $vendor->registration_number,
            'contact_email' => $data['contact_email'] ?? $data['email'] ?? $vendor->contact_email,
            'contact_phone' => $data['contact_phone'] ?? $data['phone'] ?? $vendor->contact_phone,
            'address' => $data['address'] ?? $vendor->address,
            'is_approved' => array_key_exists('is_approved', $data) ? $data['is_approved'] : $vendor->is_approved,
            'is_active' => array_key_exists('is_active', $data) ? $data['is_active'] : $vendor->is_active,
        ]);

        $payload = $vendor->loadCount('quotes')->toArray();
        $payload['email'] = $vendor->contact_email;
        return response()->json(['message' => 'Vendor updated.', 'data' => $payload]);
    }

    public function destroy(Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) request()->user()->tenant_id) {
            abort(404);
        }
        if (!request()->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        $vendor->delete();

        return response()->json(['message' => 'Vendor deleted.']);
    }
}
