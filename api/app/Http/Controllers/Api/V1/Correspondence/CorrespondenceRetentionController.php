<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\Correspondence;
use App\Modules\Correspondence\Services\CorrespondenceRetentionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CorrespondenceRetentionController extends Controller
{
    public function __construct(private readonly CorrespondenceRetentionService $retention)
    {
    }

    public function update(Request $request, Correspondence $correspondence): JsonResponse
    {
        $validated = $request->validate([
            'retention_policy' => ['nullable', 'string', Rule::in(CorrespondenceRetentionService::POLICIES)],
            'retain_until' => ['nullable', 'date'],
            'legal_hold' => ['nullable', 'boolean'],
            'legal_hold_reason' => ['nullable', 'string', 'max:5000'],
        ]);

        $letter = $this->retention->updateRetention($correspondence, $validated, $request->user());

        return response()->json(['data' => $letter, 'message' => 'Retention settings updated.']);
    }

    public function releaseHold(Request $request, Correspondence $correspondence): JsonResponse
    {
        $letter = $this->retention->releaseHold($correspondence, $request->user());

        return response()->json(['data' => $letter, 'message' => 'Legal hold released.']);
    }

    public function purge(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->retention->purge($correspondence, $request->user());

        return response()->json(['message' => 'Correspondence purged (soft-deleted). Retention audit retained.']);
    }

    public function indexHolds(Request $request): JsonResponse
    {
        $user = $request->user();
        if (
            ! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('correspondence.manage-retention')
            && ! $user->hasPermissionTo('correspondence.admin')
        ) {
            abort(403);
        }

        $rows = Correspondence::where('tenant_id', $user->tenant_id)
            ->where('legal_hold', true)
            ->with(['creator:id,name', 'primaryOwner:id,name'])
            ->orderByDesc('legal_hold_set_at')
            ->paginate(min((int) $request->input('per_page', 50), 100));

        return response()->json($rows);
    }
}
