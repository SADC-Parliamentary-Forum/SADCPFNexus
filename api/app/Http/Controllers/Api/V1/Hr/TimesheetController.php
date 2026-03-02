<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TimesheetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'per_page']);
        $query = Timesheet::with(['user'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('week_start');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $paginated = $query->paginate($filters['per_page'] ?? 20);
        return response()->json($paginated);
    }

    public function show(Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== request()->user()->id) {
            abort(403);
        }
        return response()->json($timesheet->load(['entries', 'user', 'approver']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'week_start' => ['required', 'date'],
            'week_end'   => ['required', 'date', 'after_or_equal:week_start'],
            'entries'    => ['required', 'array', 'min:1'],
            'entries.*.work_date'   => ['required', 'date'],
            'entries.*.hours'       => ['required', 'numeric', 'min:0', 'max:24'],
            'entries.*.overtime_hours' => ['nullable', 'numeric', 'min:0', 'max:12'],
            'entries.*.description' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $total = 0;
        $overtime = 0;
        foreach ($data['entries'] as $e) {
            $total += (float) $e['hours'];
            $overtime += (float) ($e['overtime_hours'] ?? 0);
        }

        $timesheet = Timesheet::create([
            'tenant_id'     => $user->tenant_id,
            'user_id'       => $user->id,
            'week_start'    => $data['week_start'],
            'week_end'      => $data['week_end'],
            'total_hours'   => $total,
            'overtime_hours'=> $overtime,
            'status'        => 'draft',
        ]);

        foreach ($data['entries'] as $e) {
            TimesheetEntry::create([
                'timesheet_id'    => $timesheet->id,
                'work_date'       => $e['work_date'],
                'hours'           => $e['hours'],
                'overtime_hours'  => $e['overtime_hours'] ?? 0,
                'description'     => $e['description'] ?? null,
            ]);
        }

        return response()->json(['message' => 'Timesheet created.', 'data' => $timesheet->load(['entries', 'user'])], 201);
    }

    public function update(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($timesheet->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft timesheets can be edited.']);
        }

        $data = $request->validate([
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.work_date'   => ['required', 'date'],
            'entries.*.hours'       => ['required', 'numeric', 'min:0', 'max:24'],
            'entries.*.overtime_hours' => ['nullable', 'numeric', 'min:0', 'max:12'],
            'entries.*.description' => ['nullable', 'string', 'max:500'],
        ]);

        $total = 0;
        $overtime = 0;
        foreach ($data['entries'] as $e) {
            $total += (float) $e['hours'];
            $overtime += (float) ($e['overtime_hours'] ?? 0);
        }

        $timesheet->update(['total_hours' => $total, 'overtime_hours' => $overtime]);
        $timesheet->entries()->delete();
        foreach ($data['entries'] as $e) {
            TimesheetEntry::create([
                'timesheet_id'   => $timesheet->id,
                'work_date'      => $e['work_date'],
                'hours'          => $e['hours'],
                'overtime_hours' => $e['overtime_hours'] ?? 0,
                'description'    => $e['description'] ?? null,
            ]);
        }

        return response()->json(['message' => 'Updated.', 'data' => $timesheet->fresh(['entries', 'user'])]);
    }

    public function submit(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($timesheet->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft timesheets can be submitted.']);
        }
        $timesheet->update(['status' => 'submitted', 'submitted_at' => now()]);
        return response()->json(['message' => 'Submitted.', 'data' => $timesheet->fresh('user')]);
    }

    public function approve(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be approved.']);
        }
        $timesheet->update([
            'status'      => 'approved',
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
        ]);
        return response()->json(['message' => 'Approved.', 'data' => $timesheet->fresh(['user', 'approver'])]);
    }

    public function reject(Request $request, Timesheet $timesheet): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be rejected.']);
        }
        $timesheet->update(['status' => 'rejected', 'rejection_reason' => $data['reason']]);
        return response()->json(['message' => 'Rejected.', 'data' => $timesheet->fresh('user')]);
    }
}
