<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetLabelBatch;
use App\Models\AssetLabelTemplate;
use App\Models\User;
use App\Modules\Assets\Services\AssetLabelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class AssetLabelController extends Controller
{
    public function __construct(private readonly AssetLabelService $labels) {}

    public function templates(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->labels->ensureDefaultTemplates((int) $user->tenant_id);

        $query = AssetLabelTemplate::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('is_default')
            ->orderBy('name');

        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->assertCanManageTemplates($user);
        $data = $this->validatedTemplate($request, $user->tenant_id);
        $data['tenant_id'] = $user->tenant_id;
        $data['code'] = strtolower($data['code']);
        $template = AssetLabelTemplate::create($data);
        $this->syncDefault($template);

        return response()->json(['message' => 'Label template created.', 'data' => $template->fresh()], 201);
    }

    public function updateTemplate(Request $request, AssetLabelTemplate $assetLabelTemplate): JsonResponse
    {
        $user = $request->user();
        $this->assertCanManageTemplates($user);
        $this->assertSameTenant($assetLabelTemplate, $user);
        $data = $this->validatedTemplate($request, $user->tenant_id, $assetLabelTemplate->id);
        if (isset($data['code'])) {
            $data['code'] = strtolower($data['code']);
        }
        $assetLabelTemplate->update($data);
        $this->syncDefault($assetLabelTemplate->fresh());

        return response()->json(['message' => 'Label template updated.', 'data' => $assetLabelTemplate->fresh()]);
    }

    public function destroyTemplate(Request $request, AssetLabelTemplate $assetLabelTemplate): JsonResponse
    {
        $user = $request->user();
        $this->assertCanManageTemplates($user);
        $this->assertSameTenant($assetLabelTemplate, $user);

        $used = AssetLabelBatch::query()->where('template_id', $assetLabelTemplate->id)->exists();
        if ($used) {
            $assetLabelTemplate->update(['is_active' => false, 'is_default' => false]);

            return response()->json(['message' => 'Label template deactivated because print batches exist.', 'data' => $assetLabelTemplate->fresh()]);
        }

        $assetLabelTemplate->delete();

        return response()->json(['message' => 'Label template deleted.']);
    }

    public function reprintQueue(Request $request): JsonResponse
    {
        $rows = Asset::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('label_status', 'reprint_required')
            ->orderBy('tag_number')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function batches(Request $request): JsonResponse
    {
        $rows = AssetLabelBatch::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with('template')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 20));

        return response()->json($rows);
    }

    public function print(Request $request): Response|JsonResponse
    {
        $data = $request->validate([
            'asset_ids' => ['required', 'array', 'min:1'],
            'asset_ids.*' => ['integer'],
            'template_id' => ['required', 'integer'],
            'reprint' => ['nullable', 'boolean'],
            'reprint_reason' => ['nullable', 'string', 'max:64'],
            'import_batch_id' => ['nullable', 'integer'],
        ]);
        $result = $this->labels->print(
            $request->user(),
            $data['asset_ids'],
            $data['template_id'],
            (bool) ($data['reprint'] ?? false),
            $data['reprint_reason'] ?? null,
            $data['import_batch_id'] ?? null
        );

        if ($request->boolean('json')) {
            return response()->json([
                'data' => [
                    'batch_number' => $result['batch']->batch_number,
                    'number_of_labels' => $result['batch']->number_of_labels,
                ],
            ], 201);
        }

        return $this->labels->pdfResponse($result);
    }

    private function assertCanManageTemplates(User $user): void
    {
        if ($user->isSystemAdmin()) {
            return;
        }
        if ($user->hasAnyPermission(['assets.print', 'assets.admin', 'assets.manage'])) {
            return;
        }
        abort(403, 'Not authorised to manage label templates.');
    }

    private function assertSameTenant(AssetLabelTemplate $template, User $user): void
    {
        if ((int) $template->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedTemplate(Request $request, int $tenantId, ?int $ignoreId = null): array
    {
        $codeRule = Rule::unique('asset_label_templates', 'code')->where('tenant_id', $tenantId);
        if ($ignoreId) {
            $codeRule = $codeRule->ignore($ignoreId);
        }

        $required = $ignoreId ? 'sometimes' : 'required';

        return $request->validate([
            'code' => [$required, 'string', 'max:64', 'regex:/^[a-z0-9_-]+$/', $codeRule],
            'name' => [$required, 'string', 'max:255'],
            'kind' => [$required === 'required' ? 'required' : 'sometimes', 'in:permanent,custody'],
            'page_size' => ['nullable', 'string', 'max:32'],
            'page_width_mm' => [$required, 'numeric', 'min:20', 'max:400'],
            'page_height_mm' => [$required, 'numeric', 'min:20', 'max:400'],
            'margin_top_mm' => ['nullable', 'numeric', 'min:0', 'max:80'],
            'margin_left_mm' => ['nullable', 'numeric', 'min:0', 'max:80'],
            'label_width_mm' => [$required, 'numeric', 'min:10', 'max:400'],
            'label_height_mm' => [$required, 'numeric', 'min:10', 'max:400'],
            'h_gap_mm' => ['nullable', 'numeric', 'min:0', 'max:40'],
            'v_gap_mm' => ['nullable', 'numeric', 'min:0', 'max:40'],
            'rows' => [$required, 'integer', 'min:1', 'max:20'],
            'columns' => [$required, 'integer', 'min:1', 'max:10'],
            'font_pt' => ['nullable', 'integer', 'min:6', 'max:18'],
            'qr_mm' => ['nullable', 'numeric', 'min:8', 'max:40'],
            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function syncDefault(?AssetLabelTemplate $template): void
    {
        if (! $template || ! $template->is_default) {
            return;
        }
        AssetLabelTemplate::query()
            ->where('tenant_id', $template->tenant_id)
            ->where('id', '!=', $template->id)
            ->update(['is_default' => false]);
    }
}
