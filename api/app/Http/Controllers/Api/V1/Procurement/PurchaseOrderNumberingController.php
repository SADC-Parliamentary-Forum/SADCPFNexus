<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Modules\Documents\Services\DocumentNumberingService;
use App\Modules\Procurement\Services\LpoSequenceAllocator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseOrderNumberingController extends Controller
{
    public function __construct(private readonly DocumentNumberingService $numbers) {}

    public function show(Request $request): JsonResponse
    {
        $this->assertView($request);

        return response()->json(['data' => $this->numbers->status((int) $request->user()->tenant_id)]);
    }

    public function parse(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'last_existing_reference' => ['required', 'string', 'max:80'],
        ]);
        $parsed = $this->numbers->parseLegacyReference($data['last_existing_reference']);
        $pattern = $this->numbers->patternFromParts($parsed['prefix'], $parsed['separator'], $parsed['padding']);
        $next = $this->numbers->formatFromPattern($pattern, $parsed['sequence'] + 1);

        return response()->json([
            'data' => array_merge($parsed, [
                'pattern' => $pattern,
                'next_example' => $next,
            ]),
        ]);
    }

    public function activate(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'last_legacy_number' => ['nullable', 'integer', 'min:0'],
            'last_existing_reference' => ['nullable', 'string', 'max:80'],
            'reason' => ['required', 'string', 'max:500'],
            'pattern' => ['nullable', 'string', 'max:120'],
            'prefix' => ['nullable', 'string', 'max:40'],
            'separator' => ['nullable', 'string', 'max:8'],
            'padding' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);
        $last = (int) ($data['last_legacy_number'] ?? 0);
        $prefix = $data['prefix'] ?? null;
        $separator = $data['separator'] ?? null;
        $padding = $data['padding'] ?? null;
        if (! empty($data['last_existing_reference'])) {
            $parsed = $this->numbers->parseLegacyReference($data['last_existing_reference']);
            $last = $parsed['sequence'];
            $prefix ??= $parsed['prefix'];
            $separator ??= $parsed['separator'];
            $padding ??= $parsed['padding'];
        }
        $status = $this->numbers->activate(
            (int) $request->user()->tenant_id,
            $request->user(),
            $last,
            $data['reason'],
            LpoSequenceAllocator::SCHEME_KEY,
            DocumentNumberingService::DOCUMENT_TYPE_PURCHASE_ORDER,
            $prefix,
            $separator,
            $padding,
            $data['pattern'] ?? null,
        );

        return response()->json(['message' => 'LPO sequence activated.', 'data' => $status]);
    }

    public function setNext(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate([
            'next_sequence' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $status = $this->numbers->setNext(
            (int) $request->user()->tenant_id,
            $request->user(),
            (int) $data['next_sequence'],
            $data['reason'],
        );

        return response()->json(['message' => 'Next sequence updated.', 'data' => $status]);
    }

    private function assertView(Request $request): void
    {
        if (! $request->user()->hasAnyPermission(['procurement.view', 'procurement.admin', 'procurement.sequence.manage']) && ! $request->user()->hasRole('System Admin')) {
            abort(403);
        }
    }

    private function assertAdmin(Request $request): void
    {
        if (! $request->user()->hasAnyPermission(['procurement.admin', 'procurement.sequence.manage']) && ! $request->user()->hasRole('System Admin')) {
            abort(403);
        }
    }
}
