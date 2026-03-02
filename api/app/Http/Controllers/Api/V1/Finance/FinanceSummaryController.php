<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\Payslip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceSummaryController extends Controller
{
    /** Current net salary (from latest payslip) and YTD gross for the authenticated user. */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $currency = 'NAD';

        $latest = Payslip::where('user_id', $user->id)
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->first();

        $currentNetSalary = $latest ? (float) $latest->net_amount : null;
        $currentGrossSalary = $latest ? (float) $latest->gross_amount : null;
        $ytdGross = null;
        $currentYear = (int) date('Y');
        $ytdRow = Payslip::where('user_id', $user->id)
            ->where('period_year', $currentYear)
            ->sum('gross_amount');
        if ($ytdRow > 0) {
            $ytdGross = (float) $ytdRow;
        }

        return response()->json([
            'current_net_salary'   => $currentNetSalary,
            'current_gross_salary' => $currentGrossSalary,
            'ytd_gross'            => $ytdGross,
            'currency'             => $latest?->currency ?? $currency,
        ]);
    }
}
