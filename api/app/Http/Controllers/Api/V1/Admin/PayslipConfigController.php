<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmployeeSalaryAssignment;
use App\Models\HrGradeBand;
use App\Models\PayslipLineConfig;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayslipConfigController extends Controller
{
    private const DEFAULT_EARNINGS = [
        ['key' => 'basic_pay',               'label' => 'Basic Salary',             'type' => 'earning', 'source' => 'system', 'sort' => 1],
        ['key' => 'housing_allowance',        'label' => 'Housing Allowance',        'type' => 'earning', 'source' => 'system', 'sort' => 2],
        ['key' => 'transport_allowance',      'label' => 'Transport Allowance',      'type' => 'earning', 'source' => 'system', 'sort' => 3],
        ['key' => 'medical_allowance',        'label' => 'Medical Allowance',        'type' => 'earning', 'source' => 'system', 'sort' => 4],
        ['key' => 'communication_allowance',  'label' => 'Communication Allowance',  'type' => 'earning', 'source' => 'system', 'sort' => 5],
        ['key' => 'subsistence_allowance',    'label' => 'Subsistence Allowance',    'type' => 'earning', 'source' => 'system', 'sort' => 6],
    ];

    private const DEFAULT_DEDUCTIONS = [
        ['key' => 'income_tax',       'label' => 'Income Tax (PAYE)',    'type' => 'deduction', 'source' => 'manual', 'sort' => 10],
        ['key' => 'medical_aid',      'label' => 'Medical Aid',          'type' => 'deduction', 'source' => 'manual', 'sort' => 11],
        ['key' => 'advance_recovery', 'label' => 'Salary Advance Recovery', 'type' => 'deduction', 'source' => 'system', 'sort' => 12],
    ];

    private const DEFAULT_INFO = [
        ['key' => 'annual_leave_balance', 'label' => 'Annual Leave Balance', 'type' => 'info', 'source' => 'system', 'sort' => 20],
    ];

    public function index(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);

        $userId = (int) $request->query('user_id');
        if (!$userId) {
            return response()->json(['message' => 'user_id is required.'], 422);
        }

        $configs = PayslipLineConfig::where('user_id', $userId)
            ->where('tenant_id', $authUser->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $configs]);
    }

    public function store(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);

        $data = $request->validate([
            'user_id'        => ['required', 'integer', 'exists:users,id'],
            'component_key'  => ['required', 'string', 'max:60'],
            'label'          => ['required', 'string', 'max:100'],
            'component_type' => ['required', 'string', 'in:earning,deduction,company_contribution,info'],
            'source'         => ['required', 'string', 'in:system,manual'],
            'fixed_amount'   => ['nullable', 'numeric', 'min:0'],
            'is_visible'     => ['nullable', 'boolean'],
            'sort_order'     => ['nullable', 'integer', 'min:0'],
        ]);

        $targetUser = User::find($data['user_id']);
        abort_if(!$targetUser || (int) $targetUser->tenant_id !== (int) $authUser->tenant_id, 403);

        $config = PayslipLineConfig::create(array_merge($data, [
            'tenant_id'  => $authUser->tenant_id,
            'created_by' => $authUser->id,
        ]));

        return response()->json(['message' => 'Config created.', 'data' => $config], 201);
    }

    public function update(Request $request, PayslipLineConfig $config): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);
        abort_if((int) $config->tenant_id !== (int) $authUser->tenant_id, 403);

        $data = $request->validate([
            'label'        => ['sometimes', 'string', 'max:100'],
            'source'       => ['sometimes', 'string', 'in:system,manual'],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'is_visible'   => ['sometimes', 'boolean'],
            'sort_order'   => ['sometimes', 'integer', 'min:0'],
        ]);

        $config->update($data);

        return response()->json(['message' => 'Config updated.', 'data' => $config->fresh()]);
    }

    public function destroy(Request $request, PayslipLineConfig $config): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);
        abort_if((int) $config->tenant_id !== (int) $authUser->tenant_id, 403);

        $config->delete();

        return response()->json(['message' => 'Config deleted.']);
    }

    /**
     * Generate default line configs for an employee based on their grade band's allowance profile.
     * Skips any component_key that already exists for the user.
     */
    public function defaults(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $this->authorise($authUser);

        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $userId = (int) $data['user_id'];
        $targetUser = User::find($userId);
        abort_if(!$targetUser || (int) $targetUser->tenant_id !== (int) $authUser->tenant_id, 403);

        $existingKeys = PayslipLineConfig::where('user_id', $userId)
            ->pluck('component_key')
            ->flip()
            ->all();

        $defaults = array_merge(self::DEFAULT_EARNINGS, self::DEFAULT_DEDUCTIONS, self::DEFAULT_INFO);
        $created  = 0;

        foreach ($defaults as $def) {
            if (isset($existingKeys[$def['key']])) {
                continue;
            }

            PayslipLineConfig::create([
                'tenant_id'      => $authUser->tenant_id,
                'user_id'        => $userId,
                'component_key'  => $def['key'],
                'label'          => $def['label'],
                'component_type' => $def['type'],
                'source'         => $def['source'],
                'fixed_amount'   => null,
                'is_visible'     => true,
                'sort_order'     => $def['sort'],
                'created_by'     => $authUser->id,
            ]);

            $created++;
        }

        AuditLog::record('hr.payslip_config.defaults_generated', [
            'new_values' => ['user_id' => $userId, 'created' => $created],
            'tags'       => 'hr_payslip',
        ]);

        $configs = PayslipLineConfig::where('user_id', $userId)
            ->where('tenant_id', $authUser->tenant_id)
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'message' => "{$created} default line config(s) created.",
            'data'    => $configs,
        ]);
    }

    private function authorise(User $user): void
    {
        abort_unless(
            $user->hasPermissionTo('hr.admin') || $user->hasPermissionTo('hr.edit') || $user->hasPermissionTo('hr_settings.edit'),
            403,
            'Access restricted to HR administrators.'
        );
    }
}
