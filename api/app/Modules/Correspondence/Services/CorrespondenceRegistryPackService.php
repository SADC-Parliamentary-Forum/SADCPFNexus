<?php

namespace App\Modules\Correspondence\Services;

use App\Models\Correspondence;
use App\Models\User;

/**
 * Labelled registry/filing checklist. Never calls a live courier; URL stays operator-owned.
 */
class CorrespondenceRegistryPackService
{
    public function pack(Correspondence $letter, User $viewer): array
    {
        abort_unless((int) $letter->tenant_id === (int) $viewer->tenant_id, 404);

        $letter->loadMissing(['dispatches', 'subjectFiles', 'notes']);
        $liveCourier = filled(config('correspondence.courier_tracking_url'));

        $checklist = [
            [
                'key' => 'reference_present',
                'label' => 'Registry or file reference recorded',
                'detected' => filled($letter->reference_number) || filled($letter->registry_reference),
            ],
            [
                'key' => 'subject_present',
                'label' => 'Subject captured',
                'detected' => filled($letter->subject) || filled($letter->title),
            ],
            [
                'key' => 'file_code',
                'label' => 'File code assigned',
                'detected' => filled($letter->file_code),
            ],
            [
                'key' => 'subject_file_linked',
                'label' => 'Subject file linked',
                'detected' => $letter->subjectFiles->isNotEmpty(),
            ],
            [
                'key' => 'retention_stated',
                'label' => 'Retention policy or retain-until date',
                'detected' => filled($letter->retention_policy) || filled($letter->retain_until),
            ],
            [
                'key' => 'dispatch_recorded',
                'label' => 'Dispatch row recorded',
                'detected' => $letter->dispatches->isNotEmpty(),
            ],
            [
                'key' => 'live_courier_configured',
                'label' => 'Live courier URL configured (operator-owned)',
                'detected' => $liveCourier,
            ],
        ];

        return [
            'letter_id' => $letter->id,
            'live_courier' => $liveCourier,
            'courier_is_stub' => ! $liveCourier,
            'checklist' => $checklist,
            'dispatches' => $letter->dispatches->map(fn ($d) => [
                'id' => $d->id,
                'channel' => $d->channel,
                'carrier' => $d->courier_carrier,
                'tracking' => $d->tracking_number ?: $d->tracking_reference,
                'status' => $d->tracking_status ?: $d->delivery_status,
                'mode' => data_get($d->tracking_payload, 'mode', $liveCourier ? 'live' : 'stub'),
                'live_carrier_proof' => false,
            ])->all(),
            'subject_files' => $letter->subjectFiles->map(fn ($f) => [
                'id' => $f->id,
                'title' => $f->title ?? $f->name ?? $f->code ?? null,
                'code' => $f->code ?? $f->file_code ?? null,
            ])->all(),
            'filing_notes' => $letter->notes->take(8)->map(fn ($n) => [
                'id' => $n->id,
                'body' => $n->body ?? $n->note ?? null,
            ])->all(),
            'note' => 'Filing checklist only. Courier refresh stays a stub without an operator courier URL and is not live carrier proof.',
        ];
    }
}
