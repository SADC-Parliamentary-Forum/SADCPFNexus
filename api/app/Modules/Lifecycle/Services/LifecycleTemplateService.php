<?php

namespace App\Modules\Lifecycle\Services;

use App\Models\Lifecycle\LifecycleJourneyTemplate;
use App\Models\Lifecycle\LifecycleJourneyTemplateVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LifecycleTemplateService
{
    public function list(User $user, ?string $lifecycleType = null): array
    {
        $q = LifecycleJourneyTemplate::with(['publishedVersion'])
            ->where('tenant_id', $user->tenant_id);

        if ($lifecycleType) {
            $q->where('lifecycle_type', $lifecycleType);
        }

        return $q->orderBy('name')->get()->map(fn ($t) => [
            'id' => $t->id,
            'code' => $t->code,
            'name' => $t->name,
            'lifecycle_type' => $t->lifecycle_type,
            'published_version' => $t->publishedVersion ? [
                'id' => $t->publishedVersion->id,
                'version_number' => $t->publishedVersion->version_number,
                'published_at' => $t->publishedVersion->published_at?->toIso8601String(),
            ] : null,
        ])->all();
    }

    public function resolvePublishedVersion(User $user, string $templateCode, string $lifecycleType): LifecycleJourneyTemplateVersion
    {
        $template = LifecycleJourneyTemplate::where('tenant_id', $user->tenant_id)
            ->where('code', $templateCode)
            ->where('lifecycle_type', $lifecycleType)
            ->first();

        if (! $template) {
            throw ValidationException::withMessages(['template_code' => 'Journey template not found.']);
        }

        $version = LifecycleJourneyTemplateVersion::where('template_id', $template->id)
            ->where('status', 'published')
            ->orderByDesc('version_number')
            ->first();

        if (! $version) {
            throw ValidationException::withMessages(['template_code' => 'No published version for this journey template.']);
        }

        return $version;
    }

    public function createDraft(User $user, array $data): LifecycleJourneyTemplateVersion
    {
        return DB::transaction(function () use ($user, $data) {
            $template = LifecycleJourneyTemplate::firstOrCreate(
                [
                    'tenant_id' => $user->tenant_id,
                    'code' => $data['code'],
                ],
                [
                    'name' => $data['name'],
                    'lifecycle_type' => $data['lifecycle_type'],
                    'status' => 'active',
                    'created_by' => $user->id,
                ]
            );

            $nextVersion = (int) LifecycleJourneyTemplateVersion::where('template_id', $template->id)->max('version_number') + 1;

            return LifecycleJourneyTemplateVersion::create([
                'tenant_id' => $user->tenant_id,
                'template_id' => $template->id,
                'version_number' => max(1, $nextVersion),
                'status' => 'draft',
                'definition' => $data['definition'],
                'created_by' => $user->id,
            ]);
        });
    }

    public function publish(LifecycleJourneyTemplateVersion $version, User $user): LifecycleJourneyTemplateVersion
    {
        if ($version->tenant_id !== $user->tenant_id) {
            abort(404);
        }

        if ($version->status === 'published') {
            throw ValidationException::withMessages(['status' => 'Version is already published and immutable.']);
        }

        return DB::transaction(function () use ($version, $user) {
            LifecycleJourneyTemplateVersion::where('template_id', $version->template_id)
                ->where('status', 'published')
                ->update(['status' => 'archived']);

            $version->update([
                'status' => 'published',
                'published_at' => now(),
                'published_by' => $user->id,
            ]);

            return $version->fresh();
        });
    }

    public function showVersion(LifecycleJourneyTemplateVersion $version, User $user): array
    {
        if ($version->tenant_id !== $user->tenant_id) {
            abort(404);
        }

        return [
            'id' => $version->id,
            'template_id' => $version->template_id,
            'version_number' => $version->version_number,
            'status' => $version->status,
            'definition' => $version->definition,
            'published_at' => $version->published_at?->toIso8601String(),
            'immutable' => $version->status === 'published',
        ];
    }
}
