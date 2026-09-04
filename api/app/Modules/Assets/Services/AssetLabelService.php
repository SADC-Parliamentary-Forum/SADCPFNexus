<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetLabelBatch;
use App\Models\AssetLabelBatchItem;
use App\Models\AssetLabelTemplate;
use App\Models\AuditLog;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AssetLabelService
{
    public function __construct(private readonly AssetQrService $qr) {}

    /**
     * @param  list<int>  $assetIds
     * @return array{batch: AssetLabelBatch, pdf: string}
     */
    public function print(User $user, array $assetIds, int $templateId, bool $reprint = false, ?string $reason = null, ?int $importBatchId = null): array
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.print') && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Not authorised to print asset labels.');
        }

        $template = AssetLabelTemplate::query()
            ->where('tenant_id', $user->tenant_id)
            ->findOrFail($templateId);

        $assets = Asset::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('id', $assetIds)
            ->with(['location', 'assignedUser'])
            ->orderBy('tag_number')
            ->get();

        if ($assets->isEmpty()) {
            abort(422, 'No matching assets to print.');
        }

        foreach ($assets as $asset) {
            $this->qr->ensure($asset, $user);
        }
        $assets = $assets->map->fresh(['location', 'assignedUser']);

        return DB::transaction(function () use ($user, $assets, $template, $reprint, $reason, $importBatchId) {
            $year = now()->year;
            $seq = AssetLabelBatch::query()->where('tenant_id', $user->tenant_id)->where('batch_number', 'like', 'LBL-'.$year.'-%')->count() + 1;
            $batch = AssetLabelBatch::create([
                'tenant_id' => $user->tenant_id,
                'batch_number' => sprintf('LBL-%d-%05d', $year, $seq),
                'template_id' => $template->id,
                'number_of_labels' => $assets->count(),
                'printed_by' => $user->id,
                'printed_at' => now(),
                'is_reprint' => $reprint,
                'reprint_reason' => $reason,
                'source_import_batch_id' => $importBatchId,
            ]);

            foreach ($assets->values() as $i => $asset) {
                AssetLabelBatchItem::create([
                    'label_batch_id' => $batch->id,
                    'asset_id' => $asset->id,
                    'position' => $i + 1,
                ]);
                $asset->label_status = 'printed';
                $asset->label_reprint_reason = null;
                $asset->save();
            }

            $labels = $assets->map(fn (Asset $asset) => $this->labelData($asset, $template))->all();
            $pdf = Pdf::loadView('pdf.asset_labels', [
                'template' => $template,
                'labels' => $labels,
                'batch' => $batch,
            ])->setPaper([0, 0, $this->mmToPt((float) $template->page_width_mm), $this->mmToPt((float) $template->page_height_mm)]);

            AuditLog::record('assets.label_printed', [
                'auditable_type' => AssetLabelBatch::class,
                'auditable_id' => $batch->id,
                'new_values' => [
                    'batch_number' => $batch->batch_number,
                    'count' => $assets->count(),
                    'reprint' => $reprint,
                    'reason' => $reason,
                ],
                'tags' => 'assets',
            ]);

            return ['batch' => $batch, 'pdf' => $pdf->output()];
        });
    }

    public function pdfResponse(array $result): Response
    {
        /** @var AssetLabelBatch $batch */
        $batch = $result['batch'];

        return response($result['pdf'], 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$batch->batch_number.'.pdf"',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function labelData(Asset $asset, AssetLabelTemplate $template): array
    {
        $qrPng = $this->qr->png($asset);

        return [
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'name' => $asset->name,
            'model' => $asset->model,
            'serial' => $asset->serial_number,
            'location' => $template->kind === 'custody' ? ($asset->location?->name ?: $asset->legacy_location) : null,
            'custodian' => $template->kind === 'custody' ? ($asset->assignedUser?->name) : null,
            'qr_base64' => base64_encode($qrPng),
        ];
    }

    private function mmToPt(float $mm): float
    {
        return $mm * 2.83465;
    }

    public function markReprintRequired(Asset $asset, string $reason): void
    {
        if ($asset->label_status === 'never_printed') {
            return;
        }
        $asset->label_status = 'reprint_required';
        $asset->label_reprint_reason = $reason;
        $asset->save();
    }
}
