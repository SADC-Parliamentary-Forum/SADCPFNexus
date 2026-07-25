<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Modules\MAndE\Services\MeSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeSettingsController extends Controller
{
    public function __construct(private readonly MeSettingsService $settings) {}

    public function show(Request $request): JsonResponse
    {
        $row = $this->settings->forTenant((int) $request->user()->tenant_id);

        return response()->json(['data' => $this->serialize($row)]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'auto_intake'             => ['sometimes', 'boolean'],
            'report_due_days'          => ['sometimes', 'integer', 'min:1', 'max:365'],
            'programme_manager_review' => ['sometimes', 'boolean'],
        ]);

        $row = $this->settings->update((int) $request->user()->tenant_id, $data);

        return response()->json([
            'message' => 'M&E settings updated.',
            'data'    => $this->serialize($row),
        ]);
    }

    private function serialize(object $row): array
    {
        return [
            'auto_intake'             => (bool) $row->auto_intake,
            'report_due_days'          => (int) $row->report_due_days,
            'programme_manager_review' => (bool) $row->programme_manager_review,
        ];
    }
}
