<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Jobs\SendCorrespondenceMailJob;
use App\Models\AuditLog;
use App\Models\Correspondence;
use App\Models\CorrespondenceRecipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CorrespondenceController extends Controller
{
    private function checkPerm(Request $request, string $permission): void
    {
        $user = $request->user();
        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo($permission, 'sanctum'), 403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $user = $request->user();
        $query = Correspondence::where('tenant_id', $user->tenant_id)
            ->with(['creator:id,name,email', 'department:id,name'])
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }
        if ($direction = $request->input('direction')) {
            $query->where('direction', $direction);
        }
        if ($dateFrom = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'ilike', "%{$search}%")
                  ->orWhere('title', 'ilike', "%{$search}%")
                  ->orWhere('reference_number', 'ilike', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 25), 100);
        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $user = $request->user();

        $data = $request->validate([
            'title'          => ['required', 'string', 'max:500'],
            'subject'        => ['required', 'string', 'max:500'],
            'body'           => ['nullable', 'string', 'max:10000'],
            'type'           => ['required', 'string', 'in:internal_memo,external,diplomatic_note,procurement'],
            'priority'       => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'language'       => ['nullable', 'string', 'in:en,fr,pt'],
            'direction'      => ['nullable', 'string', 'in:outgoing,incoming'],
            'file_code'      => ['nullable', 'string', 'max:32'],
            'signatory_code' => ['nullable', 'string', 'max:16'],
            'department_id'  => ['nullable', 'integer', 'exists:departments,id'],
            'programme_id'   => ['nullable', 'integer'],
            'file'           => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:25600'],
        ]);

        $filePath = null;
        $originalFilename = null;
        $mimeType = null;
        $sizeBytes = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $filePath = $file->store('correspondence/' . $user->tenant_id . '/drafts', ['disk' => 'local']);
            $originalFilename = $file->getClientOriginalName();
            $mimeType = $file->getMimeType();
            $sizeBytes = $file->getSize();
        }

        $correspondence = Correspondence::create([
            'tenant_id'         => $user->tenant_id,
            'created_by'        => $user->id,
            'title'             => $data['title'],
            'subject'           => $data['subject'],
            'body'              => $data['body'] ?? null,
            'type'              => $data['type'],
            'priority'          => $data['priority'] ?? 'normal',
            'language'          => $data['language'] ?? 'en',
            'direction'         => $data['direction'] ?? 'outgoing',
            'file_code'         => $data['file_code'] ?? null,
            'signatory_code'    => $data['signatory_code'] ?? null,
            'department_id'     => $data['department_id'] ?? null,
            'programme_id'      => $data['programme_id'] ?? null,
            'file_path'         => $filePath,
            'original_filename' => $originalFilename,
            'mime_type'         => $mimeType,
            'size_bytes'        => $sizeBytes,
            'status'            => 'draft',
        ]);

        AuditLog::record('correspondence.created', [
            'auditable_type' => Correspondence::class,
            'auditable_id'   => $correspondence->id,
            'new_values'     => ['title' => $correspondence->title, 'status' => 'draft'],
        ]);

        return response()->json([
            'message' => 'Correspondence created.',
            'data'    => $correspondence->load(['creator:id,name,email', 'department:id,name']),
        ], 201);
    }

    public function show(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json([
            'data' => $correspondence->load([
                'creator:id,name,email',
                'reviewer:id,name',
                'approver:id,name',
                'department:id,name',
                'recipients.contact',
            ]),
        ]);
    }

    public function update(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->isDraft()) {
            return response()->json(['message' => 'Only draft correspondence can be edited.'], 422);
        }

        $data = $request->validate([
            'title'          => ['sometimes', 'string', 'max:500'],
            'subject'        => ['sometimes', 'string', 'max:500'],
            'body'           => ['nullable', 'string', 'max:10000'],
            'type'           => ['sometimes', 'string', 'in:internal_memo,external,diplomatic_note,procurement'],
            'priority'       => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'language'       => ['nullable', 'string', 'in:en,fr,pt'],
            'direction'      => ['nullable', 'string', 'in:outgoing,incoming'],
            'file_code'      => ['nullable', 'string', 'max:32'],
            'signatory_code' => ['nullable', 'string', 'max:16'],
            'department_id'  => ['nullable', 'integer', 'exists:departments,id'],
            'programme_id'   => ['nullable', 'integer'],
            'file'           => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:25600'],
        ]);

        if ($request->hasFile('file')) {
            // Remove old file
            if ($correspondence->file_path && Storage::disk('local')->exists($correspondence->file_path)) {
                Storage::disk('local')->delete($correspondence->file_path);
            }
            $file = $request->file('file');
            $data['file_path'] = $file->store(
                'correspondence/' . $correspondence->tenant_id . '/drafts',
                ['disk' => 'local']
            );
            $data['original_filename'] = $file->getClientOriginalName();
            $data['mime_type'] = $file->getMimeType();
            $data['size_bytes'] = $file->getSize();
        }
        unset($data['file']);

        $correspondence->update($data);

        return response()->json([
            'message' => 'Correspondence updated.',
            'data'    => $correspondence->fresh(['creator:id,name,email', 'department:id,name']),
        ]);
    }

    public function destroy(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->isDraft()) {
            return response()->json(['message' => 'Only draft correspondence can be deleted.'], 422);
        }

        if ($correspondence->file_path && Storage::disk('local')->exists($correspondence->file_path)) {
            Storage::disk('local')->delete($correspondence->file_path);
        }

        $correspondence->delete();

        return response()->json(['message' => 'Correspondence deleted.']);
    }

    public function submit(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->isDraft()) {
            return response()->json(['message' => 'Only draft correspondence can be submitted.'], 422);
        }

        $correspondence->update([
            'status'       => 'pending_review',
            'submitted_at' => now(),
        ]);

        AuditLog::record('correspondence.submitted', [
            'auditable_type' => Correspondence::class,
            'auditable_id'   => $correspondence->id,
            'new_values'     => ['status' => 'pending_review'],
        ]);

        return response()->json([
            'message' => 'Correspondence submitted for review.',
            'data'    => $correspondence->fresh(),
        ]);
    }

    public function review(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.review');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->isPendingReview()) {
            return response()->json(['message' => 'Correspondence is not pending review.'], 422);
        }

        $data = $request->validate([
            'action'  => ['required', 'string', 'in:approve,reject'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $newStatus = $data['action'] === 'approve' ? 'pending_approval' : 'draft';

        $correspondence->update([
            'status'         => $newStatus,
            'reviewed_by'    => $user->id,
            'reviewed_at'    => now(),
            'review_comment' => $data['comment'] ?? null,
        ]);

        AuditLog::record('correspondence.reviewed', [
            'auditable_type' => Correspondence::class,
            'auditable_id'   => $correspondence->id,
            'new_values'     => ['status' => $newStatus, 'action' => $data['action']],
        ]);

        return response()->json([
            'message' => $data['action'] === 'approve'
                ? 'Correspondence forwarded for approval.'
                : 'Correspondence returned to author.',
            'data' => $correspondence->fresh(),
        ]);
    }

    public function approve(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.approve');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->isPendingApproval()) {
            return response()->json(['message' => 'Correspondence is not pending approval.'], 422);
        }

        $user = $request->user();
        $referenceNumber = null;

        if ($correspondence->file_code && $correspondence->signatory_code) {
            $referenceNumber = Correspondence::generateReferenceNumber(
                $correspondence->file_code,
                $correspondence->signatory_code,
                $correspondence->creator,
                $correspondence->tenant_id
            );
        }

        $correspondence->update([
            'status'           => 'approved',
            'approved_by'      => $user->id,
            'approved_at'      => now(),
            'reference_number' => $referenceNumber,
        ]);

        AuditLog::record('correspondence.approved', [
            'auditable_type' => Correspondence::class,
            'auditable_id'   => $correspondence->id,
            'new_values'     => [
                'status'           => 'approved',
                'reference_number' => $referenceNumber,
            ],
        ]);

        return response()->json([
            'message' => 'Correspondence approved.',
            'data'    => $correspondence->fresh(['approver:id,name']),
        ]);
    }

    public function send(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.send');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->isApproved()) {
            return response()->json(['message' => 'Correspondence must be approved before sending.'], 422);
        }

        $data = $request->validate([
            'recipients'              => ['required', 'array', 'min:1'],
            'recipients.*.contact_id' => ['required', 'integer', 'exists:correspondence_contacts,id'],
            'recipients.*.type'       => ['required', 'string', 'in:to,cc,bcc'],
        ]);

        // Clear existing recipients and add new ones
        $correspondence->recipients()->delete();

        foreach ($data['recipients'] as $recipientData) {
            $recipient = CorrespondenceRecipient::create([
                'correspondence_id' => $correspondence->id,
                'contact_id'        => $recipientData['contact_id'],
                'recipient_type'    => $recipientData['type'],
                'email_status'      => 'queued',
            ]);

            $contact = $recipient->contact;
            if ($contact) {
                SendCorrespondenceMailJob::dispatch($correspondence, $contact, $recipientData['type']);
            }
        }

        $correspondence->update([
            'status'  => 'sent',
            'sent_at' => now(),
        ]);

        AuditLog::record('correspondence.sent', [
            'auditable_type' => Correspondence::class,
            'auditable_id'   => $correspondence->id,
            'new_values'     => [
                'status'           => 'sent',
                'recipient_count'  => count($data['recipients']),
            ],
        ]);

        return response()->json([
            'message' => 'Correspondence sent to ' . count($data['recipients']) . ' recipient(s).',
            'data'    => $correspondence->fresh(['recipients.contact']),
        ]);
    }

    public function download(Request $request, Correspondence $correspondence): StreamedResponse|JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        abort_unless((int) $correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        if (!$correspondence->file_path || !Storage::disk('local')->exists($correspondence->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return response()->streamDownload(function () use ($correspondence) {
            $stream = Storage::disk('local')->readStream($correspondence->file_path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $correspondence->original_filename ?? 'correspondence.pdf', [
            'Content-Type' => $correspondence->mime_type ?: 'application/octet-stream',
        ]);
    }
}
