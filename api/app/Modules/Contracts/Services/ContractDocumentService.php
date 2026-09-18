<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractDocumentVersion;
use App\Models\ContractTemplateVersion;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/**
 * Generates contract document artefacts. WS2 produces the editable working
 * draft from a template; WS4 layers on the locked approved PDF and the
 * immutable executed contract (both hashed).
 */
class ContractDocumentService
{
    public function __construct(private readonly ContractTemplateService $templates) {}

    /**
     * Render a working draft from a template version and record a hashed
     * document version. Throws (via the template service) if mandatory merge
     * fields are missing.
     */
    public function generateWorking(Contract $contract, ContractTemplateVersion $version, User $user): ContractDocumentVersion
    {
        $html = $this->templates->render($version, $contract);
        $hash = hash('sha256', $html);
        $next = (int) $contract->documentVersions()->max('version') + 1;

        $path = sprintf('contracts/%d/working-v%d-%s.html', $contract->id, $next, substr($hash, 0, 8));
        Storage::put($path, $html);

        $doc = ContractDocumentVersion::create([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'version' => $next,
            'kind' => 'working',
            'storage_path' => $path,
            'hash' => $hash,
            'hash_algorithm' => 'sha256',
            'generated_at' => now(),
            'generated_by' => $user->id,
            'is_locked' => false,
        ]);

        $contract->update([
            'template_version_id' => $version->id,
            'current_document_version_id' => $doc->id,
        ]);

        return $doc;
    }
}
