<?php

namespace App\Http\Controllers\Api\V1\Support;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SupportTicket::where('user_id', $request->user()->id)
            ->orderByDesc('created_at');

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        $tickets = $query->paginate($perPage);

        return response()->json($tickets);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject'     => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'priority'    => ['nullable', 'string', 'in:low,medium,high'],
        ]);

        $user = $request->user();
        $ticket = SupportTicket::create([
            'tenant_id'        => $user->tenant_id,
            'user_id'         => $user->id,
            'reference_number' => SupportTicket::generateReferenceNumber(),
            'subject'         => $data['subject'],
            'description'     => $data['description'] ?? null,
            'priority'        => $data['priority'] ?? 'medium',
            'status'          => 'open',
        ]);

        return response()->json(['message' => 'Ticket created.', 'data' => $ticket], 201);
    }

    public function show(Request $request, SupportTicket $supportTicket): JsonResponse
    {
        if ($supportTicket->user_id !== $request->user()->id) {
            abort(403);
        }
        return response()->json($supportTicket);
    }
}
