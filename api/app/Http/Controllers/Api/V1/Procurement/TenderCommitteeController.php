<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\TenderCommittee;
use App\Models\TenderCommitteeMeeting;
use App\Models\TenderCommitteeMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TenderCommitteeController extends Controller
{
    private function gate(Request $request): void
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin'])) {
            abort(403);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->gate($request);
        $rows = TenderCommittee::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['members.user:id,name,email'])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->gate($request);
        $data = $request->validate([
            'name'           => ['required', 'string', 'max:255'],
            'code'           => ['nullable', 'string', 'max:40'],
            'quorum_minimum' => ['nullable', 'integer', 'min:1', 'max:50'],
            'is_standing'    => ['nullable', 'boolean'],
            'notes'          => ['nullable', 'string'],
            'members'        => ['nullable', 'array'],
            'members.*.user_id' => ['required_with:members', 'integer', 'exists:users,id'],
            'members.*.role'    => ['nullable', 'string', 'in:chair,secretary,member'],
        ]);

        $committee = DB::transaction(function () use ($data, $request) {
            $committee = TenderCommittee::create([
                'tenant_id'      => $request->user()->tenant_id,
                'name'           => $data['name'],
                'code'           => $data['code'] ?? null,
                'quorum_minimum' => $data['quorum_minimum'] ?? 3,
                'is_standing'    => $data['is_standing'] ?? true,
                'notes'          => $data['notes'] ?? null,
                'created_by'     => $request->user()->id,
            ]);

            foreach ($data['members'] ?? [] as $member) {
                TenderCommitteeMember::create([
                    'tender_committee_id' => $committee->id,
                    'user_id'             => $member['user_id'],
                    'role'                => $member['role'] ?? 'member',
                    'joined_at'           => now(),
                ]);
            }

            return $committee;
        });

        AuditLog::record('procurement.tender_committee_created', [
            'auditable_type' => TenderCommittee::class,
            'auditable_id'   => $committee->id,
            'tags'           => ['procurement', 'tender'],
        ]);

        return response()->json([
            'message' => 'Tender committee created.',
            'data'    => $committee->fresh(['members.user:id,name,email']),
        ], 201);
    }

    public function show(Request $request, TenderCommittee $tenderCommittee): JsonResponse
    {
        $this->gate($request);
        if ((int) $tenderCommittee->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        return response()->json([
            'data' => $tenderCommittee->load(['members.user:id,name,email', 'meetings']),
        ]);
    }

    public function storeMeeting(Request $request, TenderCommittee $tenderCommittee): JsonResponse
    {
        $this->gate($request);
        if ((int) $tenderCommittee->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'title'           => ['required', 'string', 'max:255'],
            'held_at'         => ['required', 'date'],
            'members_present' => ['required', 'integer', 'min:0'],
            'tender_id'       => ['nullable', 'integer', 'exists:tenders,id'],
            'minutes_url'     => ['nullable', 'url', 'max:500'],
            'notes'           => ['nullable', 'string'],
        ]);

        if (!$tenderCommittee->quorumMet((int) $data['members_present'])) {
            throw ValidationException::withMessages([
                'quorum' => 'Quorum not met. Minimum present members: ' . $tenderCommittee->quorum_minimum . '.',
            ]);
        }

        $meeting = TenderCommitteeMeeting::create([
            'tender_committee_id' => $tenderCommittee->id,
            'tenant_id'           => $request->user()->tenant_id,
            'tender_id'           => $data['tender_id'] ?? null,
            'held_at'             => $data['held_at'],
            'title'               => $data['title'],
            'members_present'     => $data['members_present'],
            'quorum_met'          => true,
            'minutes_url'         => $data['minutes_url'] ?? null,
            'notes'               => $data['notes'] ?? null,
            'recorded_by'         => $request->user()->id,
        ]);

        return response()->json(['message' => 'Meeting recorded.', 'data' => $meeting], 201);
    }
}
