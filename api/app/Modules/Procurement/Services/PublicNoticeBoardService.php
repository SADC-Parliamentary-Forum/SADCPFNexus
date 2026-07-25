<?php

namespace App\Modules\Procurement\Services;

use App\Models\Tender;
use Illuminate\Support\Collection;

class PublicNoticeBoardService
{
    /**
     * Public-safe fields only — never expose bids, amounts, or internal IDs.
     */
    public function publishedNotices(?int $tenantId = null): Collection
    {
        $query = Tender::query()
            ->where('status', Tender::STATUS_PUBLISHED)
            ->whereNotNull('published_at')
            ->orderBy('submission_deadline')
            ->orderByDesc('published_at');

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        return $query->get()->map(fn (Tender $t) => $this->toPublicArray($t));
    }

    public function toPublicArray(Tender $tender): array
    {
        return [
            'reference_number'    => $tender->reference_number,
            'title'               => $tender->title,
            'notice'              => $tender->notice,
            'status'              => $tender->status,
            'published_at'        => optional($tender->published_at)?->toIso8601String(),
            'submission_deadline' => optional($tender->submission_deadline)?->toDateString(),
            'sealed_mode'         => (bool) $tender->sealed_mode,
        ];
    }
}
