<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\DelegatedAuthority;
use App\Models\SignatureEvent;
use App\Models\SignatureProfile;
use App\Models\SignatureVersion;
use App\Models\SignedDocument;
use App\Models\TenantSetting;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\Builder\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class SaamService
{
    /**
     * Decode a base64 data URL or copy an already-stored path into the signatures folder.
     * Returns ['path' => ..., 'hash' => ...]
     */
    public function storeSignatureImage(string $dataUrl, int $tenantId, int $userId): array
    {
        // Decode base64 data URL  (data:image/png;base64,...)
        if (str_starts_with($dataUrl, 'data:')) {
            [, $base64] = explode(',', $dataUrl, 2);
            $bytes = base64_decode($base64);
        } else {
            // Treat as raw bytes (from file upload already read)
            $bytes = $dataUrl;
        }

        $hash     = hash('sha256', $bytes);
        $dir      = "signatures/{$tenantId}/{$userId}";
        $filename = "{$hash}.png";
        $path     = "{$dir}/{$filename}";

        Storage::disk('local')->put($path, $bytes);

        return ['path' => $path, 'hash' => $hash];
    }

    /**
     * Create or update a signature profile and insert a new version.
     */
    public function upsertProfile(int $tenantId, int $userId, string $type, string $filePath, string $hash): SignatureVersion
    {
        // Ensure profile exists
        $profile = SignatureProfile::firstOrCreate(
            ['user_id' => $userId, 'type' => $type],
            ['tenant_id' => $tenantId, 'status' => 'active']
        );

        // Revoke any existing active version
        $profile->versions()
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        // Determine next version number
        $versionNo = ($profile->versions()->max('version_no') ?? 0) + 1;

        return SignatureVersion::create([
            'profile_id'     => $profile->id,
            'file_path'      => $filePath,
            'hash'           => $hash,
            'version_no'     => $versionNo,
            'effective_from' => now(),
        ]);
    }

    /**
     * Re-authenticate the user by verifying their plaintext password against the stored hash.
     */
    public function reAuthenticate(User $user, string $password): bool
    {
        return Hash::check($password, $user->password);
    }

    /**
     * Compute a deterministic hash of the signable model's current state.
     */
    public function computeDocumentHash(Model $signable): string
    {
        return hash('sha256', json_encode($signable->toArray()));
    }

    /**
     * Record a signature event and write to the immutable audit log.
     */
    public function recordSignatureEvent(array $data): SignatureEvent
    {
        $event = SignatureEvent::create($data);

        AuditLog::record('saam.signed', [
            'auditable_type' => SignatureEvent::class,
            'auditable_id'   => $event->id,
            'new_values'     => [
                'action'        => $data['action'],
                'step_key'      => $data['step_key'] ?? null,
                'signable_type' => $data['signable_type'],
                'signable_id'   => $data['signable_id'],
                'auth_level'    => $data['auth_level'] ?? 'password',
                'is_delegated'  => $data['is_delegated'] ?? false,
            ],
            'tags' => 'saam',
        ]);

        return $event;
    }

    /**
     * Find an active delegation where $delegate is acting for someone with the given scope.
     */
    public function getActiveDelegate(User $delegate, ?string $scope = null): ?DelegatedAuthority
    {
        $query = DelegatedAuthority::where('delegate_user_id', $delegate->id)
            ->where('tenant_id', $delegate->tenant_id)
            ->where('start_date', '<=', now()->toDateString())
            ->where('end_date', '>=', now()->toDateString());

        if ($scope) {
            $query->where(function ($q) use ($scope) {
                $q->whereNull('role_scope')->orWhere('role_scope', $scope);
            });
        }

        return $query->first();
    }

    /**
     * Generate a signed PDF document for any signable entity and store it.
     */
    public function generateSignedDocument(Model $signable, int $tenantId): SignedDocument
    {
        $events = SignatureEvent::where('signable_type', get_class($signable))
            ->where('signable_id', $signable->id)
            ->with(['signer:id,name,job_title', 'signatureVersion'])
            ->orderBy('signed_at')
            ->get();

        $letterhead = TenantSetting::getLetterheadSettings($tenantId);

        // Build QR code (PNG base64) pointing to the verify URL
        $verifyUrl  = config('app.url') . '/saam/verify/' . class_basename($signable) . '/' . $signable->id;
        $qrResult   = Builder::create()
            ->data($verifyUrl)
            ->size(100)
            ->build();
        $qrBase64   = base64_encode($qrResult->getString());

        // Resolve signature images as base64 for embedding in PDF
        $eventsData = $events->map(function (SignatureEvent $e) {
            $sigBase64 = null;
            if ($e->signatureVersion && Storage::disk('local')->exists($e->signatureVersion->file_path)) {
                $sigBase64 = base64_encode(Storage::disk('local')->get($e->signatureVersion->file_path));
            }
            return [
                'name'       => $e->signer?->name ?? 'Unknown',
                'job_title'  => $e->signer?->job_title ?? '',
                'action'     => $e->action,
                'step_key'   => $e->step_key ?? '',
                'comment'    => $e->comment,
                'auth_level' => $e->auth_level,
                'is_delegated' => $e->is_delegated,
                'signed_at'  => $e->signed_at?->format('d M Y H:i'),
                'sig_base64' => $sigBase64,
            ];
        })->toArray();

        $pdf = Pdf::loadView('pdf.signed_document', [
            'signable'   => $signable,
            'letterhead' => $letterhead,
            'events'     => $eventsData,
            'qrBase64'   => $qrBase64,
            'verifyUrl'  => $verifyUrl,
        ])->setPaper('a4');

        $pdfBytes = $pdf->output();
        $pdfHash  = hash('sha256', $pdfBytes);

        // Check if same hash already stored (idempotent)
        $existing = SignedDocument::where('signable_type', get_class($signable))
            ->where('signable_id', $signable->id)
            ->where('hash', $pdfHash)
            ->first();

        if ($existing) {
            return $existing;
        }

        $version = SignedDocument::where('signable_type', get_class($signable))
            ->where('signable_id', $signable->id)
            ->max('version') ?? 0;

        $path = "signed_documents/{$tenantId}/" . class_basename($signable) . "_{$signable->id}_v" . ($version + 1) . ".pdf";
        Storage::disk('local')->put($path, $pdfBytes);

        return SignedDocument::create([
            'tenant_id'     => $tenantId,
            'signable_type' => get_class($signable),
            'signable_id'   => $signable->id,
            'version'       => $version + 1,
            'file_path'     => $path,
            'hash'          => $pdfHash,
            'finalized_at'  => now(),
        ]);
    }
}
