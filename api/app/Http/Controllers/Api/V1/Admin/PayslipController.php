<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payslip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayslipController extends Controller
{
    /**
     * List all payslips in the authenticated user's tenant (for admin view).
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $perPage = (int) $request->get('per_page', 50);
        $payslips = Payslip::where('tenant_id', $tenantId)
            ->with('user:id,name,email')
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json($payslips);
    }
}
