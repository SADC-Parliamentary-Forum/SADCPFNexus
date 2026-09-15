<?php

namespace App\Http\Controllers\Api\V1\Assets;

use App\Http\Controllers\Controller;
use App\Models\AssetRecoveryContact;
use App\Models\AssetRecoveryContactVersion;
use App\Modules\Assets\Services\AssetNumberingService;
use App\Modules\Assets\Services\AssetRecoveryContactService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetSettingsController extends Controller
{
    public function __construct(
        private readonly AssetRecoveryContactService $contacts,
        private readonly AssetNumberingService $numbering,
    ) {}

    public function showRecoveryContact(Request $request): JsonResponse
    {
        $contact = $this->contacts->current((int) $request->user()->tenant_id);

        return response()->json(['data' => $contact]);
    }

    public function updateRecoveryContact(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_category_id' => ['nullable', 'integer'],
            'name' => ['nullable', 'string', 'max:128'],
            'department' => ['nullable', 'string', 'max:128'],
            'primary_phone' => ['required', 'string', 'max:64'],
            'secondary_phone' => ['nullable', 'string', 'max:64'],
            'whatsapp' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255'],
            'return_address' => ['nullable', 'string', 'max:500'],
            'office_hours' => ['nullable', 'string', 'max:128'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'show_primary_phone' => ['nullable', 'boolean'],
            'show_secondary_phone' => ['nullable', 'boolean'],
            'show_whatsapp' => ['nullable', 'boolean'],
            'show_email' => ['nullable', 'boolean'],
            'show_address' => ['nullable', 'boolean'],
            'active' => ['nullable', 'boolean'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);
        $contact = $this->contacts->update($request->user(), $data);

        return response()->json(['data' => $contact]);
    }

    public function recoveryContactHistory(Request $request): JsonResponse
    {
        $contact = AssetRecoveryContact::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereNull('asset_category_id')
            ->first();
        if (! $contact) {
            return response()->json(['data' => []]);
        }
        $rows = AssetRecoveryContactVersion::query()
            ->where('recovery_contact_id', $contact->id)
            ->orderByDesc('version')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function numbering(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->numbering->policy((int) $request->user()->tenant_id)]);
    }

    public function updateNumbering(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prefix' => ['nullable', 'string', 'max:16'],
            'separator' => ['nullable', 'string', 'max:4'],
            'sequence_length' => ['nullable', 'integer', 'min:1', 'max:8'],
            'include_category' => ['nullable', 'boolean'],
            'include_subcategory' => ['nullable', 'boolean'],
            'auto_assign' => ['nullable', 'boolean'],
        ]);

        return response()->json(['data' => $this->numbering->updatePolicy($request->user(), $data)]);
    }
}
