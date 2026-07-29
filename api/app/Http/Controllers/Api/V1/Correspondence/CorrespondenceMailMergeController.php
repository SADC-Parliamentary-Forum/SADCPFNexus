<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\Correspondence;
use App\Models\CorrespondenceLetterTemplate;
use App\Modules\Correspondence\Services\CorrespondenceAiAssistService;
use App\Modules\Correspondence\Services\CorrespondenceRegisterService;
use App\Modules\Correspondence\Services\MailMergeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CorrespondenceMailMergeController extends Controller
{
    public function __construct(
        private readonly MailMergeService $merge,
        private readonly CorrespondenceAiAssistService $ai,
        private readonly CorrespondenceRegisterService $register,
    ) {}

    private function checkPerm(Request $request, string $permission): void
    {
        $user = $request->user();
        if (! $user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo($permission, 'sanctum'), 403);
        }
    }

    public function indexTemplates(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.view');
        $rows = CorrespondenceLetterTemplate::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:64'],
            'subject_template' => ['required', 'string', 'max:500'],
            'body_template' => ['required', 'string', 'max:20000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $template = CorrespondenceLetterTemplate::create([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['message' => 'Template created.', 'data' => $template], 201);
    }

    public function preview(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $data = $request->validate([
            'template_id' => ['required', 'integer', 'exists:correspondence_letter_templates,id'],
            'fields' => ['required', 'array'],
        ]);

        $template = CorrespondenceLetterTemplate::where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($data['template_id']);

        return response()->json(['data' => $this->merge->preview($template, $data['fields'])]);
    }

    public function createFromTemplate(Request $request): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $data = $request->validate([
            'template_id' => ['required', 'integer', 'exists:correspondence_letter_templates,id'],
            'fields' => ['required', 'array'],
            'type' => ['nullable', 'string', 'in:internal_memo,external,diplomatic_note,procurement'],
        ]);

        $user = $request->user();
        $template = CorrespondenceLetterTemplate::where('tenant_id', $user->tenant_id)
            ->findOrFail($data['template_id']);
        $merged = $this->merge->preview($template, $data['fields']);

        $letter = Correspondence::create([
            'tenant_id' => $user->tenant_id,
            'created_by' => $user->id,
            'title' => $merged['title'],
            'subject' => $merged['subject'],
            'body' => $merged['body'],
            'type' => $data['type'] ?? 'external',
            'priority' => 'normal',
            'language' => 'en',
            'direction' => 'outgoing',
            'status' => 'draft',
            'confidentiality' => 'general_official',
        ]);

        return response()->json([
            'message' => 'Letter created from mail-merge template (draft — not sent).',
            'data' => $letter,
        ], 201);
    }

    public function aiAssist(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $this->register->assertCanAccess($correspondence, $request->user());
        $data = $request->validate([
            'intent' => ['nullable', 'string', 'max:2000'],
        ]);

        $draft = $this->ai->generateDraft($correspondence, $request->user(), $data['intent'] ?? '');

        return response()->json([
            'message' => 'AI assist draft generated. Human confirmation required — never auto-sent.',
            'data' => $draft,
        ]);
    }

    public function confirmAiAssist(Request $request, Correspondence $correspondence): JsonResponse
    {
        $this->checkPerm($request, 'correspondence.create');
        $this->register->assertCanAccess($correspondence, $request->user());
        $request->validate(['confirm' => 'required|accepted']);

        $letter = $this->ai->confirm($correspondence, $request->user());

        return response()->json([
            'message' => 'AI draft confirmed by human. Letter not submitted or sent.',
            'data' => $letter,
        ]);
    }
}
