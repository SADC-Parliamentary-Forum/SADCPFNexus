<?php

namespace App\Http\Controllers\Api\V1\Saam;

use App\Http\Controllers\Controller;
use App\Models\SignatureEvent;
use App\Models\SignatureProfile;
use App\Services\SaamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignatureEventController extends Controller
{
    // Map URL segment → fully-qualified model class
    private const MORPH_MAP = [
        'correspondence' => \App\Models\Correspondence::class,
        'travel'         => \App\Models\TravelRequest::class,
        'imprest'        => \App\Models\ImprestRequest::class,
        'leave'          => \App\Models\LeaveRequest::class,
        'procurement'    => \App\Models\ProcurementRequest::class,
    ];

    public function __construct(private SaamService $saam) {}

    public function store(Request $request, string $signableType, int $signableId): JsonResponse
    {
        $user = $request->user();

        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo('saam.sign', 'sanctum'), 403);
        }

        $data = $request->validate([
            'action'           => ['required', 'string', 'in:approve,reject,review,return,acknowledge'],
            'step_key'         => ['nullable', 'string', 'max:64'],
            'comment'          => ['nullable', 'string', 'max:2000'],
            'signature_type'   => ['nullable', 'string', 'in:full,initials'],
            'confirm_password' => ['required', 'string'],
        ]);

        // Re-authenticate
        if (!$this->saam->reAuthenticate($user, $data['confirm_password'])) {
            return response()->json(['message' => 'Invalid credentials. Please enter your password to sign.'], 422);
        }

        // Resolve morph
        $modelClass = self::MORPH_MAP[$signableType] ?? null;
        if (!$modelClass) {
            return response()->json(['message' => 'Unknown document type.'], 422);
        }

        $signable = $modelClass::findOrFail($signableId);

        // Validate same tenant
        if (isset($signable->tenant_id) && (int) $signable->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        // Get active signature version (optional — signing allowed even without a graphical signature)
        $sigType    = $data['signature_type'] ?? 'full';
        $profile    = SignatureProfile::activeForUser($user->id, $sigType);
        $versionId  = $profile?->activeVersion?->id;

        // Check delegation
        $delegation     = $this->saam->getActiveDelegate($user, $data['step_key']);
        $isDelegated    = $delegation !== null;
        $delegationId   = $delegation?->id;

        $documentHash = $this->saam->computeDocumentHash($signable);

        $event = $this->saam->recordSignatureEvent([
            'tenant_id'              => $user->tenant_id,
            'signable_type'          => $modelClass,
            'signable_id'            => $signableId,
            'step_key'               => $data['step_key'] ?? null,
            'signer_user_id'         => $user->id,
            'signature_version_id'   => $versionId,
            'action'                 => $data['action'],
            'comment'                => $data['comment'] ?? null,
            'auth_level'             => 'password',
            'ip_address'             => $request->ip(),
            'user_agent'             => $request->userAgent(),
            'document_hash'          => $documentHash,
            'is_delegated'           => $isDelegated,
            'delegated_authority_id' => $delegationId,
        ]);

        $event->load(['signer:id,name,job_title', 'signatureVersion']);

        // Append image URL if version exists
        $eventData = $event->toArray();
        if ($event->signatureVersion) {
            $eventData['signature_version']['image_url'] = route('saam.signature-image', $event->signatureVersion->id);
        }

        return response()->json([
            'message' => 'Signed successfully.',
            'data'    => $eventData,
        ], 201);
    }

    public function myEvents(Request $request): JsonResponse
    {
        $user = $request->user();

        $events = SignatureEvent::where('signer_user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->with(['signatureVersion', 'delegatedAuthority.principal:id,name'])
            ->latest('signed_at')
            ->take(20)
            ->get()
            ->map(function (SignatureEvent $e) {
                $arr = $e->toArray();
                if ($e->signatureVersion) {
                    $arr['signature_version']['image_url'] = route('saam.signature-image', $e->signatureVersion->id);
                }
                return $arr;
            });

        return response()->json(['data' => $events]);
    }

    public function index(Request $request, string $signableType, int $signableId): JsonResponse
    {
        $user = $request->user();

        if (!$user->isSystemAdmin()) {
            abort_unless($user->hasPermissionTo('saam.verify', 'sanctum'), 403);
        }

        $modelClass = self::MORPH_MAP[$signableType] ?? null;
        if (!$modelClass) {
            return response()->json(['message' => 'Unknown document type.'], 422);
        }

        $events = SignatureEvent::where('signable_type', $modelClass)
            ->where('signable_id', $signableId)
            ->where('tenant_id', $user->tenant_id)
            ->with(['signer:id,name,job_title', 'signatureVersion', 'delegatedAuthority.principal:id,name'])
            ->orderBy('signed_at')
            ->get()
            ->map(function (SignatureEvent $e) {
                $arr = $e->toArray();
                if ($e->signatureVersion) {
                    $arr['signature_version']['image_url'] = route('saam.signature-image', $e->signatureVersion->id);
                }
                return $arr;
            });

        return response()->json(['data' => $events]);
    }
}
