<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\Payslip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayslipConfirmationController extends Controller
{
    public function confirm(Request $request, Payslip $payslip): JsonResponse
    {
        $user = $request->user();
        $isHr = $user->isSystemAdmin()
            || $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr.edit');

        if (!$isHr) {
            abort(403, 'Only HR personnel may confirm payslips.');
        }

        $validated = $request->validate([
            'confirmation_status' => ['required', 'in:confirmed,rejected'],
            'confirmation_notes'  => ['nullable', 'string', 'max:1000'],
        ]);

        $payslip->update([
            'confirmation_status' => $validated['confirmation_status'],
            'confirmed_by'        => $user->id,
            'confirmed_at'        => now(),
            'confirmation_notes'  => $validated['confirmation_notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Payslip ' . $validated['confirmation_status'] . '.',
            'payslip' => $payslip->fresh()->load('confirmedBy'),
        ]);
    }
}
