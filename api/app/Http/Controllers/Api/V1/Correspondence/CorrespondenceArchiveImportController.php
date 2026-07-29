<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Modules\Correspondence\Services\CorrespondenceArchiveImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CorrespondenceArchiveImportController extends Controller
{
    public function __construct(private readonly CorrespondenceArchiveImportService $imports) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.reference' => ['nullable', 'string', 'max:64'],
            'rows.*.subject' => ['nullable', 'string', 'max:255'],
            'rows.*.language' => ['nullable', 'string', 'in:en,fr,pt'],
            'rows.*.language_tags' => ['nullable', 'array'],
            'rows.*.body' => ['nullable', 'string'],
        ]);

        $result = $this->imports->importRows($data['rows'], $request->user());

        return response()->json(['message' => 'Archive rows imported as drafts.', 'data' => $result], 201);
    }
}
