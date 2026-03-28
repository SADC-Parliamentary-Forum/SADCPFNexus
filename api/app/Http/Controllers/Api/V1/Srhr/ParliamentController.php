<?php

namespace App\Http\Controllers\Api\V1\Srhr;

use App\Http\Controllers\Controller;
use App\Models\Parliament;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParliamentController extends Controller
{
    private function checkPerm(Request $request, string $permission): void
    {
        $user = $request->user();
        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo($permission, 'sanctum'), 403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'parliaments.view');
        $user = $request->user();

        $query = Parliament::where('tenant_id', $user->tenant_id)
            ->withCount(['deployments', 'activeDeployments'])
            ->orderBy('country_name');

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'ilike', "%{$term}%")
                  ->orWhere('country_name', 'ilike', "%{$term}%");
            });
        }

        if ($request->filled('country_code')) {
            $query->where('country_code', $request->input('country_code'));
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min((int) $request->input('per_page', 50), 200);
        return response()->json($query->paginate($perPage));
    }

    public function show(Request $request, Parliament $parliament): JsonResponse
    {
        $this->checkPerm($request, 'parliaments.view');
        abort_unless((int) $parliament->tenant_id === (int) $request->user()->tenant_id, 404);

        $parliament->load(['activeDeployments.employee:id,name,email,job_title']);
        $parliament->loadCount(['deployments', 'activeDeployments']);

        return response()->json(['data' => $parliament]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'parliaments.manage');

        $data = $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'country_code'  => ['required', 'string', 'size:2'],
            'country_name'  => ['required', 'string', 'max:128'],
            'city'          => ['nullable', 'string', 'max:128'],
            'address'       => ['nullable', 'string'],
            'contact_name'  => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:32'],
            'website_url'   => ['nullable', 'url', 'max:255'],
            'is_active'     => ['sometimes', 'boolean'],
            'notes'         => ['nullable', 'string'],
        ]);

        $parliament = Parliament::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        return response()->json(['message' => 'Parliament created.', 'data' => $parliament], 201);
    }

    public function update(Request $request, Parliament $parliament): JsonResponse
    {
        $this->checkPerm($request, 'parliaments.manage');
        abort_unless((int) $parliament->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'name'          => ['sometimes', 'string', 'max:255'],
            'country_code'  => ['sometimes', 'string', 'size:2'],
            'country_name'  => ['sometimes', 'string', 'max:128'],
            'city'          => ['nullable', 'string', 'max:128'],
            'address'       => ['nullable', 'string'],
            'contact_name'  => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:32'],
            'website_url'   => ['nullable', 'url', 'max:255'],
            'is_active'     => ['sometimes', 'boolean'],
            'notes'         => ['nullable', 'string'],
        ]);

        $parliament->update($data);
        return response()->json(['message' => 'Parliament updated.', 'data' => $parliament->fresh()]);
    }

    public function destroy(Request $request, Parliament $parliament): JsonResponse
    {
        $this->checkPerm($request, 'parliaments.manage');
        abort_unless((int) $parliament->tenant_id === (int) $request->user()->tenant_id, 404);

        if ($parliament->activeDeployments()->exists()) {
            return response()->json(['message' => 'Cannot delete a parliament with active deployments.'], 422);
        }

        $parliament->delete();
        return response()->json(['message' => 'Parliament deleted.']);
    }
}
