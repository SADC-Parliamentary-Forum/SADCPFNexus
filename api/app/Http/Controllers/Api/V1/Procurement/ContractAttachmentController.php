<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Modules\Documents\Services\ModuleDocumentBridge;
use App\Support\AttachmentFiles;
use App\Support\UploadContentSniffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Served on both /procurement/contracts/{contract}/attachments and
 * /contracts/{contract}/attachments. The /contracts prefix has no endpoint
 * permission mapping, so mutation rights are enforced here, mirroring
 * ContractController's edit permissions.
 */
class ContractAttachmentController extends Controller
{
    /** May add documents to a contract. */
    private const UPLOAD_PERMISSIONS = ['procurement.admin', 'procurement.create', 'contract.create', 'contract.edit_draft'];

    /** May remove documents from a contract that is not yet signature-locked. */
    private const DELETE_PERMISSIONS = ['procurement.admin', 'contract.edit_draft'];

    public function __construct(private readonly ModuleDocumentBridge $bridge) {}

    public function index(Request $request, Contract $contract): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        $attachments = $contract->attachments()->with('uploader:id,name')->get();

        return response()->json(['data' => $attachments]);
    }

    public function store(Request $request, Contract $contract): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        $this->ensureHasAny($request, self::UPLOAD_PERMISSIONS);
        $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'document_type' => ['nullable', 'string', 'in:'.implode(',', Attachment::CONTRACT_DOCUMENT_TYPES)],
        ]);
        $file = $request->file('file');
        UploadContentSniffer::assertAllowed($file);
        $attachment = $this->bridge->storeAttachment($request->user(), $contract, $file, [
            'document_type' => $request->input('document_type', Attachment::DOCUMENT_TYPE_SIGNED_CONTRACT),
            'module' => 'procurement',
        ]);

        return response()->json(['message' => 'Attachment uploaded.', 'data' => $attachment], 201);
    }

    public function destroy(Request $request, Contract $contract, Attachment $attachment): JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        $this->ensureHasAny($request, self::DELETE_PERMISSIONS);
        if ($attachment->attachable_type !== Contract::class || (int) $attachment->attachable_id !== (int) $contract->id) {
            abort(404);
        }

        // Once signing has started the document set is part of the executed
        // record (Contract::isSignatureLocked); only administrators may remove
        // a document, and the removal is audited.
        $user = $request->user();
        $isAdmin = $user->isSystemAdmin() || $user->hasAnyPermission(['procurement.admin']);
        if ($contract->isSignatureLocked()) {
            if (! $isAdmin) {
                return response()->json([
                    'message' => 'Documents on a signed or executing contract cannot be removed.',
                ], 422);
            }
            AuditLog::record('contract.attachment_removed_after_signature', [
                'auditable_type' => Contract::class,
                'auditable_id' => $contract->id,
                'tags' => 'procurement',
                'new_values' => ['attachment_id' => $attachment->id, 'original_filename' => $attachment->original_filename],
            ]);
        }

        $this->bridge->unlinkAttachment($user, $attachment);

        return response()->json(['message' => 'Attachment unlinked.']);
    }

    public function download(Request $request, Contract $contract, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $this->ensureCanAccess($request, $contract);
        if ($attachment->attachable_type !== Contract::class || (int) $attachment->attachable_id !== (int) $contract->id) {
            abort(404);
        }

        return AttachmentFiles::download($attachment);
    }

    private function ensureCanAccess(Request $request, Contract $contract): void
    {
        if ($contract->tenant_id !== $request->user()->tenant_id) {
            abort(404);
        }
    }

    /** @param string[] $permissions */
    private function ensureHasAny(Request $request, array $permissions): void
    {
        $user = $request->user();
        if ($user->isSystemAdmin() || $user->hasAnyPermission($permissions) || $user->hasRole('Procurement Officer')) {
            return;
        }
        abort(403);
    }
}
