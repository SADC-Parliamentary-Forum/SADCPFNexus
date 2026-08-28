<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Tender;
use App\Modules\Procurement\Services\NewspaperNoticeTemplateService;
use App\Modules\Procurement\Services\PublicNoticeBoardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicNoticeController extends Controller
{
    public function __construct(
        private readonly PublicNoticeBoardService $notices,
        private readonly NewspaperNoticeTemplateService $newspaper,
    ) {}

    /** Unauthenticated public tender/RFQ notice board. */
    public function publicIndex(): JsonResponse
    {
        return response()->json([
            'data' => $this->notices->publishedNotices(),
        ]);
    }

    /** Authenticated staff notice board (same public fields, tenant-scoped). */
    public function staffIndex(Request $request): JsonResponse
    {
        if (! $request->user()->hasAnyRole([
            'Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin',
        ]) && ! $request->user()->hasAnyPermission(['procurement.view', 'procurement.admin'])) {
            abort(403);
        }

        return response()->json([
            'data' => $this->notices->staffNotices((int) $request->user()->tenant_id),
        ]);
    }

    public function newspaperTemplates(Request $request): JsonResponse
    {
        $this->staffGate($request);

        return response()->json(['data' => $this->newspaper->templates()]);
    }

    public function newspaperPack(Request $request, Tender $tender): JsonResponse
    {
        $this->staffGate($request);

        return response()->json(['data' => $this->newspaper->packFor($tender, $request->user(), $request->query('template_key'))]);
    }

    public function newspaperChecklist(Request $request, Tender $tender): JsonResponse
    {
        $this->staffGate($request);
        $data = $request->validate([
            'template_key' => ['nullable', 'string', 'max:64'],
            'ticks' => ['nullable', 'array'],
            'ticks.*' => ['boolean'],
        ]);

        return response()->json(['data' => $this->newspaper->saveTicks($tender, $request->user(), $data)]);
    }

    public function newspaperLlmDraft(Request $request, Tender $tender): JsonResponse
    {
        $this->staffGate($request);
        $data = $request->validate([
            'template_key' => ['nullable', 'string', 'max:64'],
        ]);

        return response()->json([
            'data' => $this->newspaper->draftWithLlm($tender, $request->user(), $data['template_key'] ?? null),
            'message' => 'LLM draft is a suggestion only. Human publication checklist is still required. This never awards.',
        ]);
    }

    private function staffGate(Request $request): void
    {
        if (! $request->user()->hasAnyRole([
            'Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin',
        ]) && ! $request->user()->hasAnyPermission(['procurement.view', 'procurement.admin'])) {
            abort(403);
        }
    }
}
