<?php

namespace App\Modules\Procurement\Services;

use App\Models\PurchaseOrder;
use App\Models\User;
use App\Modules\Documents\Services\DocumentNumberingService;

final class LpoSequenceAllocator
{
    public const SCHEME_KEY = DocumentNumberingService::SCHEME_KEY_LPO;

    public function __construct(private readonly DocumentNumberingService $numbers) {}

    /**
     * @return array{formatted: string, sequence: int, scheme_id: int, allocation_id: int|null, normalised: string}
     */
    public function allocate(int $tenantId, ?User $actor = null, ?PurchaseOrder $po = null): array
    {
        return $this->numbers->allocateAuto(
            $tenantId,
            DocumentNumberingService::DOCUMENT_TYPE_PURCHASE_ORDER,
            self::SCHEME_KEY,
            $actor,
            $po,
        );
    }

    public function format(string $prefix, string $separator, int $padding, int $number): string
    {
        return $this->numbers->formatFromPattern(
            $this->numbers->patternFromParts($prefix, $separator, $padding),
            $number,
        );
    }

    public function activate(int $tenantId, User $actor, int $lastLegacyNumber, string $reason): array
    {
        return $this->numbers->activate($tenantId, $actor, $lastLegacyNumber, $reason);
    }

    public function status(int $tenantId): array
    {
        return $this->numbers->status($tenantId);
    }

    public function recordVoid(int $tenantId, string $formatted): void
    {
        $this->numbers->recordVoid($tenantId, $formatted);
    }
}
