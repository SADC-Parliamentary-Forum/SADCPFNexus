<?php
namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Vendor;
use App\Models\VendorRating;
use App\Modules\Procurement\Services\VendorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorController extends Controller
{
    public function __construct(private readonly VendorService $vendorService) {}

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
                $query->where('is_approved', true)->where('is_active', true)->where('is_blacklisted', false);
            } elseif ($request->status === 'pending') {
                $query->where('is_approved', false)->where('is_active', true)->where('is_blacklisted', false);
            } elseif ($request->status === 'inactive') {
                $query->where('is_active', false)->where('is_blacklisted', false);
            } elseif ($request->status === 'blacklisted') {
                $query->where('is_blacklisted', true);
            }
            // 'all' — no extra filter
        } else {
            // default: active, non-blacklisted
            $query->where('is_active', true)->where('is_blacklisted', false);
        }

        $vendors = $query->withAvg('ratings', 'rating')->get([
            'id', 'name', 'contact_name', 'registration_number',
            'contact_email', 'contact_phone', 'address',
            'country', 'category', 'is_sme',
            'is_approved', 'is_active', 'is_blacklisted',
            'blacklist_reason', 'created_at',
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
            'registration_number' => ['nullable', 'string', 'max:100'],
            'tax_number'          => ['nullable', 'string', 'max:100'],
            'contact_email'       => ['nullable', 'email'],
            'email'               => ['nullable', 'email'],
            'contact_phone'       => ['nullable', 'string', 'max:50'],
            'phone'               => ['nullable', 'string', 'max:50'],
            'website'             => ['nullable', 'url', 'max:255'],
            'address'             => ['nullable', 'string', 'max:500'],
            'country'             => ['nullable', 'string', 'max:100'],
            'category'            => ['nullable', 'string', 'max:100'],
            'payment_terms'       => ['nullable', 'string', 'max:50'],
            'bank_name'           => ['nullable', 'string', 'max:255'],
            'bank_account'        => ['nullable', 'string', 'max:100'],
            'bank_branch'         => ['nullable', 'string', 'max:255'],
            'is_sme'              => ['sometimes', 'boolean'],
            'notes'               => ['nullable', 'string', 'max:2000'],
            'is_approved'         => ['sometimes', 'boolean'],
        ]);

        $vendor = Vendor::create([
            'tenant_id'            => $request->user()->tenant_id,
            'name'                 => $data['name'],
            'contact_name'         => $data['contact_name'] ?? null,
            'registration_number'  => $data['registration_number'] ?? null,
            'tax_number'           => $data['tax_number'] ?? null,
            'contact_email'        => $data['contact_email'] ?? $data['email'] ?? null,
            'contact_phone'        => $data['contact_phone'] ?? $data['phone'] ?? null,
            'website'              => $data['website'] ?? null,
            'address'              => $data['address'] ?? null,
            'country'              => $data['country'] ?? null,
            'category'             => $data['category'] ?? null,
            'payment_terms'        => $data['payment_terms'] ?? null,
            'bank_name'            => $data['bank_name'] ?? null,
            'bank_account'         => $data['bank_account'] ?? null,
            'bank_branch'          => $data['bank_branch'] ?? null,
            'is_sme'               => $data['is_sme'] ?? false,
            'notes'                => $data['notes'] ?? null,
            'is_approved'          => $data['is_approved'] ?? false,
        ]);

        $payload = $vendor->loadCount('quotes')->toArray();
        $payload['email'] = $vendor->contact_email;
        return response()->json(['message' => 'Vendor created.', 'data' => $payload], 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        $user = request()->user();
        $vendor = Vendor::where('id', $vendor->id)
            ->where('tenant_id', $user->tenant_id)
            ->firstOrFail();
        $vendor->loadCount('quotes')->loadAvg('ratings', 'rating');

        // Load recent quotes with their procurement requests
        $quotes = $vendor->quotes()
            ->with(['procurementRequest:id,reference_number,title,status,category,estimated_value,currency'])
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();

        // Load ratings with rater names
        $ratings = $vendor->ratings()
            ->with('rater:id,name')
            ->orderByDesc('created_at')
            ->get();

        // My rating
        $myRating = $vendor->ratings()->where('rated_by', $user->id)->first();

        $payload = array_merge($vendor->toArray(), [
            'recent_quotes' => $quotes,
            'ratings'       => $ratings,
            'my_rating'     => $myRating,
            'ratings_count' => $ratings->count(),
        ]);
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
            'registration_number' => ['nullable', 'string', 'max:100'],
            'tax_number'          => ['nullable', 'string', 'max:100'],
            'contact_email'       => ['nullable', 'email'],
            'email'               => ['nullable', 'email'],
            'contact_phone'       => ['nullable', 'string', 'max:50'],
            'phone'               => ['nullable', 'string', 'max:50'],
            'website'             => ['nullable', 'url', 'max:255'],
            'address'             => ['nullable', 'string', 'max:500'],
            'country'             => ['nullable', 'string', 'max:100'],
            'category'            => ['nullable', 'string', 'max:100'],
            'payment_terms'       => ['nullable', 'string', 'max:50'],
            'bank_name'           => ['nullable', 'string', 'max:255'],
            'bank_account'        => ['nullable', 'string', 'max:100'],
            'bank_branch'         => ['nullable', 'string', 'max:255'],
            'is_sme'              => ['sometimes', 'boolean'],
            'notes'               => ['nullable', 'string', 'max:2000'],
            'is_approved'         => ['sometimes', 'boolean'],
            'is_active'           => ['sometimes', 'boolean'],
        ]);

        $vendor->update([
            'name'                => $data['name']                ?? $vendor->name,
            'contact_name'        => array_key_exists('contact_name', $data)  ? $data['contact_name']  : $vendor->contact_name,
            'registration_number' => array_key_exists('registration_number', $data) ? $data['registration_number'] : $vendor->registration_number,
            'tax_number'          => array_key_exists('tax_number', $data)    ? $data['tax_number']    : $vendor->tax_number,
            'contact_email'       => $data['contact_email']       ?? $data['email']       ?? $vendor->contact_email,
            'contact_phone'       => $data['contact_phone']       ?? $data['phone']       ?? $vendor->contact_phone,
            'website'             => array_key_exists('website', $data)       ? $data['website']       : $vendor->website,
            'address'             => array_key_exists('address', $data)       ? $data['address']       : $vendor->address,
            'country'             => array_key_exists('country', $data)       ? $data['country']       : $vendor->country,
            'category'            => array_key_exists('category', $data)      ? $data['category']      : $vendor->category,
            'payment_terms'       => array_key_exists('payment_terms', $data) ? $data['payment_terms'] : $vendor->payment_terms,
            'bank_name'           => array_key_exists('bank_name', $data)     ? $data['bank_name']     : $vendor->bank_name,
            'bank_account'        => array_key_exists('bank_account', $data)  ? $data['bank_account']  : $vendor->bank_account,
            'bank_branch'         => array_key_exists('bank_branch', $data)   ? $data['bank_branch']   : $vendor->bank_branch,
            'is_sme'              => array_key_exists('is_sme', $data)        ? $data['is_sme']        : $vendor->is_sme,
            'notes'               => array_key_exists('notes', $data)         ? $data['notes']         : $vendor->notes,
            'is_approved'         => array_key_exists('is_approved', $data)   ? $data['is_approved']   : $vendor->is_approved,
            'is_active'           => array_key_exists('is_active', $data)     ? $data['is_active']     : $vendor->is_active,
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

    public function approve(Request $request, Vendor $vendor): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $vendor = $this->vendorService->approveVendor($vendor, $request->user());
        return response()->json(['message' => 'Vendor approved.', 'data' => $vendor]);
    }

    public function reject(Request $request, Vendor $vendor): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $vendor = $this->vendorService->rejectVendor($vendor, $data['reason'], $request->user());
        return response()->json(['message' => 'Vendor rejected.', 'data' => $vendor]);
    }

    /**
     * List ratings for a vendor (tenant-scoped).
     */
    public function listRatings(Request $request, Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $ratings = $vendor->ratings()
            ->with('rater:id,name')
            ->orderByDesc('updated_at')
            ->get();

        $myRating = $vendor->ratings()->where('rated_by', $request->user()->id)->first();

        return response()->json([
            'data'      => $ratings,
            'avg'       => $ratings->avg('rating'),
            'count'     => $ratings->count(),
            'my_rating' => $myRating,
        ]);
    }

    /**
     * Submit or update the authenticated user's rating for a vendor.
     */
    public function storeRating(Request $request, Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'review' => ['nullable', 'string', 'max:1000'],
        ]);

        $rating = VendorRating::updateOrCreate(
            ['vendor_id' => $vendor->id, 'rated_by' => $request->user()->id],
            [
                'tenant_id' => $request->user()->tenant_id,
                'rating'    => $data['rating'],
                'review'    => $data['review'] ?? null,
            ]
        );
        $rating->load('rater:id,name');

        $avg = $vendor->ratings()->avg('rating');
        return response()->json([
            'message' => 'Rating saved.',
            'data'    => $rating,
            'avg'     => $avg,
        ]);
    }

    /**
     * List contracts for a vendor (tenant-scoped).
     */
    public function listContracts(Request $request, Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $contracts = Contract::where('vendor_id', $vendor->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('procurementRequest:id,reference_number,title')
            ->orderByDesc('start_date')
            ->get([
                'id', 'reference_number', 'title', 'value', 'currency',
                'start_date', 'end_date', 'status', 'signed_at', 'terminated_at',
                'procurement_request_id',
            ]);

        return response()->json(['data' => $contracts]);
    }

    /**
     * Blacklist a vendor. Sets is_blacklisted=true and deactivates.
     */
    public function blacklist(Request $request, Vendor $vendor): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'reason'    => ['required', 'string', 'max:2000'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        $vendor->update([
            'is_blacklisted'      => true,
            'is_active'           => false,
            'blacklisted_at'      => now(),
            'blacklisted_by'      => $request->user()->id,
            'blacklist_reason'    => $data['reason'],
            'blacklist_reference' => $data['reference'] ?? null,
        ]);

        return response()->json(['message' => 'Vendor blacklisted.', 'data' => $vendor->fresh()]);
    }

    /**
     * Remove a vendor from the blacklist and restore active status.
     */
    public function unblacklist(Request $request, Vendor $vendor): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $vendor->update([
            'is_blacklisted'      => false,
            'is_active'           => true,
            'blacklisted_at'      => null,
            'blacklisted_by'      => null,
            'blacklist_reason'    => null,
            'blacklist_reference' => null,
        ]);

        return response()->json(['message' => 'Vendor removed from blacklist.', 'data' => $vendor->fresh()]);
    }
}
