<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetHandover;
use App\Models\AssetHandoverLine;
use App\Modules\Assets\Services\AssetHandoverService;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AssetHandoverController extends Controller
{
    public function __construct(private readonly AssetHandoverService $handovers) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = AssetHandover::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['lines', 'toUser:id,name,email'])
            ->orderByDesc('id');

        if ($request->boolean('mine') || ! AssetAccess::canManageHandover($user)) {
            $query->where(function ($q) use ($user) {
                $q->where('to_user_id', $user->id)->orWhere('from_user_id', $user->id);
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        return response()->json($query->paginate((int) $request->input('per_page', 25)));
    }

    public function register(Request $request): JsonResponse
    {
        if (! AssetAccess::canManageHandover($request->user()) && ! $request->user()->hasPermissionTo('assets.view')) {
            abort(403);
        }
        $query = AssetHandover::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['lines', 'toUser:id,name', 'createdBy:id,name'])
            ->orderByDesc('id');

        return response()->json($query->paginate((int) $request->input('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:issue,transfer,return'],
            'custody_target_type' => ['required', 'string', 'in:person,department,location,pool,vehicle_facility'],
            'to_user_id' => ['nullable', 'integer'],
            'to_department_id' => ['nullable', 'integer'],
            'to_location_id' => ['nullable', 'integer'],
            'to_asset_id' => ['nullable', 'integer'],
            'from_user_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'expires_at' => ['nullable', 'date'],
            'asset_ids' => ['nullable', 'array'],
            'asset_ids.*' => ['integer'],
        ]);
        $handover = $this->handovers->create($request->user(), $data);

        return response()->json(['data' => $this->handovers->present($handover, $request->user())], 201);
    }

    public function show(Request $request, AssetHandover $assetHandover): JsonResponse
    {
        $this->assertVisible($assetHandover, $request->user());

        return response()->json(['data' => $this->handovers->present($assetHandover, $request->user())]);
    }

    public function addLines(Request $request, AssetHandover $assetHandover): JsonResponse
    {
        $data = $request->validate([
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
            'condition_out' => ['nullable', 'string', 'max:64'],
            'accessories' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        foreach ($data['asset_ids'] as $id) {
            $this->handovers->addLine($assetHandover, $request->user(), (int) $id, $data);
        }

        return response()->json(['data' => $this->handovers->present($assetHandover->fresh(), $request->user())]);
    }

    public function send(Request $request, AssetHandover $assetHandover): JsonResponse
    {
        $updated = $this->handovers->send($assetHandover, $request->user());

        return response()->json(['data' => $this->handovers->present($updated, $request->user())]);
    }

    public function cancel(Request $request, AssetHandover $assetHandover): JsonResponse
    {
        $updated = $this->handovers->cancel($assetHandover, $request->user());

        return response()->json(['data' => $this->handovers->present($updated, $request->user())]);
    }

    public function respond(Request $request, AssetHandover $assetHandover, AssetHandoverLine $assetHandoverLine): JsonResponse
    {
        $data = $request->validate([
            'response' => ['required', 'string', 'in:received,not_received,incorrect_asset,condition_different,accessories_missing'],
            'dispute_notes' => ['nullable', 'string', 'max:2000'],
            'condition_in' => ['nullable', 'string', 'max:64'],
            'new_condition' => ['nullable', 'string', 'max:64'],
        ]);
        $line = $this->handovers->respond($assetHandover, $assetHandoverLine, $request->user(), $data);

        return response()->json(['data' => $line, 'handover' => $this->handovers->present($assetHandover->fresh(), $request->user())]);
    }

    public function sign(Request $request, AssetHandover $assetHandover): JsonResponse
    {
        $data = $request->validate([
            'comment' => ['nullable', 'string', 'max:2000'],
            'auth_level' => ['nullable', 'string', 'max:32'],
            'signature_data' => ['nullable', 'string'],
        ]);
        $updated = $this->handovers->sign($assetHandover, $request->user(), $data);

        return response()->json(['data' => $this->handovers->present($updated, $request->user())]);
    }

    public function certificate(Request $request, AssetHandover $assetHandover): Response
    {
        return $this->handovers->certificateResponse($assetHandover, $request->user());
    }

    public function custodyHistory(Request $request, Asset $asset): JsonResponse
    {
        $user = $request->user();
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! AssetAccess::canScan($user) && (int) $asset->assigned_to !== (int) $user->id) {
            abort(403);
        }

        return response()->json([
            'data' => [
                'owner' => $asset->owner_name ?: 'SADC Parliamentary Forum',
                'custodian_type' => $asset->custodian_type,
                'assigned_to' => $asset->assigned_to,
                'history' => $this->handovers->custodyHistory($asset),
            ],
        ]);
    }

    private function assertVisible(AssetHandover $handover, $user): void
    {
        if ((int) $handover->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (AssetAccess::canManageHandover($user)) {
            return;
        }
        if ((int) $handover->to_user_id === (int) $user->id || (int) $handover->from_user_id === (int) $user->id) {
            return;
        }
        abort(403);
    }
}
