<?php

namespace App\Http\Controllers;

use App\Exceptions\TokenExpiredException;
use App\Exceptions\TokenUsedException;
use App\Services\SignedTokenService;
use App\Services\WorkflowService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Phase 2 secure email-action: no unauthenticated one-click approve.
 * Deep-link into Nexus with version display; MFA note for high-risk.
 */
class EmailApprovalController extends Controller
{
    public function __construct(
        protected SignedTokenService $tokenService,
        protected WorkflowService $workflowService,
    ) {}

    /**
     * Deep-link to authenticated Nexus approval UI — never auto-approves.
     */
    public function approve(string $token)
    {
        try {
            $record = $this->tokenService->peek($token);
            $approvalRequest = $record->approvalRequest()->with(['workflow.steps', 'definitionVersion', 'approvable'])->first();
            $frontend = rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/');
            $highRisk = (bool) ($approvalRequest?->workflow?->steps?->get($approvalRequest->current_step_index)?->high_risk);
            $version = $approvalRequest?->definitionVersion?->version_number
                ?? $approvalRequest?->workflow?->current_version
                ?? null;

            $qs = http_build_query([
                'action' => 'approve',
                'token' => $token,
                'version' => $version,
                'high_risk' => $highRisk ? '1' : '0',
                'auth_required' => '1',
            ]);

            return redirect()->away($frontend.'/approval?'.$qs);
        } catch (TokenExpiredException $e) {
            return view('email-approval.error', [
                'reason' => 'expired',
                'message' => 'This approval link has expired (links are valid for 72 hours). Please log in to the SADC-PF portal to review and action the request.',
            ]);
        } catch (TokenUsedException $e) {
            return view('email-approval.error', [
                'reason' => 'used',
                'message' => 'This approval link has already been used. The request has been actioned.',
            ]);
        } catch (ModelNotFoundException $e) {
            return view('email-approval.error', [
                'reason' => 'invalid',
                'message' => 'This approval link is invalid. It may have been deleted or never existed.',
            ]);
        } catch (Throwable $e) {
            return view('email-approval.error', [
                'reason' => 'error',
                'message' => 'An unexpected error occurred. Please log in to the portal to action this request.',
            ]);
        }
    }

    public function rejectForm(string $token)
    {
        try {
            $this->tokenService->peek($token);
            $frontend = rtrim(env('FRONTEND_URL', 'http://localhost:3000'), '/');

            return redirect()->away($frontend.'/approval?action=reject&token='.$token.'&auth_required=1');
        } catch (TokenExpiredException $e) {
            return view('email-approval.error', [
                'reason' => 'expired',
                'message' => 'This rejection link has expired (links are valid for 72 hours). Please log in to the SADC-PF portal to action the request.',
            ]);
        } catch (TokenUsedException $e) {
            return view('email-approval.error', [
                'reason' => 'used',
                'message' => 'This rejection link has already been used. The request has been actioned.',
            ]);
        } catch (ModelNotFoundException $e) {
            return view('email-approval.error', [
                'reason' => 'invalid',
                'message' => 'This rejection link is invalid.',
            ]);
        }
    }

    /**
     * Legacy POST reject path — blocked when auth-required mode is on.
     */
    public function rejectSubmit(Request $request, string $token)
    {
        if (config('workflow_engine.email_require_auth', true)) {
            return response()->view('email-approval.error', [
                'reason' => 'auth_required',
                'message' => 'Unauthenticated email rejection is disabled. Please sign in to Nexus to reject this request.',
            ], 403);
        }

        $request->validate([
            'reason' => 'required|string|min:5|max:1000',
        ]);

        try {
            $record = $this->tokenService->consume($token, 'reject');
            $approvalRequest = $record->approvalRequest;
            $approver = $record->approver;

            $this->workflowService->reject($approvalRequest, $approver, $request->input('reason'));

            $entity = $approvalRequest->approvable;

            return view('email-approval.confirmed', [
                'action' => 'rejected',
                'reference' => $entity->reference_number ?? "#{$approvalRequest->id}",
                'module' => $this->moduleLabel($approvalRequest->approvable_type),
                'requester' => optional($entity->requester)->name ?? 'the requester',
            ]);
        } catch (TokenExpiredException $e) {
            return view('email-approval.error', [
                'reason' => 'expired',
                'message' => 'This rejection link has expired.',
            ]);
        } catch (TokenUsedException $e) {
            return view('email-approval.error', [
                'reason' => 'used',
                'message' => 'This rejection link has already been used.',
            ]);
        } catch (ValidationException $e) {
            return view('email-approval.error', [
                'reason' => 'workflow',
                'message' => $e->getMessage(),
            ]);
        } catch (Throwable $e) {
            return view('email-approval.error', [
                'reason' => 'error',
                'message' => 'An unexpected error occurred.',
            ]);
        }
    }

    private function moduleLabel(?string $type): string
    {
        return match ($type) {
            'App\\Models\\TravelRequest' => 'Travel',
            'App\\Models\\LeaveRequest' => 'Leave',
            'App\\Models\\ImprestRequest' => 'Imprest',
            'App\\Models\\ProcurementRequest' => 'Procurement',
            'App\\Models\\SalaryAdvanceRequest' => 'Salary Advance',
            default => 'Request',
        };
    }
}
