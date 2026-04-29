<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use App\Models\VendorPerformanceEvaluation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VendorPerformanceController extends Controller
{
    public function index(Request $request, Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $evaluations = $vendor->evaluations()
            ->with([
                'evaluator:id,name',
                'contract:id,reference_number,title,status',
            ])
            ->orderByDesc('created_at')
            ->get();

        $avg = [
            'delivery'      => round($evaluations->avg('delivery_score'), 2),
            'quality'       => round($evaluations->avg('quality_score'), 2),
            'price'         => round($evaluations->avg('price_score'), 2),
            'compliance'    => round($evaluations->avg('compliance_score'), 2),
            'communication' => round($evaluations->avg('communication_score'), 2),
            'overall'       => round($evaluations->avg(fn ($e) => $e->overall_score), 2),
        ];

        return response()->json([
            'data'  => $evaluations,
            'avg'   => $avg,
            'count' => $evaluations->count(),
        ]);
    }

    public function store(Request $request, Vendor $vendor): JsonResponse
    {
        if ((int) $vendor->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'delivery_score'      => ['required', 'integer', 'min:1', 'max:5'],
            'quality_score'       => ['required', 'integer', 'min:1', 'max:5'],
            'price_score'         => ['required', 'integer', 'min:1', 'max:5'],
            'compliance_score'    => ['required', 'integer', 'min:1', 'max:5'],
            'communication_score' => ['required', 'integer', 'min:1', 'max:5'],
            'contract_id'         => ['nullable', 'integer', 'exists:contracts,id'],
            'notes'               => ['nullable', 'string', 'max:2000'],
        ]);

        $evaluation = VendorPerformanceEvaluation::create([
            'tenant_id'           => $request->user()->tenant_id,
            'vendor_id'           => $vendor->id,
            'evaluated_by'        => $request->user()->id,
            'contract_id'         => $data['contract_id'] ?? null,
            'delivery_score'      => $data['delivery_score'],
            'quality_score'       => $data['quality_score'],
            'price_score'         => $data['price_score'],
            'compliance_score'    => $data['compliance_score'],
            'communication_score' => $data['communication_score'],
            'notes'               => $data['notes'] ?? null,
        ]);

        $evaluation->load('evaluator:id,name', 'contract:id,reference_number,title');

        return response()->json(['message' => 'Evaluation submitted.', 'data' => $evaluation], 201);
    }
}
