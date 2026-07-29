<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\CorrespondenceMailboxSuggestion;
use App\Modules\Correspondence\Services\CorrespondenceMailboxService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CorrespondenceMailboxController extends Controller
{
    public function __construct(private readonly CorrespondenceMailboxService $mailbox) {}

    public function settings(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->mailbox->getSettings((int) $request->user()->tenant_id),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mailbox_address' => ['nullable', 'email', 'max:255'],
            'enabled' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->mailbox->updateSettings((int) $request->user()->tenant_id, $data, $request->user()),
        ]);
    }

    public function indexSuggestions(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(CorrespondenceMailboxSuggestion::STATUSES)],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->mailbox->listSuggestions(
                (int) $request->user()->tenant_id,
                $filters['status'] ?? null,
            ),
        ]);
    }

    public function importSuggestion(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message_id' => ['required', 'string', 'max:512'],
            'subject' => ['nullable', 'string', 'max:500'],
            'from_address' => ['nullable', 'string', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:255'],
            'received_at' => ['nullable', 'date'],
            'body_preview' => ['nullable', 'string'],
            'raw_headers' => ['nullable', 'string'],
        ]);

        $suggestion = $this->mailbox->importSuggestion((int) $request->user()->tenant_id, $data);

        return response()->json(['success' => true, 'data' => $suggestion], 201);
    }

    public function registerSuggestion(Request $request, CorrespondenceMailboxSuggestion $suggestion): JsonResponse
    {
        $extra = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:500'],
            'summary' => ['nullable', 'string'],
            'body' => ['nullable', 'string'],
            'channel' => ['nullable', 'string', 'max:40'],
            'sender_name' => ['nullable', 'string', 'max:255'],
            'sender_organisation' => ['nullable', 'string', 'max:255'],
        ]);

        $letter = $this->mailbox->registerFromSuggestion($suggestion, $request->user(), $extra);

        return response()->json(['success' => true, 'data' => $letter], 201);
    }

    public function dismissSuggestion(Request $request, CorrespondenceMailboxSuggestion $suggestion): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->mailbox->dismiss($suggestion, $request->user()),
        ]);
    }
}
