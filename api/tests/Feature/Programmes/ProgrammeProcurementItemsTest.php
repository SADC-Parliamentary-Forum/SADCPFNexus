<?php

namespace Tests\Feature\Programmes;

use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProgrammeProcurementItemsTest extends TestCase
{
    public function test_programme_procurement_items_table_has_linkage_columns(): void
    {
        $this->assertTrue(Schema::hasColumn('programme_procurement_items', 'procurement_request_id'));
        $this->assertTrue(Schema::hasColumn('programme_procurement_items', 'currency'));
        $this->assertTrue(Schema::hasColumn('programme_procurement_items', 'rfq_required'));
    }
}
