<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelRequest;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class TravelPackService
{
    public function __construct(
        private readonly TravelService $travelService,
    ) {}

    public function download(TravelRequest $travel): BinaryFileResponse
    {
        $travel->load([
            'requester', 'itineraries', 'fundingLines', 'dsaLines',
            'accommodations', 'attachments', 'programme', 'mission',
        ]);

        $tmp = tempnam(sys_get_temp_dir(), 'travelpack_');
        $zipPath = $tmp.'.zip';
        @unlink($tmp);

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Unable to create travel pack archive.');
        }

        $summary = [
            'reference' => $travel->reference_number,
            'purpose' => $travel->purpose,
            'traveller' => $travel->requester?->name,
            'destination' => trim(($travel->destination_city ? $travel->destination_city.', ' : '').($travel->destination_country ?? ''), ', '),
            'departure_date' => $travel->departure_date?->toDateString(),
            'return_date' => $travel->return_date?->toDateString(),
            'visa_status' => $travel->visa_status,
            'visa_required' => (bool) $travel->visa_required,
            'finance_dsa_total' => $travel->finance_dsa_total,
            'currency' => $travel->currency,
            'booking_committed_at' => optional($travel->booking_committed_at)?->toIso8601String(),
            'itinerary' => $travel->itineraries->map(fn ($leg) => [
                'from' => $leg->from_location,
                'to' => $leg->to_location,
                'date' => $leg->travel_date?->toDateString(),
                'mode' => $leg->transport_mode,
                'flight_name' => $leg->flight_name ?? null,
                'flight_number' => $leg->flight_number ?? null,
            ])->all(),
            'accommodations' => $travel->accommodations->map(fn ($a) => [
                'hotel' => $a->hotel_name,
                'city' => $a->city,
                'check_in' => $a->check_in?->toDateString(),
                'check_out' => $a->check_out?->toDateString(),
                'confirmation' => $a->confirmation_number,
                'paid_by' => $a->paid_by,
            ])->all(),
            'dsa_lines' => $travel->dsaLines->map(fn ($l) => [
                'date' => $l->date?->toDateString(),
                'rate_type' => $l->rate_type,
                'amount' => $l->amount ?? $l->total ?? null,
                'is_personal' => $l->is_personal ?? false,
            ])->all(),
            'contact' => [
                'email' => $travel->requester?->email,
                'name' => $travel->requester?->name,
            ],
        ];

        $zip->addFromString('summary.json', json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        try {
            $pdf = $this->travelService->authorisationPdf($travel);
            $zip->addFromString('requisition.pdf', $pdf->output());
        } catch (\Throwable $e) {
            $zip->addFromString('requisition_error.txt', 'PDF generation failed: '.$e->getMessage());
        }

        foreach ($travel->attachments as $attachment) {
            $path = $attachment->storage_path ?? null;
            if (! $path || ! $attachment->existsOnDisk()) {
                continue;
            }
            $disk = method_exists($attachment, 'getStorageDisk') ? $attachment->getStorageDisk() : 'local';
            $name = preg_replace('/[^A-Za-z0-9._-]+/', '_', $attachment->original_filename ?? $attachment->filename ?? ('doc-'.$attachment->id));
            $type = $attachment->document_type ?: 'document';
            $zip->addFromString("attachments/{$type}_{$attachment->id}_{$name}", Storage::disk($disk)->get($path));
        }

        $zip->close();

        $filename = 'TRAVEL-PACK-'.$travel->reference_number.'.zip';

        return response()->download($zipPath, $filename, [
            'Content-Type' => 'application/zip',
        ])->deleteFileAfterSend(true);
    }
}
