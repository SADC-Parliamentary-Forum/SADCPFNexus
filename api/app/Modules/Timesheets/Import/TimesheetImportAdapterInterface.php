<?php

namespace App\Modules\Timesheets\Import;

interface TimesheetImportAdapterInterface
{
    /**
     * @param  list<string>  $headers
     */
    public function supports(array $headers): bool;

    /**
     * @param  list<string>  $headers
     * @param  list<mixed>  $values
     * @param  array<string, string>  $columnMap  header => canonical field
     * @return array<string, mixed>
     */
    public function mapRow(array $headers, array $values, array $columnMap = []): array;
}
