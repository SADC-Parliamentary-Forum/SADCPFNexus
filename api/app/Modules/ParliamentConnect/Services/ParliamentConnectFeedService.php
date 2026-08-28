<?php

namespace App\Modules\ParliamentConnect\Services;

use App\Models\GovernanceResolution;
use App\Modules\Procurement\Services\PublicNoticeBoardService;

/**
 * Public read-only parliamentary feed. Admin publishing remains the control plane.
 */
class ParliamentConnectFeedService
{
    public function __construct(private readonly PublicNoticeBoardService $notices) {}

    public function feed(): array
    {
        $resolutions = GovernanceResolution::query()
            ->where(function ($q) {
                $q->whereIn('status', ['adopted', 'implemented', 'published', 'Adopted', 'Implemented']);
            })
            ->orderByDesc('adopted_at')
            ->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'reference_number', 'title', 'description', 'status', 'adopted_at', 'committee']);

        return [
            'title' => 'SADC Parliamentary Forum — Parliament Connect',
            'resolutions' => $resolutions,
            'notices' => $this->notices->publishedNotices(),
        ];
    }
}
