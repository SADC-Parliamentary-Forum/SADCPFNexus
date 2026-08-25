<?php

namespace App\Http\Controllers\Api\V1\Lifecycle;

use App\Http\Controllers\Controller;
use App\Models\Lifecycle\LifecycleJourneyTemplateVersion;
use App\Modules\Lifecycle\Services\LifecycleTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LifecycleTemplateController extends Controller
{
    public function __construct(
        private readonly LifecycleTemplateService $templates,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->templates->list(
                $request->user(),
                $request->query('lifecycle_type')
            ),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:255'],
            'lifecycle_type' => ['required', 'in:onboarding,separation,transfer,promotion,probation'],
            'definition' => ['required', 'array'],
        ]);

        $version = $this->templates->createDraft($request->user(), $data);

        return response()->json(['data' => $this->templates->showVersion($version, $request->user())], 201);
    }

    public function show(Request $request, LifecycleJourneyTemplateVersion $lifecycleTemplateVersion): JsonResponse
    {
        if ($lifecycleTemplateVersion->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $this->templates->showVersion($lifecycleTemplateVersion, $request->user()),
        ]);
    }

    public function publish(Request $request, LifecycleJourneyTemplateVersion $lifecycleTemplateVersion): JsonResponse
    {
        if ($lifecycleTemplateVersion->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }

        $version = $this->templates->publish($lifecycleTemplateVersion, $request->user());

        return response()->json(['data' => $this->templates->showVersion($version, $request->user())]);
    }
}
