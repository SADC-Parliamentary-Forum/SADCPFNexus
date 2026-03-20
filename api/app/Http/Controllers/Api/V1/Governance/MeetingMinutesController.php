<?php

namespace App\Http\Controllers\Api\V1\Governance;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Attachment;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MeetingMinutesController extends Controller
{
    // ─── List ─────────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $q = MeetingMinutes::where('tenant_id', $request->user()->tenant_id)
            ->with(['creator:id,name', 'actionItems.responsible:id,name', 'attachments'])
            ->orderByDesc('meeting_date');

        if ($request->filled('status')) {
            $q->where('status', $request->status);
        }
        if ($request->filled('meeting_type')) {
            $q->where('meeting_type', $request->meeting_type);
        }
        if ($request->filled('search')) {
            $q->where(function ($sq) use ($request) {
                $sq->where('title', 'ilike', '%' . $request->search . '%')
                   ->orWhere('chairperson', 'ilike', '%' . $request->search . '%');
            });
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        return response()->json($q->paginate($perPage));
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(Request $request, MeetingMinutes $meetingMinute): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);

        $meetingMinute->load([
            'creator:id,name,job_title',
            'actionItems.responsible:id,name,job_title',
            'actionItems.assignment:id,reference_number,status,progress_percent',
            'attachments',
        ]);

