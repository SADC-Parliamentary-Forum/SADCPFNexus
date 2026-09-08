<?php

namespace App\Modules\Procurement\Support;

use App\Modules\Procurement\Contracts\ProcurementInboxAdapter;

final class ProcurementInboxFactory
{
    public function make(): ProcurementInboxAdapter
    {
        $driver = strtolower(trim((string) config('procurement.inbox_imap_adapter', 'php_imap')));
        if (in_array($driver, ['unconfigured', 'none', 'null'], true)) {
            return new ImapUnconfiguredAdapter;
        }

        $adapter = new PhpImapInboxAdapter;

        return $adapter->isConfigured() ? $adapter : new ImapUnconfiguredAdapter;
    }
}
