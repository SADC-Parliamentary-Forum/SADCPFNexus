<?php

namespace App\Modules\Procurement\Contracts;

interface ProcurementInboxAdapter
{
    public function isConfigured(): bool;

    public function adapterName(): string;

    public function statusNote(): string;

    /**
     * @return list<array<string, mixed>>
     */
    public function fetchMessages(): array;
}
