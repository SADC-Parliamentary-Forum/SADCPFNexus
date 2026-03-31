<?php

namespace App\Http\Controllers\Api\V1\EmailAction;

use App\Exceptions\TokenExpiredException;
use App\Exceptions\TokenUsedException;
use App\Http\Controllers\Controller;
use App\Models\SignatureEvent;
use App\Models\SignatureProfile;
use App\Models\SignedActionToken;
use App\Services\SignedTokenService;
use App\Services\WorkflowService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class EmailActionController extends Controller
{
    /** Maps approvable_type class names to module keys for SignatureEvent signable_type. */
    private const SIGNABLE_TYPE_MAP = [
        'App\\Models\\TravelRequest'        => 'App\\Models\\TravelRequest',
        'App\\Models\\LeaveRequest'         => 'App\\Models\\LeaveRequest',
        'App\\Models\\ImprestRequest'       => 'App\\Models\\ImprestRequest',
        'App\\Models\\ProcurementRequest'   => 'App\\Models\\ProcurementRequest',
        'App\\Models\\SalaryAdvanceRequest' => 'App\\Models\\SalaryAdvanceRequest',
    ];

    private const MODULE_LABELS = [
        'App\\Models\\TravelRequest'        => 'Travel',
        'App\\Models\\LeaveRequest'         => 'Leave',
        'App\\Models\\ImprestRequest'       => 'Imprest',
        'App\\Models\\ProcurementRequest'   => 'Procurement',
        'App\\Models\\SalaryAdvanceRequest' => 'Salary Advance',
    ];

    public function __construct(
        protected SignedTokenService $tokenService,
        protected WorkflowService    $workflowService,
    ) {}

    /**
     * Return a preview of the request associated with a token.
     * Unauthenticated — used by the frontend approval page to show request details.
     *
     * GET /api/v1/email-action/preview/{token}
     */
    public function preview(string $token): JsonResponse
    {
        try {
            $record = SignedActionToken::valid()->where('token', $token)->firstOrFail();
            $approvalRequest = $record->approvalRequest()->with('approvable')->first();

            if (!$approvalRequest) {
                return response()->json(['error' => 'Request not found.'], 404);
            }

            $entity       = $approvalRequest->approvable;
            $approvableType = $approvalRequest->approvable_type;
            $module       = self::MODULE_LABELS[$approvableType] ?? 'Request';

            $summary = $this->buildSummary($entity, $approvableType);

            return response()->json([
                'token_action'  => $record->action,
                'expires_at'    => $record->expires_at?->toIso8601String(),
                'module'        => $module,
                'reference'     => $entity?->reference_number ?? "#{$approvalRequest->id}",
                'requester'     => optional($entity?->requester)->name ?? 'Staff member',
                'summary'       => $summary,
                'approver_id'   => $record->approver_user_id,
            ]);
        } catch (ModelNotFoundException) {
            return response()->json(['error' => 'This link is invalid or has expired.', 'reason' => 'invalid'], 404);
        }
    }

    /**
     * Process an approval or rejection via an authenticated API call.
     * Validates that the token was issued to the authenticated user.
     * Optionally records a SignatureEvent using the user's active signature.
     *
     * POST /api/v1/email-action/process
     */
    public function process(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'           => 'required|string|size:64',
            'action'          => 'required|in:approve,reject',
            'reason'          => 'required_if:action,reject|nullable|string|min:5|max:1000',
            'use_signature'   => 'nullable|boolean',
            'signature_type'  => 'nullable|in:full,initials',
        ]);

        $user = $request->user();

        try {
            $record = $this->tokenService->consume($data['token'], $data['action']);
        } catch (TokenExpiredException) {
            return response()->json(['error' => 'This approval link has expired.', 'reason' => 'expired'], 422);
        } catch (TokenUsedException) {
            return response()->json(['error' => 'This approval link has already been used.', 'reason' => 'used'], 422);
        } catch (ModelNotFoundException) {
            return response()->json(['error' => 'This approval link is invalid.', 'reason' => 'invalid'], 404);
        }

        // Verify this token was issued to the authenticated user
        if ((int) $record->approver_user_id !== (int) $user->id) {
            return response()->json([
                'error'  => 'This approval link was issued to a different approver.',
                'reason' => 'wrong_user',
            ], 403);
        }

        $approvalRequest = $record->approvalRequest;
        $entity          = $approvalRequest->approvable;

        // Perform the workflow action
        try {
            if ($data['action'] === 'approve') {
                $this->workflowService->approve($approvalRequest, $user);
            } else {
                $this->workflowService->reject($approvalRequest, $user, $data['reason'] ?? '');
            }
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage(), 'reason' => 'workflow'], 422);
        }

        // Optionally record a SignatureEvent
        $signatureVersionId = null;
        if (!empty($data['use_signature'])) {
            $sigType = $data['signature_type'] ?? 'full';
            $profile = SignatureProfile::activeForUser($user->id, $sigType);
            if ($profile) {
                $activeVersion = $profile->activeVersion;
                if ($activeVersion) {
                    $signatureVersionId = $activeVersion->id;

                    SignatureEvent::create([
                        'tenant_id'            => $user->tenant_id,
                        'signable_type'        => $approvalRequest->approvable_type,
                        'signable_id'          => $entity?->id,
                        'step_key'             => 'email_approval',
                        'signer_user_id'       => $user->id,
                        'signature_version_id' => $signatureVersionId,
                        'action'               => $data['action'],
                        'comment'              => $data['action'] === 'reject' ? ($data['reason'] ?? '') : null,
                        'auth_level'           => 'email_token',
                        'ip_address'           => $request->ip(),
                        'user_agent'           => $request->userAgent(),
                        'document_hash'        => $entity ? hash('sha256', json_encode($entity->toArray())) : null,
                        'is_delegated'         => false,
                        'signed_at'            => now(),
                    ]);
                }
            }
        }

        $module = self::MODULE_LABELS[$approvalRequest->approvable_type] ?? 'Request';

        return response()->json([
            'message'             => 'Action recorded successfully.',
            'action'              => $data['action'],
            'module'              => $module,
            'reference'           => $entity?->reference_number ?? "#{$approvalRequest->id}",
            'requester'           => optional($entity?->requester)->name,
            'signature_recorded'  => $signatureVersionId !== null,
        ]);
    }

    private function buildSummary(?object $entity, string $approvableType): string
    {
        if (!$entity) return '';

        return match ($approvableType) {
            'App\\Models\\TravelRequest'        => 'Destination: ' . ($entity->destination_city ?? '') . ', ' . ($entity->destination_country ?? '') . "\nDeparture: " . ($entity->departure_date ?? ''),
            'App\\Models\\LeaveRequest'         => 'Type: ' . ($entity->leave_type ?? '') . "\nFrom: " . ($entity->start_date ?? '') . ' to ' . ($entity->end_date ?? ''),
            'App\\Models\\ImprestRequest'       => 'Amount: ' . number_format((float) ($entity->amount_requested ?? 0), 2) . ' ' . ($entity->currency ?? 'USD') . "\nPurpose: " . ($entity->purpose ?? ''),
            'App\\Models\\ProcurementRequest'   => 'Item: ' . ($entity->title ?? '') . "\nEstimated value: " . number_format((float) ($entity->estimated_value ?? 0), 2) . ' ' . ($entity->currency ?? 'USD'),
            'App\\Models\\SalaryAdvanceRequest' => 'Amount: ' . number_format((float) ($entity->amount ?? 0), 2) . ' ' . ($entity->currency ?? 'USD') . "\nPurpose: " . ($entity->purpose ?? ''),
            default                             => '',
        };
    }
}
