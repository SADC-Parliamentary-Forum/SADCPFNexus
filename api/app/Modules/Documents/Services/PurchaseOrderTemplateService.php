<?php

namespace App\Modules\Documents\Services;

use App\Models\AuditLog;
use App\Models\DocumentTemplate;
use App\Models\DocumentTemplateVersion;
use App\Models\User;
use App\Modules\Documents\Support\LegacyPurchaseOrderLayout;
use App\Modules\Documents\Support\PurchaseOrderLayoutSanitizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class PurchaseOrderTemplateService
{
    public function ensureDefault(int $tenantId, ?User $actor = null): DocumentTemplate
    {
        $existing = DocumentTemplate::query()
            ->where('tenant_id', $tenantId)
            ->where('document_type', 'purchase_order')
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first();
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($tenantId, $actor) {
            $template = DocumentTemplate::query()->create([
                'tenant_id' => $tenantId,
                'document_type' => 'purchase_order',
                'name' => 'SADC PF — Legacy Purchase Order',
                'description' => 'Institutional LPO layout matching the S 04015 paper form (without cents columns).',
                'page_size' => 'a4',
                'orientation' => 'portrait',
                'status' => 'published',
                'is_default' => true,
                'created_by' => $actor?->id,
            ]);
            $layout = LegacyPurchaseOrderLayout::layout();
            DocumentTemplateVersion::query()->create([
                'tenant_id' => $tenantId,
                'document_template_id' => $template->id,
                'version' => 1,
                'layout_json' => $layout,
                'field_catalog_hash' => PurchaseOrderLayoutSanitizer::catalogHash(),
                'status' => 'published',
                'published_at' => now(),
                'published_by' => $actor?->id,
            ]);
            DocumentTemplateVersion::query()->create([
                'tenant_id' => $tenantId,
                'document_template_id' => $template->id,
                'version' => 2,
                'layout_json' => $layout,
                'field_catalog_hash' => PurchaseOrderLayoutSanitizer::catalogHash(),
                'status' => 'draft',
            ]);

            return $template->fresh(['draftVersion', 'publishedVersion']);
        });
    }

    /**
     * @return list<DocumentTemplate>
     */
    public function list(int $tenantId): array
    {
        $this->ensureDefault($tenantId);

        return DocumentTemplate::query()
            ->where('tenant_id', $tenantId)
            ->where('document_type', 'purchase_order')
            ->with(['draftVersion', 'publishedVersion'])
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(int $tenantId, User $actor, array $data): DocumentTemplate
    {
        $layout = PurchaseOrderLayoutSanitizer::sanitize($data['layout_json'] ?? LegacyPurchaseOrderLayout::layout());

        return DB::transaction(function () use ($tenantId, $actor, $data, $layout) {
            $template = DocumentTemplate::query()->create([
                'tenant_id' => $tenantId,
                'document_type' => 'purchase_order',
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'page_size' => 'a4',
                'orientation' => in_array($data['orientation'] ?? 'portrait', ['portrait', 'landscape'], true)
                    ? $data['orientation']
                    : 'portrait',
                'status' => 'draft',
                'is_default' => false,
                'matching_rules' => $data['matching_rules'] ?? null,
                'created_by' => $actor->id,
            ]);
            DocumentTemplateVersion::query()->create([
                'tenant_id' => $tenantId,
                'document_template_id' => $template->id,
                'version' => 1,
                'layout_json' => $layout,
                'field_catalog_hash' => PurchaseOrderLayoutSanitizer::catalogHash(),
                'status' => 'draft',
            ]);

            return $template->fresh(['draftVersion', 'publishedVersion']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function saveDraft(DocumentTemplate $template, User $actor, array $data): DocumentTemplate
    {
        $this->assertTenant($template, $actor);
        $draft = $this->draftOrCreate($template);
        if (isset($data['name'])) {
            $template->name = $data['name'];
        }
        if (array_key_exists('description', $data)) {
            $template->description = $data['description'];
        }
        if (isset($data['orientation']) && in_array($data['orientation'], ['portrait', 'landscape'], true)) {
            $template->orientation = $data['orientation'];
        }
        $template->save();
        if (isset($data['layout_json'])) {
            $draft->layout_json = PurchaseOrderLayoutSanitizer::sanitize($data['layout_json']);
            $draft->field_catalog_hash = PurchaseOrderLayoutSanitizer::catalogHash();
            $draft->save();
        }

        return $template->fresh(['draftVersion', 'publishedVersion']);
    }

    public function publish(DocumentTemplate $template, User $actor): DocumentTemplate
    {
        $this->assertTenant($template, $actor);
        if (! $actor->hasAnyPermission(['procurement.template.publish', 'procurement.admin']) && ! $actor->hasRole('System Admin')) {
            abort(403);
        }
        $draft = $template->draftVersion;
        if (! $draft) {
            throw ValidationException::withMessages(['template' => 'There is no draft to publish.']);
        }
        $previous = $template->publishedVersion?->version;

        return DB::transaction(function () use ($template, $draft, $actor, $previous) {
            $draft->update([
                'status' => 'published',
                'published_at' => now(),
                'published_by' => $actor->id,
                'layout_json' => PurchaseOrderLayoutSanitizer::sanitize($draft->layout_json),
            ]);
            DocumentTemplateVersion::query()->create([
                'tenant_id' => $template->tenant_id,
                'document_template_id' => $template->id,
                'version' => $draft->version + 1,
                'layout_json' => $draft->layout_json,
                'field_catalog_hash' => PurchaseOrderLayoutSanitizer::catalogHash(),
                'status' => 'draft',
            ]);
            $template->update(['status' => 'published']);
            AuditLog::record('procurement.template.published', [
                'auditable_type' => DocumentTemplate::class,
                'auditable_id' => $template->id,
                'new_values' => [
                    'version' => $draft->version,
                    'previous_version' => $previous,
                    'name' => $template->name,
                ],
                'tags' => 'procurement',
            ]);

            return $template->fresh(['draftVersion', 'publishedVersion']);
        });
    }

    public function retire(DocumentTemplate $template, User $actor): DocumentTemplate
    {
        $this->assertTenant($template, $actor);
        if ($template->is_default) {
            throw ValidationException::withMessages(['template' => 'Set another default template before retiring this one.']);
        }
        $template->update(['status' => 'retired', 'is_default' => false]);
        AuditLog::record('procurement.template.retired', [
            'auditable_type' => DocumentTemplate::class,
            'auditable_id' => $template->id,
            'tags' => 'procurement',
        ]);

        return $template->fresh();
    }

    public function setDefault(DocumentTemplate $template, User $actor): DocumentTemplate
    {
        $this->assertTenant($template, $actor);
        DocumentTemplate::query()
            ->where('tenant_id', $template->tenant_id)
            ->where('document_type', 'purchase_order')
            ->update(['is_default' => false]);
        $template->update(['is_default' => true, 'status' => $template->status === 'retired' ? 'published' : $template->status]);

        return $template->fresh(['draftVersion', 'publishedVersion']);
    }

    public function publishedLayoutFor(?DocumentTemplate $template, int $tenantId): array
    {
        $template ??= $this->defaultTemplate($tenantId);
        $version = $template->publishedVersion ?: $template->draftVersion;
        $layout = $version?->layout_json ?? LegacyPurchaseOrderLayout::layout();

        return [$template, $version, PurchaseOrderLayoutSanitizer::sanitize($layout)];
    }

    public function defaultTemplate(int $tenantId): DocumentTemplate
    {
        $this->ensureDefault($tenantId);

        return DocumentTemplate::query()
            ->where('tenant_id', $tenantId)
            ->where('document_type', 'purchase_order')
            ->where('is_default', true)
            ->with(['draftVersion', 'publishedVersion'])
            ->first() ?? $this->ensureDefault($tenantId);
    }

    public function fieldCatalog(): array
    {
        return [
            'types' => PurchaseOrderLayoutSanitizer::TYPES,
            'bindings' => PurchaseOrderLayoutSanitizer::BINDINGS,
            'table_columns' => PurchaseOrderLayoutSanitizer::TABLE_COLUMNS,
            'approval_layouts' => PurchaseOrderLayoutSanitizer::APPROVAL_LAYOUTS,
            'hash' => PurchaseOrderLayoutSanitizer::catalogHash(),
        ];
    }

    private function draftOrCreate(DocumentTemplate $template): DocumentTemplateVersion
    {
        $draft = $template->draftVersion;
        if ($draft) {
            return $draft;
        }
        $latest = $template->versions()->orderByDesc('version')->first();

        return DocumentTemplateVersion::query()->create([
            'tenant_id' => $template->tenant_id,
            'document_template_id' => $template->id,
            'version' => ($latest?->version ?? 0) + 1,
            'layout_json' => $latest?->layout_json ?? LegacyPurchaseOrderLayout::layout(),
            'field_catalog_hash' => PurchaseOrderLayoutSanitizer::catalogHash(),
            'status' => 'draft',
        ]);
    }

    private function assertTenant(DocumentTemplate $template, User $actor): void
    {
        if ((int) $template->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
