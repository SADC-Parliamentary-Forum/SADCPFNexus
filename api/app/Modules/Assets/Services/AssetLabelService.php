<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetLabelBatch;
use App\Models\AssetLabelBatchItem;
use App\Models\AssetLabelTemplate;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetLabelLayout;
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

            $recovery = app(AssetRecoveryContactService::class)->current((int) $user->tenant_id);
            foreach ($assets->values() as $i => $asset) {
                $previous = \App\Models\AssetLabel::query()
                    ->where('asset_id', $asset->id)
                    ->where('status', 'current')
                    ->latest('id')
                    ->first();
                $version = $previous ? ((int) $previous->label_version) + 1 : 1;
                $qrToken = \App\Models\AssetQrToken::query()
                    ->where('asset_id', $asset->id)
                    ->where('token', $asset->qr_token)
                    ->whereNull('revoked_at')
                    ->first();
                $label = \App\Models\AssetLabel::create([
                    'tenant_id' => $asset->tenant_id,
                    'asset_id' => $asset->id,
                    'template_id' => $template->id,
                    'label_version' => $version,
                    'qr_token_id' => $qrToken?->id,
                    'recovery_contact_version' => $recovery?->version,
                    'printed_custodian_id' => $asset->assigned_to,
                    'printed_location_id' => $asset->location_id,
                    'printed_description' => $asset->name,
                    'printed_phone' => $recovery?->primary_phone,
                    'printed_email' => $recovery?->email,
                    'printed_at' => now(),
                    'printed_by' => $user->id,
                    'status' => 'current',
                    'label_batch_id' => $batch->id,
                ]);
                if ($previous) {
                    $previous->status = 'replaced';
                    $previous->replaced_by_label_id = $label->id;
                    $previous->save();
                }
                AssetLabelBatchItem::create([
                    'label_batch_id' => $batch->id,
                    'asset_id' => $asset->id,
                    'position' => $i + 1,
                    'recovery_contact_version' => $recovery?->version,
                    'printed_custodian_id' => $asset->assigned_to,
                    'printed_location_id' => $asset->location_id,
                    'printed_description' => $asset->name,
                    'asset_label_id' => $label->id,
                ]);
                $asset->label_status = 'printed';
                $asset->label_reprint_reason = null;
                $asset->save();
                app(AssetTimelineService::class)->record(
                    $asset,
                    'LABEL_PRINTED',
                    'Label version '.$version.' printed',
                    $user,
                    ['batch' => $batch->batch_number]
                );
            }

            $labels = $assets->map(fn (Asset $asset) => $this->labelData($asset, $template))->all();
            $pdf = Pdf::loadView('pdf.asset_labels', [
                'template' => $template,
                'labels' => $labels,
                'batch' => $batch,
                'layoutItems' => AssetLabelLayout::resolve($template),
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

        $recovery = app(AssetRecoveryContactService::class)->current((int) $asset->tenant_id);

        return [
            'asset_tag' => $asset->tag_number ?: $asset->asset_code,
            'name' => $asset->name,
            'model' => $asset->model,
            'serial' => $asset->serial_number,
            'location' => $asset->location?->name ?: $asset->legacy_location,
            'custodian' => $asset->assignedUser?->name,
            'owner' => $asset->owner_name ?: 'SADC Parliamentary Forum',
            'recovery_phone' => $recovery?->primary_phone,
            'recovery_email' => $recovery?->email,
            'recovery_whatsapp' => $recovery?->whatsapp,
            'scan_hint' => 'Scan for current information',
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
        \App\Models\AssetLabel::query()
            ->where('asset_id', $asset->id)
            ->where('status', 'current')
            ->update(['status' => 'reprint_required', 'reprint_reason' => $reason]);
    }

    public function ensureDefaultTemplates(int $tenantId): void
    {
        AssetLabelTemplate::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => 'avery_l7161_permanent'],
            [
                'name' => 'Avery L7161 permanent (63.5 × 46.6 mm, 18-up)',
                'kind' => 'permanent',
                'page_size' => 'A4',
                'page_width_mm' => 210,
                'page_height_mm' => 297,
                'margin_top_mm' => 8.7,
                'margin_left_mm' => 4.7,
                'label_width_mm' => 63.5,
                'label_height_mm' => 46.6,
                'h_gap_mm' => 2.5,
                'v_gap_mm' => 0,
                'rows' => 6,
                'columns' => 3,
                'font_pt' => 8,
                'qr_mm' => 22,
                'is_default' => true,
                'is_active' => true,
            ]
        );
        AssetLabelTemplate::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => 'avery_l7161_custody'],
            [
                'name' => 'Avery L7161 custody (63.5 × 46.6 mm, 18-up)',
                'kind' => 'custody',
                'page_size' => 'A4',
                'page_width_mm' => 210,
                'page_height_mm' => 297,
                'margin_top_mm' => 8.7,
                'margin_left_mm' => 4.7,
                'label_width_mm' => 63.5,
                'label_height_mm' => 46.6,
                'h_gap_mm' => 2.5,
                'v_gap_mm' => 0,
                'rows' => 6,
                'columns' => 3,
                'font_pt' => 8,
                'qr_mm' => 22,
                'is_default' => false,
                'is_active' => true,
            ]
        );
        AssetLabelTemplate::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => 'thermal_70x40'],
            [
                'name' => 'Thermal 70 × 40 mm',
                'kind' => 'permanent',
                'page_size' => 'custom',
                'page_width_mm' => 70,
                'page_height_mm' => 40,
                'margin_top_mm' => 2,
                'margin_left_mm' => 2,
                'label_width_mm' => 70,
                'label_height_mm' => 40,
                'h_gap_mm' => 0,
                'v_gap_mm' => 0,
                'rows' => 1,
                'columns' => 1,
                'font_pt' => 8,
                'qr_mm' => 18,
                'is_default' => false,
                'is_active' => true,
            ]
        );
    }
}
