<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\TimesheetProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimesheetProjectController extends Controller
{
    /**
     * List timesheet projects for the authenticated user's tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $projects = TimesheetProject::where('tenant_id', $tenantId)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $projects]);
    }

    /**
     * Create a timesheet project.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'label'      => ['required', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $tenantId = $request->user()->tenant_id;
        $project = TimesheetProject::create([
            'tenant_id'  => $tenantId,
            'label'     => $request->label,
            'sort_order' => $request->get('sort_order', 0),
        ]);

        return response()->json(['data' => $project, 'message' => 'Project created.'], 201);
    }

    /**
     * Update a timesheet project (tenant-scoped).
     */
    public function update(Request $request, TimesheetProject $timesheet_project): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        if ((int) $timesheet_project->tenant_id !== (int) $tenantId) {
            abort(404);
        }

        $request->validate([
            'label'      => ['sometimes', 'string', 'max:500'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $timesheet_project->update($request->only(['label', 'sort_order']));

        return response()->json(['data' => $timesheet_project, 'message' => 'Project updated.']);
    }

    /**
     * Delete a timesheet project (tenant-scoped).
     */
    public function destroy(Request $request, TimesheetProject $timesheet_project): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        if ((int) $timesheet_project->tenant_id !== (int) $tenantId) {
            abort(404);
        }

        $timesheet_project->delete();

        return response()->json(['message' => 'Project deleted.']);
    }
}
