<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeDocument;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgrammeDocumentController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    private function rules(bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';
        return [
            'title'                => [$required, 'string', 'max:255'],
            'document_type'        => [$required, 'string', 'max:100'],
            'word_count'           => ['nullable', 'integer', 'min:0'],
            'translation_required' => ['nullable', 'boolean'],
            'source_language'      => ['nullable', 'string', 'max:100'],
            'target_languages'     => [
                Rule::requiredIf(function () use ($updating) {
                    if ($updating && ! request()->has('translation_required')) {
                        return false;
                    }
                    return (bool) request()->input('translation_required');
                }),
                'nullable', 'array',
            ],
            'target_languages.*'   => ['string', 'max:100'],
            'owner_user_id'        => ['nullable', 'integer', 'exists:users,id'],
            'owner_name'           => [
                Rule::requiredIf(function () use ($updating) {
                    if ($updating && ! request()->has('owner_user_id') && ! request()->has('owner_name')) {
                        return false;
                    }
                    return empty(request()->input('owner_user_id'));
                }),
                'nullable', 'string', 'max:255',
            ],
            'owner_organisation'   => ['nullable', 'string', 'max:255'],
            'deadline'             => ['nullable', 'date'],
            'budget_line'          => ['nullable', 'string', 'max:255'],
            'comments'             => ['nullable', 'string'],
        ];
    }

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate($this->rules());
        $document = $this->service->addDocument($programme, $data);
        return response()->json(['message' => 'Document added.', 'data' => $document], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeDocument $document): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        $document = $this->service->updateDocument($document, $data);
        return response()->json(['message' => 'Document updated.', 'data' => $document]);
    }

    public function destroy(Programme $programme, ProgrammeDocument $document): JsonResponse
    {
        $this->service->deleteDocument($document);
        return response()->json(['message' => 'Document deleted.']);
    }
}
