<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\ContactGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactGroupController extends Controller
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
        $this->checkPerm($request, 'correspondence.view');
        $groups = ContactGroup::where('tenant_id', $request->user()->tenant_id)
            ->withCount('contacts')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $groups]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $group = ContactGroup::create([
            'tenant_id'   => $request->user()->tenant_id,
            'name'        => $data['name'],
            'description' => $data['description'] ?? null,
        ]);

        return response()->json(['message' => 'Group created.', 'data' => $group], 201);
    }

    public function show(Request $request, ContactGroup $group): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        abort_unless((int) $group->tenant_id === (int) $request->user()->tenant_id, 404);
        return response()->json(['data' => $group->load('contacts')]);
    }

    public function update(Request $request, ContactGroup $group): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        abort_unless((int) $group->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $group->update($data);

        return response()->json(['message' => 'Group updated.', 'data' => $group->fresh()]);
    }

    public function destroy(Request $request, ContactGroup $group): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        abort_unless((int) $group->tenant_id === (int) $request->user()->tenant_id, 404);
        $group->delete();
        return response()->json(['message' => 'Group deleted.']);
    }

    public function addMembers(Request $request, ContactGroup $group): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        abort_unless((int) $group->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'contact_ids'   => ['required', 'array'],
            'contact_ids.*' => ['integer', 'exists:correspondence_contacts,id'],
        ]);

        $group->contacts()->syncWithoutDetaching($data['contact_ids']);

        return response()->json([
            'message' => count($data['contact_ids']) . ' contact(s) added to group.',
            'data'    => $group->fresh('contacts'),
        ]);
    }

    public function removeMembers(Request $request, ContactGroup $group): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        abort_unless((int) $group->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'contact_ids'   => ['required', 'array'],
            'contact_ids.*' => ['integer'],
        ]);

        $group->contacts()->detach($data['contact_ids']);

        return response()->json(['message' => 'Member(s) removed from group.']);
    }
}
