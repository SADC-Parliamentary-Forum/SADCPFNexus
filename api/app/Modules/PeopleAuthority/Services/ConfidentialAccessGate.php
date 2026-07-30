<?php

namespace App\Modules\PeopleAuthority\Services;

use App\Models\PeopleAuthority\Person;
use App\Models\PeopleAuthority\PersonConfidentialProfile;
use App\Models\PeopleAuthority\PersonDocument;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Open vs confidential personnel file separation (PRD §11 / §13).
 */
class ConfidentialAccessGate
{
    public function canViewConfidential(User $user): bool
    {
        return $user->can('people.view-confidential')
            || $user->can('people.manage')
            || $user->hasRole(['HR Manager', 'HR Administrator', 'Secretary General']);
    }

    public function assertConfidential(User $user): void
    {
        if (! $this->canViewConfidential($user)) {
            throw ValidationException::withMessages([
                'confidential' => ['Confidential personnel files require people.view-confidential.'],
            ]);
        }
    }

    public function directoryPayload(Person $person): array
    {
        return [
            'id' => $person->id,
            'display_name' => $person->display_name ?: trim($person->first_name.' '.$person->last_name),
            'preferred_name' => $person->preferred_name,
            'work_email' => $person->work_email,
            'work_phone' => $person->work_phone,
            'office_location' => $person->office_location,
            'primary_unit_id' => $person->primary_unit_id,
            'person_type' => $person->person_type,
            'employment_status' => $person->employment_status,
            'photo_path' => $person->photo_path,
            'directory_meta' => $person->directory_meta,
        ];
    }

    public function profilePayload(Person $person, User $viewer): array
    {
        $base = $this->directoryPayload($person);
        $base['operational_meta'] = $person->operational_meta;
        $base['start_date'] = $person->start_date;
        $base['mobile_phone'] = $person->mobile_phone;

        if ($this->canViewConfidential($viewer)) {
            $conf = PersonConfidentialProfile::query()->where('person_id', $person->id)->first();
            $base['confidential'] = $conf;
            $base['confidential_documents'] = PersonDocument::query()
                ->where('person_id', $person->id)
                ->where('file_class', 'confidential')
                ->get();
        } else {
            $base['confidential'] = null;
            $base['open_documents'] = PersonDocument::query()
                ->where('person_id', $person->id)
                ->where('file_class', 'open')
                ->get();
        }

        return $base;
    }
}
