<?php

namespace App\Modules\PeopleAuthority\Contracts;

interface DirectorySyncProviderInterface
{
    public function driverName(): string;

    public function isConfigured(): bool;

    /**
     * Read-only fetch of directory people/org records.
     *
     * @return list<array{external_id:string,display_name:?string,given_name:?string,surname:?string,mail:?string,job_title:?string,department:?string,raw?:array}>
     */
    public function fetchPeople(): array;
}
