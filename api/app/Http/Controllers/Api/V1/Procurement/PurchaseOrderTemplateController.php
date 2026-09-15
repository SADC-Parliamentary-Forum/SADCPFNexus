<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\DocumentTemplate;
use App\Models\PurchaseOrder;
use App\Modules\Documents\Services\PurchaseOrderDocumentService;
use App\Modules\Documents\Services\PurchaseOrderTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PurchaseOrderTemplateController extends Controller
{
    public function __construct(
        private readonly PurchaseOrderTemplateService $templates,
        private readonly PurchaseOrderDocumentService $documents,
    ) {}

    public function catalog(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        return response()->json(['data' => $this->templates->fieldCatalog()]);
    }

    public function index(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $rows = $this->templates->list((int) $request->user()->tenant_id);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:2000'],
            'orientation' => ['nullable', 'in:portrait,landscape'],
            'layout_json' => ['nullable', 'array'],
        ]);
        $row = $this->templates->create((int) $request->user()->tenant_id, $request->user(), $data);

        return response()->json(['message' => 'Template created.', 'data' => $row], 201);
    }

    public function show(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->assertAdmin($request);
        $this->assertTenant($request, $template);

        return response()->json(['data' => $template->load(['draftVersion', 'publishedVersion'])]);
    }

    public function update(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->assertAdmin($request);
        $this->assertTenant($request, $template);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:2000'],
            'orientation' => ['nullable', 'in:portrait,landscape'],
            'layout_json' => ['nullable', 'array'],
        ]);
        $row = $this->templates->saveDraft($template, $request->user(), $data);

        return response()->json(['message' => 'Draft saved.', 'data' => $row]);
    }

    public function publish(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->assertPublisher($request);
        $this->assertTenant($request, $template);
        $row = $this->templates->publish($template, $request->user());

        return response()->json(['message' => 'Template published.', 'data' => $row]);
    }

    public function retire(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->assertPublisher($request);
        $this->assertTenant($request, $template);
        $row = $this->templates->retire($template, $request->user());

        return response()->json(['message' => 'Template retired.', 'data' => $row]);
    }

    public function setDefault(Request $request, DocumentTemplate $template): JsonResponse
    {
        $this->assertAdmin($request);
        $this->assertTenant($request, $template);
        $row = $this->templates->setDefault($template, $request->user());

        return response()->json(['message' => 'Default template updated.', 'data' => $row]);
    }

    public function preview(Request $request, DocumentTemplate $template): Response
    {
        $this->assertAdmin($request);
        $this->assertTenant($request, $template);
        $data = $request->validate([
            'mode' => ['nullable', 'in:design,sample,real'],
            'purchase_order_id' => ['nullable', 'integer'],
            'layout_json' => ['nullable', 'array'],
        ]);
        $mode = $data['mode'] ?? 'sample';
        $po = $this->previewPo($request, $mode, $data['purchase_order_id'] ?? null);
        $binary = $this->documents->renderPdf($po, $template, $mode, $data['layout_json'] ?? null)->output();

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="po-template-preview.pdf"',
        ]);
    }

    private function previewPo(Request $request, string $mode, ?int $poId): PurchaseOrder
    {
        if ($mode === 'real' && $poId) {
            $po = PurchaseOrder::query()->findOrFail($poId);
            if ((int) $po->tenant_id !== (int) $request->user()->tenant_id) {
                abort(404);
            }

            return $po;
        }
        $po = new PurchaseOrder([
            'tenant_id' => $request->user()->tenant_id,
            'reference_number' => 'S 04015',
            'lpo_number' => 'S 04015',
            'currency' => 'NAD',
            'total_amount' => 4499.69,
            'subtotal' => 4499.69,
        ]);
        $po->setRelation('items', collect());
        $po->setRelation('vendor', null);

        return $po;
    }

    private function assertAdmin(Request $request): void
    {
        if (! $request->user()->hasAnyPermission(['procurement.admin']) && ! $request->user()->hasRole('System Admin')) {
            abort(403);
        }
    }

    private function assertPublisher(Request $request): void
    {
        if (! $request->user()->hasAnyPermission(['procurement.template.publish', 'procurement.admin']) && ! $request->user()->hasRole('System Admin')) {
            abort(403);
        }
    }

    private function assertTenant(Request $request, DocumentTemplate $template): void
    {
        if ((int) $template->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ($template->document_type !== 'purchase_order') {
            abort(404);
        }
    }
}