        return response()->json($meetingMinute);
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'              => ['required', 'string', 'max:500'],
            'meeting_date'       => ['required', 'date'],
            'location'           => ['nullable', 'string', 'max:255'],
            'meeting_type'       => ['nullable', 'string', 'max:100'],
            'chairperson'        => ['nullable', 'string', 'max:255'],
            'attendees'          => ['nullable', 'array'],
            'attendees.*'        => ['string', 'max:255'],
            'apologies'          => ['nullable', 'array'],
            'apologies.*'        => ['string', 'max:255'],
            'notes'              => ['nullable', 'string'],
            'workplan_event_id'  => ['nullable', 'integer'],
        ]);

        $data['tenant_id']  = $request->user()->tenant_id;
        $data['created_by'] = $request->user()->id;
        $data['status']     = 'draft';

        $minutes = MeetingMinutes::create($data);
        $minutes->load(['creator:id,name', 'actionItems']);

        return response()->json(['message' => 'Meeting minutes created.', 'data' => $minutes], 201);
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public function update(Request $request, MeetingMinutes $meetingMinute): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);

        $data = $request->validate([
            'title'        => ['sometimes', 'string', 'max:500'],
            'meeting_date' => ['sometimes', 'date'],
            'location'     => ['nullable', 'string', 'max:255'],
            'meeting_type' => ['nullable', 'string', 'max:100'],
            'status'       => ['sometimes', 'in:draft,final'],
            'chairperson'  => ['nullable', 'string', 'max:255'],
            'attendees'    => ['nullable', 'array'],
            'attendees.*'  => ['string', 'max:255'],
            'apologies'    => ['nullable', 'array'],
            'apologies.*'  => ['string', 'max:255'],
            'notes'        => ['nullable', 'string'],
        ]);

        $meetingMinute->update($data);
        $meetingMinute->load(['creator:id,name', 'actionItems.responsible:id,name', 'attachments']);

        return response()->json(['message' => 'Meeting minutes updated.', 'data' => $meetingMinute]);
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    public function destroy(Request $request, MeetingMinutes $meetingMinute): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);

        // Remove uploaded documents
        foreach ($meetingMinute->attachments as $att) {
            Storage::disk('private')->delete($att->storage_path);
            $att->delete();
        }

        $meetingMinute->delete();
        return response()->json(['message' => 'Meeting minutes deleted.']);
    }

    // ─── Upload minutes document ──────────────────────────────────────────────

    public function uploadDocument(Request $request, MeetingMinutes $meetingMinute): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);

        $request->validate([
            'file'  => ['required', 'file', 'max:20480', 'mimes:pdf,doc,docx'],
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $request->file('file');
        $path = $file->store("tenants/{$request->user()->tenant_id}/meeting_minutes/{$meetingMinute->id}", 'private');

        // Remove previous document with same original name if re-uploading
        $existing = $meetingMinute->attachments()->where('original_filename', $file->getClientOriginalName())->first();
        if ($existing) {
            Storage::disk('private')->delete($existing->storage_path);
            $existing->delete();
        }

        $att = $meetingMinute->attachments()->create([
            'tenant_id'         => $request->user()->tenant_id,
            'uploaded_by'       => $request->user()->id,
            'original_filename' => $request->title ?? $file->getClientOriginalName(),
            'storage_path'      => $path,
            'mime_type'         => $file->getMimeType(),
            'size_bytes'        => $file->getSize(),
        ]);

        return response()->json(['message' => 'Document uploaded.', 'data' => $att], 201);
    }

    // ─── Delete document ──────────────────────────────────────────────────────

    public function deleteDocument(Request $request, MeetingMinutes $meetingMinute, Attachment $attachment): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);
        abort_if($attachment->attachable_id !== $meetingMinute->id, 403);

        Storage::disk('private')->delete($attachment->storage_path);
        $attachment->delete();

        return response()->json(['message' => 'Document deleted.']);
    }

    // ─── Download document ────────────────────────────────────────────────────

    public function downloadDocument(Request $request, MeetingMinutes $meetingMinute, Attachment $attachment)
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);
        abort_if($attachment->attachable_id !== $meetingMinute->id, 403);

        return Storage::disk('private')->download($attachment->storage_path, $attachment->original_filename);
    }

    // ─── Action items ─────────────────────────────────────────────────────────

    public function addActionItem(Request $request, MeetingMinutes $meetingMinute): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);

        $data = $request->validate([
            'description'      => ['required', 'string'],
            'responsible_id'   => ['nullable', 'exists:users,id'],
            'responsible_name' => ['nullable', 'string', 'max:255'],
            'deadline'         => ['nullable', 'date'],
            'notes'            => ['nullable', 'string'],
        ]);

        $item = $meetingMinute->actionItems()->create($data);
        $item->load('responsible:id,name,job_title');

        return response()->json(['message' => 'Action item added.', 'data' => $item], 201);
    }

    public function updateActionItem(Request $request, MeetingMinutes $meetingMinute, MeetingActionItem $actionItem): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);
        abort_if($actionItem->meeting_minutes_id !== $meetingMinute->id, 403);

        $data = $request->validate([
            'description'      => ['sometimes', 'string'],
            'responsible_id'   => ['nullable', 'exists:users,id'],
            'responsible_name' => ['nullable', 'string', 'max:255'],
            'deadline'         => ['nullable', 'date'],
            'status'           => ['sometimes', 'in:open,in_progress,completed,cancelled'],
            'notes'            => ['nullable', 'string'],
        ]);

        $actionItem->update($data);
        $actionItem->load('responsible:id,name', 'assignment:id,reference_number,status');

        return response()->json(['message' => 'Action item updated.', 'data' => $actionItem]);
    }

    public function deleteActionItem(Request $request, MeetingMinutes $meetingMinute, MeetingActionItem $actionItem): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);
        abort_if($actionItem->meeting_minutes_id !== $meetingMinute->id, 403);

        $actionItem->delete();
        return response()->json(['message' => 'Action item deleted.']);
    }

    // ─── Formally assign action item → creates an Assignment ─────────────────

    public function assignActionItem(Request $request, MeetingMinutes $meetingMinute, MeetingActionItem $actionItem): JsonResponse
    {
        abort_if($meetingMinute->tenant_id !== $request->user()->tenant_id, 403);
        abort_if($actionItem->meeting_minutes_id !== $meetingMinute->id, 403);

        $data = $request->validate([
            'assigned_to'      => ['nullable', 'exists:users,id'],
            'due_date'         => ['required', 'date'],
            'priority'         => ['sometimes', 'in:low,medium,high,critical'],
            'description'      => ['nullable', 'string'],
        ]);

        // Create a formal Assignment
        $assignment = Assignment::create([
            'tenant_id'          => $request->user()->tenant_id,
            'reference_number'   => 'ASN-' . strtoupper(uniqid()),
            'title'              => $actionItem->description,
            'description'        => $data['description'] ?? "Action item from meeting: {$meetingMinute->title}",
            'type'               => 'individual',
            'priority'           => $data['priority'] ?? 'medium',
            'status'             => 'draft',
            'created_by'         => $request->user()->id,
            'assigned_to'        => $data['assigned_to'] ?? $actionItem->responsible_id,
            'due_date'           => $data['due_date'],
            'meeting_minutes_id'  => $meetingMinute->id,
        ]);

        // Issue it immediately
        $assignment->update(['status' => 'issued']);

        // Link back to action item
        $actionItem->update(['assignment_id' => $assignment->id, 'status' => 'in_progress']);
        $actionItem->load('responsible:id,name', 'assignment:id,reference_number,status');

        return response()->json([
            'message'     => 'Action item formally assigned.',
            'data'        => $actionItem,
            'assignment'  => $assignment,
        ]);
    }
}
