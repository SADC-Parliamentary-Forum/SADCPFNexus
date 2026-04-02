<?php

namespace App\Http\Controllers\Api\V1\Risk;

use App\Http\Controllers\Controller;
use App\Models\Policy;
use App\Models\Risk;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolicyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Policy::where('tenant_id', $user->tenant_id)->withCount('risks');

        if ($search = $request->input('search')) {
            $query->where('title', 'ilike', "%{$search}%");
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $policies = $query->orderBy('title')->paginate($request->input('per_page', 20));
        return response()->json($policies);
    }

    public function show(Request $request, Policy $policy): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        $policy->load(['attachments.uploader:id,name', 'risks:id,risk_code,title,risk_level,status']);
        return response()->json(['data' => $policy]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'title'        => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'owner_name'   => ['nullable', 'string', 'max:150'],
            'renewal_date' => ['nullable', 'date'],
            'status'       => ['nullable', 'in:active,archived'],
        ]);
        $policy = Policy::create(array_merge($data, [
            'tenant_id'  => $user->tenant_id,
            'created_by' => $user->id,
            'status'     => $data['status'] ?? 'active',
        ]));
        return response()->json(['message' => 'Policy created.', 'data' => $policy], 201);
    }

    public function update(Request $request, Policy $policy): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        $data = $request->validate([
            'title'        => ['sometimes', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'owner_name'   => ['nullable', 'string', 'max:150'],
            'renewal_date' => ['nullable', 'date'],
            'status'       => ['nullable', 'in:active,archived'],
        ]);
        $policy->update($data);
        return response()->json(['message' => 'Policy updated.', 'data' => $policy]);
    }

    public function destroy(Request $request, Policy $policy): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        $policy->delete();
        return response()->json(['message' => 'Policy deleted.']);
    }

    public function listForRisk(Request $request, Risk $risk): JsonResponse
    {
        if ($risk->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
        $policies = $risk->policies()->withCount('risks')->get();
        return response()->json(['data' => $policies]);
    }

    public function attachToRisk(Request $request, Policy $policy): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        $user = $request->user();
        $data = $request->validate([
            'risk_id' => ['required', 'integer', 'exists:risks,id'],
            'notes'   => ['nullable', 'string'],
        ]);
        $risk = Risk::where('id', $data['risk_id'])->where('tenant_id', $user->tenant_id)->firstOrFail();
        $policy->risks()->syncWithoutDetaching([
            $risk->id => ['linked_by' => $user->id, 'notes' => $data['notes'] ?? null],
        ]);
        return response()->json(['message' => 'Policy linked to risk.'], 201);
    }

    public function detachFromRisk(Request $request, Policy $policy, Risk $risk): JsonResponse
    {
        $this->ensureCanAccess($request, $policy);
        if ($risk->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
        $policy->risks()->detach($risk->id);
        return response()->json(['message' => 'Policy unlinked from risk.']);
    }

    private function ensureCanAccess(Request $request, Policy $policy): void
    {
        if ($policy->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }
}
