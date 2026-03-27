<?php

namespace App\Http\Controllers\Api\V1\Saam;

use App\Http\Controllers\Controller;
use App\Models\SignatureVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SignatureImageController extends Controller
{
    public function show(Request $request, SignatureVersion $signatureVersion): StreamedResponse|JsonResponse
    {
        $user    = $request->user();
        $profile = $signatureVersion->profile;

        // Validate same tenant
        if ((int) $profile->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        // Only the owner or a system admin can access another user's signature
        if ((int) $profile->user_id !== (int) $user->id && !$user->isSystemAdmin()) {
            abort(403);
        }

        if (!Storage::disk('local')->exists($signatureVersion->file_path)) {
            return response()->json(['message' => 'Signature image not found.'], 404);
        }

        $mimeType = Storage::disk('local')->mimeType($signatureVersion->file_path) ?: 'image/png';

        return response()->streamDownload(function () use ($signatureVersion) {
            $stream = Storage::disk('local')->readStream($signatureVersion->file_path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 'signature.png', [
            'Content-Type'  => $mimeType,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
