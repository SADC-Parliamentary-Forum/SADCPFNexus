<?php

namespace Database\Seeders;

use App\Models\Attachment;
use App\Models\Programme;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class ProgrammeAttachmentSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) {
            return;
        }

        $staff = User::where('email', 'staff@sadcpf.org')->first();
        if (!$staff) {
            return;
        }

        $programme = Programme::where('tenant_id', $tenant->id)
            ->where('reference_number', 'PIF-2026-001')
            ->first();
        if (!$programme) {
            return;
        }

        $dir = 'attachments/programmes/' . $programme->id;
        $placeholderPath = $dir . '/placeholder.txt';
        Storage::disk('local')->put($placeholderPath, 'Demo attachment for testing. Download works when this file exists.' . "\n");
        $size = Storage::disk('local')->size($placeholderPath);

        $attachments = [
            [
                'document_type'     => Attachment::DOCUMENT_TYPE_MEMO,
                'original_filename' => 'demo-memo.txt',
                'storage_path'      => $placeholderPath,
                'mime_type'         => 'text/plain',
                'size_bytes'        => $size,
                'is_chosen_quote'   => false,
                'selection_reason'  => null,
            ],
            [
                'document_type'     => Attachment::DOCUMENT_TYPE_HOTEL_QUOTE,
                'original_filename' => 'hotel-quote-lusaka.pdf',
                'storage_path'      => $placeholderPath,
                'mime_type'         => 'application/pdf',
                'size_bytes'        => $size,
                'is_chosen_quote'   => true,
                'selection_reason'  => 'Best value and location.',
            ],
            [
                'document_type'     => Attachment::DOCUMENT_TYPE_TRANSPORT_QUOTE,
                'original_filename' => 'transport-quote-demo.txt',
                'storage_path'      => $placeholderPath,
                'mime_type'         => 'text/plain',
                'size_bytes'        => $size,
                'is_chosen_quote'   => false,
                'selection_reason'  => null,
            ],
        ];

        foreach ($attachments as $data) {
            Attachment::firstOrCreate(
                [
                    'attachable_type' => Programme::class,
                    'attachable_id'   => $programme->id,
                    'original_filename' => $data['original_filename'],
                ],
                array_merge($data, [
                    'tenant_id'   => $tenant->id,
                    'uploaded_by' => $staff->id,
                ])
            );
        }
    }
}
