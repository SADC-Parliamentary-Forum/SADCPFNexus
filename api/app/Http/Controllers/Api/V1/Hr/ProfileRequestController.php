<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProfileChangeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProfileRequestController extends Controller
{
    private function authorise(Request $request): void
    {
        $user = $request->user();
        if (!$user->hasRole(['HR Manager', 'System Admin', 'System Administrator', 'super-admin'])) {
            abort(403, 'Only HR Managers can review profile change requests.');
        }
    }

    /**
     * GET /hr/profile-requests
     * List profile change requests (default: pending).
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorise($request);

        $status = $request->query('status', 'pending');
        $query  = ProfileChangeRequest::with(['user.department', 'reviewer'])
            ->where('tenant_id', $request->user()->tenant_id);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $requests = $query->orderByDesc('created_at')->paginate(20);

        return response()->json($requests);
    }

    /**
     * GET /hr/profile-requests/{id}
     * Show a single request with full diff.
     */
    public function show(Request $request, ProfileChangeRequest $profileChangeRequest): JsonResponse
    {
        $this->authorise($request);

        if ($profileChangeRequest->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        $profileChangeRequest->load(['user.department', 'reviewer']);

        return response()->json(['data' => $profileChangeRequest]);
    }

    /**
     * POST /hr/profile-requests/{id}/approve
     * Approve and apply the changes to the user's profile.
     */
    public function approve(Request $request, ProfileChangeRequest $profileChangeRequest): JsonResponse
    {
        $this->authorise($request);

        if ($profileChangeRequest->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        if (!$profileChangeRequest->isPending()) {
            throw ValidationException::withMessages([
                'status' => ['This request has already been reviewed.'],
            ]);
        }

        $validated = $request->validate([
            'review_notes' => 'nullable|string|max:1000',
        ]);

        // Apply each change to the user's profile
        $user    = $profileChangeRequest->user;
        $updates = [];
        foreach ($profileChangeRequest->requested_changes as $field => $diff) {
            $updates[$field] = $diff['new'];
        }
        $user->update($updates);

        $profileChangeRequest->update([
            'status'       => 'approved',
            'reviewed_by'  => $request->user()->id,
            'reviewed_at'  => now(),
            'review_notes' => $validated['review_notes'] ?? null,
        ]);

        AuditLog::record('profile_change_request.approved', [
            'auditable_type' => ProfileChangeRequest::class,
            'auditable_id'   => $profileChangeRequest->id,
            'new_values'     => ['fields' => array_keys($profileChangeRequest->requested_changes)],
            'tags'           => 'profile',
        ]);

        return response()->json([
            'message' => 'Profile change request approved and applied.',
            'data'    => $profileChangeRequest->fresh(['user.department', 'reviewer']),
        ]);
    }

    /**
     * POST /hr/profile-requests/{id}/reject
     * Reject the request with a reason.
     */
    public function reject(Request $request, ProfileChangeRequest $profileChangeRequest): JsonResponse
    {
        $this->authorise($request);

        if ($profileChangeRequest->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        if (!$profileChangeRequest->isPending()) {
            throw ValidationException::withMessages([
                'status' => ['This request has already been reviewed.'],
            ]);
        }

        $validated = $request->validate([
            'review_notes' => 'required|string|max:1000',
        ]);

        $profileChangeRequest->update([
            'status'       => 'rejected',
            'reviewed_by'  => $request->user()->id,
            'reviewed_at'  => now(),
            'review_notes' => $validated['review_notes'],
        ]);

        AuditLog::record('profile_change_request.rejected', [
            'auditable_type' => ProfileChangeRequest::class,
            'auditable_id'   => $profileChangeRequest->id,
            'new_values'     => ['reason' => $validated['review_notes']],
            'tags'           => 'profile',
        ]);

        return response()->json([
            'message' => 'Profile change request rejected.',
            'data'    => $profileChangeRequest->fresh(['user.department', 'reviewer']),
        ]);
    }
}
