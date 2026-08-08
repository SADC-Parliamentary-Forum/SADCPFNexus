<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Jobs\SendCorrespondenceMailJob;
use App\Models\AuditLog;
use App\Models\Correspondence;
use App\Models\CorrespondenceRecipient;
use App\Modules\Correspondence\Services\CorrespondenceRegisterService;
use App\Modules\Documents\Services\DocumentStorageService;
use App\Services\WorkflowService;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CorrespondenceController extends Controller
{
    public function __construct(
        private readonly CorrespondenceRegisterService $register,
        private readonly DocumentStorageService $documents,
        private readonly WorkflowService $workflowService,
    ) {}

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
        $query = $this->register->accessibleQuery($user)
            ->with(['creator:id,name,email', 'department:id,name', 'primaryOwner:id,name'])
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
        if ($owner = $request->input('primary_owner_id')) {
            $query->where('primary_owner_id', $owner);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'ilike', "%{$search}%")
                  ->orWhere('title', 'ilike', "%{$search}%")
                  ->orWhere('reference_number', 'ilike', "%{$search}%")
                  ->orWhere('registry_reference', 'ilike', "%{$search}%")
                  ->orWhere('sender_name', 'ilike', "%{$search}%");
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
            'confidentiality'=> ['nullable', 'string', 'in:internal,general_official,restricted,confidential,highly_confidential,privileged_legal,hr_confidential,finance_confidential'],
            'response_required' => ['nullable', 'boolean'],
            'sender_deadline' => ['nullable', 'date'],
            'internal_deadline' => ['nullable', 'date'],
            'final_deadline' => ['nullable', 'date'],
            'file'           => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:25600'],
        ]);

        // Prefer dedicated registerIncoming for official incoming with registry rights
        if (($data['direction'] ?? 'outgoing') === 'incoming'
            && ($user->isSystemAdmin() || $user->hasPermissionTo('correspondence.registry', 'sanctum'))
        ) {
            $c = $this->register->registerIncoming($user, $data, $request->file('file'));

            return response()->json([
                'message' => 'Incoming correspondence registered.',
                'data' => $c,
            ], 201);
        }

        $filePath = null;
        $originalFilename = null;
        $mimeType = null;
        $sizeBytes = null;
        $contentHash = null;
        $managedDocumentId = null;
        $documentVersionId = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $stored = $this->documents->storeForModule($user, $file, [
                'title' => $data['title'] ?? $file->getClientOriginalName(),
                'module' => 'correspondence',
                'document_type' => 'correspondence_draft',
                'classification' => strtoupper((string) ($data['confidentiality'] ?? 'UNCLASSIFIED')),
            ]);
            $filePath = $stored['storage_path'];
            $originalFilename = $stored['original_filename'];
            $mimeType = $stored['mime_type'];
            $sizeBytes = $stored['size_bytes'];
            $contentHash = $stored['content_hash'];
            $managedDocumentId = $stored['managed_document_id'];
            $documentVersionId = $stored['document_version_id'];
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
            'confidentiality'   => $data['confidentiality'] ?? 'general_official',
            'response_required' => (bool) ($data['response_required'] ?? false),
            'sender_deadline'   => $data['sender_deadline'] ?? null,
            'internal_deadline' => $data['internal_deadline'] ?? null,
            'final_deadline'    => $data['final_deadline'] ?? null,
            'file_path'         => $filePath,
            'original_filename' => $originalFilename,
            'mime_type'         => $mimeType,
            'size_bytes'        => $sizeBytes,
            'content_hash'      => $contentHash,
            'managed_document_id' => $managedDocumentId,
            'document_version_id' => $documentVersionId,
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
        $this->register->assertCanAccess($correspondence, $request->user());

        $loaded = $correspondence->load([
            'creator:id,name,email',
            'reviewer:id,name',
            'approver:id,name',
            'primaryOwner:id,name,email',
            'department:id,name',
            'recipients.contact',
            'owners.user:id,name',
            'routes',
            'notes.author:id,name',
            'dispatches',
            'subjectFiles',
            'assignmentLinks.assignment',
        ]);

        $redacted = $this->register->redactForUser($loaded, $request->user());

        return response()->json([
            'data' => $redacted,
            'can_view_content' => $this->register->canViewContent($correspondence, $request->user()),
            'external_payload' => $correspondence->externalPayload(),
        ]);
    }

    public function update(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $this->register->assertCanAccess($correspondence, $request->user());

        if (!$correspondence->isDraft()) {
            return response()->json(['message' => 'Only draft correspondence can be edited.'], 422);
        }

        $this->register->assertMutable($correspondence, $request->hasFile('file'));

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
            'confidentiality'=> ['nullable', 'string', 'max:32'],
            'file'           => ['nullable', 'file', 'mimes:pdf,doc,docx', 'max:25600'],
        ]);

        if ($request->hasFile('file')) {
            if ($correspondence->file_path && Storage::disk('local')->exists($correspondence->file_path)) {
                Storage::disk('local')->delete($correspondence->file_path);
            }
            $file = $request->file('file');
            $data['mime_type'] = UploadContentSniffer::assertAllowed($file);
            $data['file_path'] = $file->store(
                'correspondence/' . $correspondence->tenant_id . '/drafts',
                ['disk' => 'local']
            );
            $data['original_filename'] = $file->getClientOriginalName();
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
        $this->register->assertCanAccess($correspondence, $request->user());

        if (!$correspondence->isDraft()) {
            return response()->json(['message' => 'Only draft correspondence can be deleted.'], 422);
        }

        if ($correspondence->isOriginalImmutable() || $correspondence->isSignedImmutable()) {
            return response()->json(['message' => 'Immutable correspondence cannot be deleted.'], 422);
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
        $this->register->assertCanAccess($correspondence, $request->user());

        if (!$correspondence->isDraft()) {
            return response()->json(['message' => 'Only draft correspondence can be submitted.'], 422);
        }

        $correspondence->update([
            'status'       => 'pending_review',
            'submitted_at' => now(),
        ]);

        $this->workflowService->initiate($correspondence->fresh(), 'correspondence', $request->user());

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
        $this->register->assertCanAccess($correspondence, $request->user());

        if (!$correspondence->isPendingReview()) {
            return response()->json(['message' => 'Correspondence is not pending review.'], 422);
        }

        $data = $request->validate([
            'action'  => ['required', 'string', 'in:approve,reject'],
            'comment' => ['nullable', 'string', 'max:2000', 'required_if:action,reject'],
        ]);

        $user = $request->user();
        $approvalRequest = $correspondence->approvalRequest;

        if ($approvalRequest) {
            if ($data['action'] === 'approve') {
                $this->workflowService->approve($approvalRequest, $user, $data['comment'] ?? null);
                $correspondence->refresh();
                if ($correspondence->status === 'pending_review') {
                    // Not yet the final step — advance the local status marker so the
                    // SG-facing approve() endpoint's isPendingApproval() gate opens.
                    $correspondence->update([
                        'status'         => 'pending_approval',
                        'reviewed_by'    => $user->id,
                        'reviewed_at'    => now(),
                        'review_comment' => $data['comment'] ?? null,
                    ]);
                }
            } else {
                $this->workflowService->reject($approvalRequest, $user, $data['comment']);
                $correspondence->refresh();
                $correspondence->update(['reviewed_by' => $user->id, 'reviewed_at' => now(), 'review_comment' => $data['comment']]);
            }

            return response()->json([
                'message' => $data['action'] === 'approve'
                    ? 'Correspondence forwarded for approval.'
                    : 'Correspondence returned to author.',
                'data' => $correspondence->fresh(),
            ]);
        }

        $this->checkPerm($request, 'correspondence.review');
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
        $this->register->assertCanAccess($correspondence, $request->user());

        if (!$correspondence->isPendingApproval()) {
            return response()->json(['message' => 'Correspondence is not pending approval.'], 422);
        }

        $user = $request->user();
        $data = $request->validate(['comment' => ['nullable', 'string', 'max:2000']]);

        $approvalRequest = $correspondence->approvalRequest;
        if ($approvalRequest) {
            $this->workflowService->approve($approvalRequest, $user, $data['comment'] ?? null);

            return response()->json([
                'message' => 'Correspondence approved.',
                'data'    => $correspondence->fresh(['approver:id,name']),
            ]);
        }

        $this->checkPerm($request, 'correspondence.approve');
        $referenceNumber = $correspondence->reference_number;

        if (! $referenceNumber) {
            $referenceNumber = $this->register->allocateOutgoingReference($correspondence, $user);
        }

        $correspondence->update([
            'status'           => 'approved',
            'approved_by'      => $user->id,
            'approved_at'      => now(),
            'reference_number' => $referenceNumber,
            'letterhead_applied_at' => $correspondence->letterhead_applied_at ?? now(),
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
        $this->register->assertCanAccess($correspondence, $request->user());

        if (! $correspondence->canDispatch()) {
            return response()->json(['message' => 'Correspondence must be approved before sending.'], 422);
        }

        $data = $request->validate([
            'recipients'              => ['required', 'array', 'min:1'],
            'recipients.*.contact_id' => ['required', 'integer', 'exists:correspondence_contacts,id'],
            'recipients.*.type'       => ['required', 'string', 'in:to,cc,bcc'],
        ]);

        // Never include internal notes in outbound mail payload
        $external = $correspondence->externalPayload();
        unset($external); // payload built inside mail job from letter fields only

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

        $this->register->dispatchRecord($correspondence, $request->user(), [
            'channel' => 'email',
            'delivery_status' => 'dispatched',
            'recipient_name' => 'email recipients',
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
            'data'    => $correspondence->fresh(['recipients.contact', 'dispatches']),
        ]);
    }

    public function download(Request $request, Correspondence $correspondence): StreamedResponse|JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $this->register->assertCanAccess($correspondence, $request->user());

        if (! $this->register->canViewContent($correspondence, $request->user())) {
            return response()->json(['message' => 'Content access denied for this classification.'], 403);
        }

        if (!$correspondence->file_path || !Storage::disk('local')->exists($correspondence->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        AuditLog::record('correspondence.downloaded', [
            'auditable_type' => Correspondence::class,
            'auditable_id'   => $correspondence->id,
            'new_values'     => ['user_id' => $request->user()->id],
        ]);

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
