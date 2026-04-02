<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\CorrespondenceContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CorrespondenceContactController extends Controller
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
        $user = $request->user();
        $query = CorrespondenceContact::where('tenant_id', $user->tenant_id)
            ->orderBy('full_name');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'ilike', "%{$search}%")
                  ->orWhere('email', 'ilike', "%{$search}%")
                  ->orWhere('organization', 'ilike', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 50), 200);
        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $data = $request->validate([
            'full_name'        => ['required', 'string', 'max:255'],
            'organization'     => ['nullable', 'string', 'max:255'],
            'country'          => ['nullable', 'string', 'max:4'],
            'email'            => ['required', 'email', 'max:255'],
            'phone'            => ['nullable', 'string', 'max:32'],
            'stakeholder_type' => ['nullable', 'string', 'in:member_parliament,ministry,ngo,donor,private_sector,other'],
            'tags'             => ['nullable', 'array'],
            'tags.*'           => ['string', 'max:64'],
        ]);

        $contact = CorrespondenceContact::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        return response()->json(['message' => 'Contact created.', 'data' => $contact], 201);
    }

    public function show(Request $request, CorrespondenceContact $contact): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        abort_unless((int) $contact->tenant_id === (int) $request->user()->tenant_id, 404);
        return response()->json(['data' => $contact->load('groups:id,name')]);
    }

    public function update(Request $request, CorrespondenceContact $contact): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        abort_unless((int) $contact->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'full_name'        => ['sometimes', 'string', 'max:255'],
            'organization'     => ['nullable', 'string', 'max:255'],
            'country'          => ['nullable', 'string', 'max:4'],
            'email'            => ['sometimes', 'email', 'max:255'],
            'phone'            => ['nullable', 'string', 'max:32'],
            'stakeholder_type' => ['nullable', 'string', 'in:member_parliament,ministry,ngo,donor,private_sector,other'],
            'tags'             => ['nullable', 'array'],
            'tags.*'           => ['string', 'max:64'],
        ]);

        $contact->update($data);

        return response()->json(['message' => 'Contact updated.', 'data' => $contact->fresh()]);
    }

    public function destroy(Request $request, CorrespondenceContact $contact): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');
        abort_unless((int) $contact->tenant_id === (int) $request->user()->tenant_id, 404);
        $contact->delete();
        return response()->json(['message' => 'Contact deleted.']);
    }
}
