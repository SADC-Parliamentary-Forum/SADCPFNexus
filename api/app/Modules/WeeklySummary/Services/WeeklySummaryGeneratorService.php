<?php

namespace App\Modules\WeeklySummary\Services;

use App\Models\User;
use App\Models\WeeklySummaryReport;
use App\Models\WeeklySummaryRun;
use Illuminate\Support\Carbon;

class WeeklySummaryGeneratorService
{
    private const TEMPLATE_VERSION = '1.0';

    public function __construct(
        private readonly WeeklySummaryScopeService $scopeService
    ) {}

    /**
     * Generate and persist a weekly summary report for a single user.
     */
    public function generate(WeeklySummaryRun $run, User $user): WeeklySummaryReport
    {
        $scope = $this->scopeService->resolve($user);
        $asOf  = Carbon::now();

        $data = new WeeklySummaryDataService(
            $scope['tenant_id'],
            $scope['user_ids'],
            Carbon::parse($run->period_start),
            Carbon::parse($run->period_end),
            $asOf
        );

        $sections = [
            'who_is_out'  => $data->getWhoIsOut(),
            'travel'      => $data->getTravelSummary(),
            'leave'       => $data->getLeaveSummary(),
            'timesheets'  => $data->getTimesheetSummary(),
            'assignments' => $data->getAssignmentSummary(),
            'approvals'   => $data->getApprovalsSummary($user),
            'personal'    => $data->getPersonalSummary($user),
        ];

        $sections['highlights'] = $data->buildHighlights($sections);

        $payload = [
            'meta' => [
                'period_start'  => $run->period_start->toDateString(),
                'period_end'    => $run->period_end->toDateString(),
                'generated_at'  => $asOf->toIso8601String(),
                'scope'         => [
                    'type'  => $scope['type'],
                    'label' => $scope['label'],
                ],
            ],
            'highlights'  => $sections['highlights'],
            'who_is_out'  => $sections['who_is_out'],
            'travel'      => $sections['travel'],
            'leave'       => $sections['leave'],
            'timesheets'  => $sections['timesheets'],
            'assignments' => $sections['assignments'],
            'approvals'   => $sections['approvals'],
            'personal'    => $sections['personal'],
        ];

        $hash = hash('sha256', json_encode($payload));

        return WeeklySummaryReport::create([
            'run_id'           => $run->id,
            'tenant_id'        => $user->tenant_id,
            'user_id'          => $user->id,
            'scope_type'       => $scope['type'],
            'period_start'     => $run->period_start,
            'period_end'       => $run->period_end,
            'payload'          => $payload,
            'payload_hash'     => $hash,
            'template_version' => self::TEMPLATE_VERSION,
            'status'           => 'generated',
        ]);
    }
}
