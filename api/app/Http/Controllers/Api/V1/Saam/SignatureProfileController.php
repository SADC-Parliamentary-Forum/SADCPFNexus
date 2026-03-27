<?php

namespace App\Http\Controllers\Api\V1\Saam;

use App\Http\Controllers\Controller;
use App\Models\SignatureProfile;
use App\Services\SaamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignatureProfileController extends Controller
{
    public function __construct(private SaamService $saam) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $profiles = SignatureProfile::where('user_id', $user->id)
            ->with(['activeVersion'])
            ->get()
            ->map(function (SignatureProfile $p) {
                $data = $p->toArray();
                if ($p->activeVersion) {
                    $data['active_version']['image_url'] = route('saam.signature-image', $p->activeVersion->id);
                }
                return $data;
            });

        return response()->json(['data' => $profiles]);
    }

    public function draw(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'           => ['required', 'string', 'in:full,initials'],
            'image_data_url' => ['required', 'string'],
        ]);

        $user = $request->user();

        // Basic validation: must be a data URL
        if (!str_starts_with($data['image_data_url'], 'data:image/')) {
            return response()->json(['message' => 'Invalid image data.'], 422);
        }

        $stored  = $this->saam->storeSignatureImage($data['image_data_url'], $user->tenant_id, $user->id);
        $version = $this->saam->upsertProfile($user->tenant_id, $user->id, $data['type'], $stored['path'], $stored['hash']);

        return response()->json([
            'message' => 'Signature saved.',
            'data'    => $version->load('profile'),
        ], 201);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['required', 'string', 'in:full,initials'],
            'file' => ['required', 'file', 'mimes:png,svg', 'max:512'],
        ]);

        $user    = $request->user();
        $file    = $request->file('file');
        $bytes   = file_get_contents($file->getRealPath());
        $hash    = hash('sha256', $bytes);
        $dir     = "signatures/{$user->tenant_id}/{$user->id}";
        $path    = "{$dir}/{$hash}.png";

        \Illuminate\Support\Facades\Storage::disk('local')->put($path, $bytes);

        $version = $this->saam->upsertProfile($user->tenant_id, $user->id, $request->input('type'), $path, $hash);

        return response()->json([
            'message' => 'Signature uploaded.',
            'data'    => $version->load('profile'),
        ], 201);
    }

    public function revoke(Request $request, string $type): JsonResponse
    {
        if (!in_array($type, ['full', 'initials'])) {
            return response()->json(['message' => 'Invalid signature type.'], 422);
        }

        $user    = $request->user();
        $profile = SignatureProfile::where('user_id', $user->id)->where('type', $type)->first();

        if (!$profile) {
            return response()->json(['message' => 'No signature profile found.'], 404);
        }

        $profile->update(['status' => 'revoked']);
        $profile->versions()->whereNull('revoked_at')->update(['revoked_at' => now()]);

        return response()->json(['message' => ucfirst($type) . ' signature revoked.']);
    }
}
