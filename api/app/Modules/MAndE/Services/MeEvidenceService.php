<?php

namespace App\Modules\MAndE\Services;

use App\Models\AuditLog;
use App\Models\MeActivityReport;
use App\Models\MeEvidence;
use App\Models\User;
use App\Support\UploadContentSniffer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MeEvidenceService
{
    /**
     * Upload an evidence item against an activity report. The physical file is
     * stored as a polymorphic Attachment on the MeEvidence record (reusing the
     * shared attachments table).
     */
    public function upload(MeActivityReport $report, UploadedFile $file, array $data, User $user): MeEvidence
    {
        return DB::transaction(function () use ($report, $file, $data, $user) {
            // Version = next version for the same indicator/title scope.
            $version = MeEvidence::where('me_activity_report_id', $report->id)
                ->where('indicator_id', $data['indicator_id'] ?? null)
                ->max('version');
            $version = $version ? $version + 1 : 1;

            $evidence = MeEvidence::create([
                'tenant_id'             => $report->tenant_id,
                'me_activity_report_id' => $report->id,
                'programme_id'          => $report->programme_id,
                'indicator_id'          => $data['indicator_id'] ?? null,
                'title'                 => $data['title'] ?? $file->getClientOriginalName(),
                'evidence_type'         => $data['evidence_type'] ?? 'other',
                'review_status'         => MeEvidence::REVIEW_PENDING,
                'version'               => $version,
                'uploaded_by'           => $user->id,
            ]);

            $mime = UploadContentSniffer::assertAllowed($file);
            $path = $file->store('attachments/mande/evidence/' . $report->id, ['disk' => 'local']);

            $evidence->attachments()->create([
                'tenant_id'         => $report->tenant_id,
                'uploaded_by'       => $user->id,
                'document_type'     => 'me_evidence',
                'original_filename' => $file->getClientOriginalName(),
                'storage_path'      => $path,
                'mime_type'         => $mime,
                'size_bytes'        => $file->getSize(),
            ]);

            AuditLog::record('mande.evidence.uploaded', [
                'auditable_type' => MeEvidence::class,
                'auditable_id'   => $evidence->id,
                'new_values'     => ['type' => $evidence->evidence_type, 'report' => $report->reference_number],
                'tags'           => 'mande',
            ]);

            return $evidence->load('attachments', 'uploader:id,name');
        });
    }

    public function validateEvidence(MeEvidence $evidence, string $status, ?string $notes, User $reviewer): MeEvidence
    {
        $evidence->update([
            'review_status' => $status, // validated|rejected
            'review_notes'  => $notes,
            'reviewed_by'   => $reviewer->id,
            'reviewed_at'   => now(),
        ]);

        AuditLog::record('mande.evidence.reviewed', [
            'auditable_type' => MeEvidence::class,
            'auditable_id'   => $evidence->id,
            'new_values'     => ['review_status' => $status],
            'tags'           => 'mande',
        ]);

        return $evidence->fresh(['attachments', 'uploader:id,name']);
    }

    public function delete(MeEvidence $evidence, User $user): void
    {
        foreach ($evidence->attachments as $attachment) {
            if ($attachment->storage_path && Storage::disk('local')->exists($attachment->storage_path)) {
                Storage::disk('local')->delete($attachment->storage_path);
            }
            $attachment->delete();
        }

        AuditLog::record('mande.evidence.deleted', [
            'auditable_type' => MeEvidence::class,
            'auditable_id'   => $evidence->id,
            'tags'           => 'mande',
        ]);

        $evidence->delete();
    }
}
