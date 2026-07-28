<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\Correspondence;
use App\Models\CorrespondenceDispatch;
use App\Models\CorrespondenceNumberingPolicy;
use App\Models\CorrespondenceSubjectFile;
use App\Modules\Correspondence\Services\CorrespondenceRegisterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CorrespondenceRegisterController extends Controller
{
    public function __construct(
        private readonly CorrespondenceRegisterService $register,
    ) {}

    private function checkPerm(Request $request, string $permission): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo($permission, 'sanctum'), 403);
        }
    }

    private function loadAccessible(Request $request, Correspondence $correspondence): Correspondence
    {
        $this->register->assertCanAccess($correspondence, $request->user());

        return $this->register->redactForUser(
            $correspondence->load([
                'creator:id,name,email',
                'reviewer:id,name',
                'approver:id,name',
                'primaryOwner:id,name,email',
                'department:id,name',
                'owners.user:id,name,email',
                'routes.router:id,name',
                'notes.author:id,name',
                'dispatches.dispatcher:id,name',
                'subjectFiles',
                'assignmentLinks.assignment',
                'relationshipsFrom',
                'relationshipsTo',
                'senderContact',
            ]),
            $request->user()
        );
    }

    public function registerIncoming(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.registry');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'subject' => ['required', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:10000'],
            'summary' => ['nullable', 'string', 'max:5000'],
            'type' => ['nullable', 'string', 'in:internal_memo,external,diplomatic_note,procurement'],
            'priority' => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'language' => ['nullable', 'string', 'in:en,fr,pt'],
            'file_code' => ['nullable', 'string', 'max:32'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'programme_id' => ['nullable', 'integer'],
            'correspondence_date' => ['nullable', 'date'],
            'received_at' => ['nullable', 'date'],
            'channel' => ['nullable', 'string', 'in:email,post,hand,courier,fax,other'],
            'sender_name' => ['nullable', 'string', 'max:255'],
            'sender_organisation' => ['nullable', 'string', 'max:255'],
            'sender_country' => ['nullable', 'string', 'max:64'],
            'sender_reference' => ['nullable', 'string', 'max:128'],
            'sender_contact_id' => ['nullable', 'integer', 'exists:correspondence_contacts,id'],
            'attention_to' => ['nullable', 'string', 'max:255'],
            'confidentiality' => ['nullable', 'string', 'in:internal,general_official,restricted,confidential,highly_confidential,privileged_legal,hr_confidential,finance_confidential'],
            'content_restricted' => ['nullable', 'boolean'],
            'response_required' => ['nullable', 'boolean'],
            'sender_deadline' => ['nullable', 'date'],
            'internal_deadline' => ['nullable', 'date'],
            'final_deadline' => ['nullable', 'date'],
            'physical_location' => ['nullable', 'string', 'max:255'],
            'subject_file_id' => ['nullable', 'integer', 'exists:correspondence_subject_files,id'],
            'file' => ['nullable', 'file', 'mimes:pdf,doc,docx,jpg,jpeg,png', 'max:25600'],
        ]);

        $c = $this->register->registerIncoming($request->user(), $data, $request->file('file'));

        return response()->json([
            'message' => 'Incoming correspondence registered.',
            'data' => $c,
        ], 201);
    }

    public function sgRoute(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.route');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'action' => ['required', 'string', 'in:for_information,route_for_action,route_for_advice,route_for_draft_response,route_for_comment,route_to_multiple,acknowledge_receipt,close_no_action'],
            'primary_owner_id' => ['nullable', 'integer', 'exists:users,id'],
            'supporting_owner_ids' => ['nullable', 'array'],
            'supporting_owner_ids.*' => ['integer', 'exists:users,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'instruction' => ['nullable', 'string', 'max:5000'],
            'priority' => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'due_date' => ['nullable', 'date'],
            'response_required' => ['nullable', 'boolean'],
            'response_due_date' => ['nullable', 'date'],
            'copy_to_user_ids' => ['nullable', 'array'],
            'copy_to_user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $c = $this->register->sgRoute($correspondence, $request->user(), $data);

        return response()->json([
            'message' => 'Correspondence routed.',
            'data' => $c,
        ]);
    }

    public function acknowledge(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'ack_status' => ['required', 'string', 'in:viewed,accepted,misrouted'],
        ]);

        $owner = $this->register->acknowledge($correspondence, $request->user(), $data['ack_status']);

        return response()->json(['message' => 'Acknowledged.', 'data' => $owner]);
    }

    public function addNote(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        $note = $this->register->addNote($correspondence, $request->user(), $data['body']);

        return response()->json(['message' => 'Internal note added.', 'data' => $note], 201);
    }

    public function notes(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $user = $request->user();
        $this->register->assertCanAccess($correspondence, $user);

        if (! $this->register->canViewContent($correspondence, $user)) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $correspondence->notes()->with('author:id,name')->orderByDesc('created_at')->get(),
        ]);
    }

    public function linkRelationship(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'to_correspondence_id' => ['required', 'integer', 'exists:correspondence,id'],
            'type' => ['required', 'string', 'in:reply_to,related,duplicate,thread,response_to'],
        ]);

        $to = Correspondence::findOrFail($data['to_correspondence_id']);
        $this->register->assertCanAccess($to, $request->user());

        $rel = $this->register->linkRelationship($correspondence, $to, $data['type'], $request->user());

        return response()->json(['message' => 'Relationship linked.', 'data' => $rel], 201);
    }

    public function sign(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.approve');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $c = $this->register->sign($correspondence, $request->user(), $data['comment'] ?? null);

        return response()->json(['message' => 'Correspondence signed.', 'data' => $c]);
    }

    public function dispatchItem(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.dispatch');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'channel' => ['required', 'string', 'in:email,post,hand,courier,fax,other'],
            'dispatched_at' => ['nullable', 'date'],
            'tracking_reference' => ['nullable', 'string', 'max:128'],
            'delivery_status' => ['nullable', 'string', 'in:dispatched,in_transit,delivered,failed,returned'],
            'delivered_at' => ['nullable', 'date'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'evidence_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $dispatch = $this->register->dispatchRecord($correspondence, $request->user(), $data);

        return response()->json(['message' => 'Dispatch recorded.', 'data' => $dispatch], 201);
    }

    public function updateDelivery(Request $request, CorrespondenceDispatch $dispatch): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.dispatch');
        $c = $dispatch->correspondence;
        abort_unless($c && (int) $c->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'delivery_status' => ['nullable', 'string', 'in:dispatched,in_transit,delivered,failed,returned'],
            'delivered_at' => ['nullable', 'date'],
            'tracking_reference' => ['nullable', 'string', 'max:128'],
            'evidence_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        return response()->json([
            'message' => 'Delivery updated.',
            'data' => $this->register->updateDelivery($dispatch, $data),
        ]);
    }

    public function voidReference(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.registry');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $c = $this->register->voidReference($correspondence, $request->user(), $data['reason']);

        return response()->json(['message' => 'Reference voided and retained.', 'data' => $c]);
    }

    public function linkAssignment(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'assignment_id' => ['nullable', 'integer', 'exists:assignments,id'],
            'create' => ['nullable', 'array'],
            'create.title' => ['nullable', 'string', 'max:500'],
            'create.description' => ['nullable', 'string', 'max:5000'],
            'create.assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'create.department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'create.due_date' => ['nullable', 'date'],
            'create.type' => ['nullable', 'string', 'max:32'],
        ]);

        $link = $this->register->linkAssignment(
            $correspondence,
            $request->user(),
            $data['assignment_id'] ?? null,
            $data['create'] ?? null
        );

        return response()->json(['message' => 'Assignment linked.', 'data' => $link], 201);
    }

    public function subjectFiles(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $user = $request->user();

        $query = CorrespondenceSubjectFile::where('tenant_id', $user->tenant_id)->orderBy('file_code');
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('file_code', 'ilike', "%{$search}%")
                    ->orWhere('title', 'ilike', "%{$search}%");
            });
        }

        return response()->json($query->paginate(min((int) $request->input('per_page', 50), 100)));
    }

    public function storeSubjectFile(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.registry');

        $data = $request->validate([
            'file_code' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'parent_id' => ['nullable', 'integer', 'exists:correspondence_subject_files,id'],
        ]);

        $file = $this->register->createSubjectFile($request->user(), $data);

        return response()->json(['message' => 'Subject file created.', 'data' => $file], 201);
    }

    public function linkSubjectFile(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.registry');
        $this->register->assertCanAccess($correspondence, $request->user());

        $data = $request->validate([
            'subject_file_id' => ['required', 'integer', 'exists:correspondence_subject_files,id'],
            'is_primary' => ['nullable', 'boolean'],
        ]);

        $this->register->linkSubjectFile($correspondence, (int) $data['subject_file_id'], (bool) ($data['is_primary'] ?? false));

        return response()->json([
            'message' => 'Linked to subject file (single authoritative document).',
            'data' => $correspondence->fresh('subjectFiles'),
        ]);
    }

    public function masterRegister(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');

        return response()->json(
            $this->register->masterRegister($request->user(), $request->all())
        );
    }

    public function myActions(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');

        return response()->json(
            $this->register->myActions($request->user(), $request->all())
        );
    }

    public function reportSummary(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');

        return response()->json([
            'data' => $this->register->reportSummary($request->user()),
        ]);
    }

    public function numberingPolicy(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $policy = CorrespondenceNumberingPolicy::forTenant($request->user()->tenant_id);

        return response()->json(['data' => $policy]);
    }

    public function updateNumberingPolicy(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.admin');

        $data = $request->validate([
            'incoming_pattern' => ['sometimes', 'string', 'max:128'],
            'outgoing_pattern' => ['sometimes', 'string', 'max:128'],
            'incoming_seq_padding' => ['sometimes', 'integer', 'min:3', 'max:8'],
            'outgoing_seq_padding' => ['sometimes', 'integer', 'min:3', 'max:8'],
            'assign_outgoing_on_approve' => ['sometimes', 'boolean'],
        ]);

        $policy = CorrespondenceNumberingPolicy::forTenant($request->user()->tenant_id);
        $policy->update($data);

        return response()->json(['message' => 'Numbering policy updated.', 'data' => $policy->fresh()]);
    }

    public function showRegister(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');

        return response()->json([
            'data' => $this->loadAccessible($request, $correspondence),
            'can_view_content' => $this->register->canViewContent($correspondence, $request->user()),
            'external_payload' => $correspondence->externalPayload(),
        ]);
    }
}
