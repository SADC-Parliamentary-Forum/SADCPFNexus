<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Modules\Fleet\Services\FleetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetController extends Controller
{
    public function __construct(private readonly FleetService $fleet) {}

    private function canView($user): bool
    {
        return $user->can('assets.view') || $user->can('assets.manage') || $user->can('assets.admin');
    }

    private function canManage($user): bool
    {
        return $user->can('assets.manage') || $user->can('assets.admin') || $user->can('assets.create') || $user->can('assets.edit');
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless($this->canView($request->user()), 403);

        return response()->json([
            'data' => $this->fleet->listVehicles((int) $request->user()->tenant_id),
        ]);
    }

    public function show(Request $request, Asset $asset): JsonResponse
    {
        abort_unless($this->canView($request->user()), 403);

        return response()->json([
            'data' => $this->fleet->showVehicle($asset, (int) $request->user()->tenant_id),
        ]);
    }

    /**
     * Manual last-known GPS stub — not a live telematics vendor feed.
     */
    public function updateGps(Request $request, Asset $asset): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'gps_lat' => ['required', 'numeric', 'between:-90,90'],
            'gps_lng' => ['required', 'numeric', 'between:-180,180'],
            'gps_recorded_at' => ['nullable', 'date'],
        ]);

        $vehicle = $this->fleet->updateGpsStub($asset, $request->user(), $data);

        return response()->json([
            'message' => 'Last-known GPS location saved (manual stub — not live telematics).',
            'data' => $vehicle,
        ]);
    }

    /**
     * Map external telematics device id on a fleet vehicle (never auto-creates).
     */
    public function updateTelematics(Request $request, Asset $asset): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'telematics_device_id' => ['nullable', 'string', 'max:128'],
        ]);

        $vehicle = $this->fleet->updateTelematicsMapping($asset, $request->user(), $data);

        return response()->json([
            'message' => 'Telematics device mapping saved.',
            'data' => $vehicle,
        ]);
    }

    public function storeTrip(Request $request, Asset $asset): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'started_at' => ['required', 'date'],
            'ended_at' => ['nullable', 'date', 'after_or_equal:started_at'],
            'start_odometer_km' => ['nullable', 'integer', 'min:0'],
            'end_odometer_km' => ['nullable', 'integer', 'min:0'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'origin' => ['nullable', 'string', 'max:255'],
            'destination' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'driver_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $trip = $this->fleet->createTrip($asset, $request->user(), $data);

        return response()->json(['data' => $trip], 201);
    }

    public function storeFuelLog(Request $request, Asset $asset): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'logged_at' => ['required', 'date'],
            'litres' => ['required', 'numeric', 'gt:0'],
            'cost_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'odometer_km' => ['nullable', 'integer', 'min:0'],
            'station' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $log = $this->fleet->createFuelLog($asset, $request->user(), $data);

        return response()->json(['data' => $log], 201);
    }

    public function storeServiceSchedule(Request $request, Asset $asset): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'service_type' => ['nullable', 'string', 'max:64'],
            'interval_km' => ['nullable', 'integer', 'min:1'],
            'interval_days' => ['nullable', 'integer', 'min:1'],
            'last_service_at' => ['nullable', 'date'],
            'last_service_odometer_km' => ['nullable', 'integer', 'min:0'],
            'next_due_at' => ['nullable', 'date'],
            'next_due_odometer_km' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $schedule = $this->fleet->createServiceSchedule($asset, $request->user(), $data);

        return response()->json(['data' => $schedule], 201);
    }

    public function listDrivers(Request $request): JsonResponse
    {
        abort_unless($this->canView($request->user()), 403);

        return response()->json([
            'data' => $this->fleet->listDrivers((int) $request->user()->tenant_id),
        ]);
    }

    public function storeDriver(Request $request): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'licence_number' => ['nullable', 'string', 'max:64'],
            'licence_expires_on' => ['nullable', 'date'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'notes' => ['nullable', 'string'],
        ]);

        $driver = $this->fleet->createDriver($request->user(), $data);

        return response()->json(['data' => $driver], 201);
    }

    public function listBookings(Request $request): JsonResponse
    {
        abort_unless($this->canView($request->user()), 403);

        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'asset_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->fleet->listBookings((int) $request->user()->tenant_id, $filters),
        ]);
    }

    public function storeBooking(Request $request): JsonResponse
    {
        abort_unless($this->canManage($request->user()), 403);

        $data = $request->validate([
            'asset_id' => ['required', 'integer', 'exists:assets,id'],
            'driver_id' => ['nullable', 'integer', 'exists:fleet_drivers,id'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'destination' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $booking = $this->fleet->createBooking($request->user(), $data);

        return response()->json(['data' => $booking], 201);
    }
}
