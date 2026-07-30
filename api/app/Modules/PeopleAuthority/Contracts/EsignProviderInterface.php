<?php

namespace App\Modules\PeopleAuthority\Contracts;

interface EsignProviderInterface
{
    public function driverName(): string;

    public function isConfigured(): bool;

    /**
     * Human-triggered submit only. Providers must not auto-start from schedules.
     *
     * @param  array{document_type:string,document_id:int|string,document_hash:string,recipients:array,payload?:array}  $request
     * @return array{external_id:?string,status:string,response:array<string,mixed>}
     */
    public function submit(array $request): array;
}
