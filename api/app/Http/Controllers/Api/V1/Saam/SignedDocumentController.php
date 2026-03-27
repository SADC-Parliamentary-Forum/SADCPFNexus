<?php

namespace App\Http\Controllers\Api\V1\Saam;

use App\Http\Controllers\Controller;
use App\Models\SignedDocument;
use App\Services\SaamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SignedDocumentController extends Controller
{
    // Map URL segment → fully-qualified model class (same as SignatureEventController)
    private const MORPH_MAP = [
        'correspondence' => \App\Models\Correspondence::class,
        'travel'         => \App\Models\TravelRequest::class,
        'imprest'        => \App\Models\ImprestRequest::class,
        'leave'          => \App\Models\LeaveRequest::class,
        'procurement'    => \App\Models\ProcurementRequest::class,
    ];

    public function __construct(private SaamService $saam) {}

    public function show(Request $request, string $signableType, int $signableId): JsonResponse
    {
        $user  = $request->user();
        $class = self::MORPH_MAP[$signableType] ?? null;

        if (!$class) {
            return response()->json(['message' => 'Unknown document type.'], 422);
        }

        $doc = SignedDocument::where('signable_type', $class)
            ->where('signable_id', $signableId)
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('version')
            ->first();

        if (!$doc) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $doc]);
    }

    public function generate(Request $request, string $signableType, int $signableId): JsonResponse
    {
        $user  = $request->user();

        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo('saam.sign', 'sanctum'), 403);
        }

        $class = self::MORPH_MAP[$signableType] ?? null;
        if (!$class) {
            return response()->json(['message' => 'Unknown document type.'], 422);
        }

        $signable = $class::findOrFail($signableId);

        if (isset($signable->tenant_id) && (int) $signable->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $doc = $this->saam->generateSignedDocument($signable, $user->tenant_id);

        return response()->json([
            'message' => 'Signed document generated.',
            'data'    => $doc,
        ], 201);
    }

    public function download(Request $request, SignedDocument $document): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        abort_unless((int) $document->tenant_id === (int) $user->tenant_id, 404);

        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo('saam.verify', 'sanctum'), 403);
        }

        if (!Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['message' => 'Document file not found.'], 404);
        }

        $filename = 'signed_document_v' . $document->version . '.pdf';

        return response()->streamDownload(function () use ($document) {
            $stream = Storage::disk('local')->readStream($document->file_path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $filename, ['Content-Type' => 'application/pdf']);
    }
}
