<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProfileChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProfileChangeRequestController extends Controller
{
    /**
     * GET /profile/change-request
     * Returns the authenticated user's most recent (or pending) change request.
     */
    public function show(Request $request): JsonResponse
    {
        $pending = ProfileChangeRequest::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->first();

        return response()->json(['data' => $pending]);
    }

    /**
     * POST /profile/change-request
     * Submit a new profile change request (or replace a pending one).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'phone'                          => 'nullable|string|max:20',
            'bio'                            => 'nullable|string',
            'nationality'                    => 'nullable|string|max:100',
            'gender'                         => 'nullable|string|max:20',
            'marital_status'                 => 'nullable|string|max:20',
            'emergency_contact_name'         => 'nullable|string|max:255',
            'emergency_contact_relationship' => 'nullable|string|max:100',
            'emergency_contact_phone'        => 'nullable|string|max:20',
            'address_line1'                  => 'nullable|string|max:255',
            'address_line2'                  => 'nullable|string|max:255',
            'city'                           => 'nullable|string|max:100',
            'country'                        => 'nullable|string|max:100',
            'notes'                          => 'nullable|string|max:1000',
        ]);

        $notes = $validated['notes'] ?? null;
        unset($validated['notes']);

        // Only keep fields that actually changed vs current profile
        $changes = [];
        foreach (ProfileChangeRequest::allowedFields() as $field) {
            if (!array_key_exists($field, $validated)) continue;
            $oldValue = $user->$field;
            $newValue = $validated[$field];
            if ($oldValue !== $newValue) {
                $changes[$field] = ['old' => $oldValue, 'new' => $newValue];
            }
        }

        if (empty($changes)) {
            throw ValidationException::withMessages([
                'changes' => ['No changes were detected compared to your current profile.'],
            ]);
        }

        // Cancel any existing pending request before creating a new one
        ProfileChangeRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->update(['status' => 'cancelled']);

        $changeRequest = ProfileChangeRequest::create([
            'tenant_id'         => $user->tenant_id,
            'user_id'           => $user->id,
            'requested_changes' => $changes,
            'notes'             => $notes,
            'status'            => 'pending',
        ]);

        AuditLog::record('profile_change_request.submitted', [
            'auditable_type' => ProfileChangeRequest::class,
            'auditable_id'   => $changeRequest->id,
            'new_values'     => ['fields' => array_keys($changes)],
            'tags'           => 'profile',
        ]);

        return response()->json([
            'message' => 'Profile change request submitted. HR will review it shortly.',
            'data'    => $changeRequest->load('reviewer'),
        ], 201);
    }

    /**
     * DELETE /profile/change-request/{id}
     * Cancel a pending request (only the owner can cancel).
     */
    public function cancel(Request $request, ProfileChangeRequest $changeRequest): JsonResponse
    {
        if ($changeRequest->user_id !== $request->user()->id) {
            abort(403);
        }

        if (!$changeRequest->isPending()) {
            throw ValidationException::withMessages([
                'status' => ['Only pending requests can be cancelled.'],
            ]);
        }

        $changeRequest->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Change request cancelled.']);
    }
}
