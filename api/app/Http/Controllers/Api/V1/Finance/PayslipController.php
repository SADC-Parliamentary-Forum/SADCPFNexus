<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\Payslip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PayslipController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) ($request->get('per_page', 20));
        $payslips = Payslip::where('user_id', $request->user()->id)
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->paginate($perPage);

        return response()->json($payslips);
    }

    public function show(Request $request, Payslip $payslip): JsonResponse
    {
        if ($payslip->user_id !== $request->user()->id) {
            abort(403);
        }
        return response()->json($payslip);
    }

    /** Return a download URL or inline PDF. For now returns JSON with optional download_url if file exists. */
    public function download(Request $request, Payslip $payslip): JsonResponse|\Symfony\Component\HttpFoundation\StreamedResponse
    {
        if ($payslip->user_id !== $request->user()->id) {
            abort(403);
        }
        if (!$payslip->file_path || !Storage::disk('local')->exists($payslip->file_path)) {
            return response()->json([
                'message' => 'Payslip document not yet available.',
                'payslip' => $payslip->only(['id', 'period_month', 'period_year', 'net_amount', 'gross_amount', 'currency']),
            ], 404);
        }
        $filename = sprintf('payslip-%d-%02d-%d.pdf', $payslip->period_year, $payslip->period_month, $payslip->id);
        $stream = Storage::disk('local')->readStream($payslip->file_path);
        return response()->streamDownload(function () use ($stream) {
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
