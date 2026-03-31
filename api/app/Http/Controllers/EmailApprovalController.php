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

class EmailApprovalController extends Controller
{
    public function __construct(
        protected SignedTokenService $tokenService,
        protected WorkflowService    $workflowService,
    ) {}

    /**
     * Handle a one-click approve action from an email link.
     */
    public function approve(string $token)
    {
        try {
            $record          = $this->tokenService->consume($token, 'approve');
            $approvalRequest = $record->approvalRequest;
            $approver        = $record->approver;

            $this->workflowService->approve($approvalRequest, $approver);

            $entity = $approvalRequest->approvable;

            return view('email-approval.confirmed', [
                'action'    => 'approved',
                'reference' => $entity->reference_number ?? "#{$approvalRequest->id}",
                'module'    => $this->moduleLabel($approvalRequest->approvable_type),
                'requester' => optional($entity->requester)->name ?? 'the requester',
            ]);
        } catch (TokenExpiredException $e) {
            return view('email-approval.error', [
                'reason' => 'expired',
                'message' => 'This approval link has expired (links are valid for 72 hours). Please log in to the SADC-PF portal to review and action the request.',
            ]);
        } catch (TokenUsedException $e) {
            return view('email-approval.error', [
                'reason'  => 'used',
                'message' => 'This approval link has already been used. The request has been actioned.',
            ]);
        } catch (ModelNotFoundException $e) {
            return view('email-approval.error', [
                'reason'  => 'invalid',
                'message' => 'This approval link is invalid. It may have been deleted or never existed.',
            ]);
        } catch (ValidationException $e) {
            return view('email-approval.error', [
                'reason'  => 'workflow',
                'message' => $e->getMessage() . ' Please log in to the portal to review the request status.',
            ]);
        } catch (Throwable $e) {
            return view('email-approval.error', [
                'reason'  => 'error',
                'message' => 'An unexpected error occurred. Please log in to the portal to action this request.',
            ]);
        }
    }

    /**
     * Show the rejection reason form.
     */
    public function rejectForm(string $token)
    {
        try {
            $this->tokenService->peek($token);

            return view('email-approval.reject-form', ['token' => $token]);
        } catch (TokenExpiredException $e) {
            return view('email-approval.error', [
                'reason'  => 'expired',
                'message' => 'This rejection link has expired (links are valid for 72 hours). Please log in to the SADC-PF portal to action the request.',
            ]);
        } catch (TokenUsedException $e) {
            return view('email-approval.error', [
                'reason'  => 'used',
                'message' => 'This rejection link has already been used. The request has been actioned.',
            ]);
        } catch (ModelNotFoundException $e) {
            return view('email-approval.error', [
                'reason'  => 'invalid',
                'message' => 'This rejection link is invalid.',
            ]);
        }
    }

    /**
     * Process the submitted rejection reason.
     */
    public function rejectSubmit(Request $request, string $token)
    {
        $request->validate([
            'reason' => 'required|string|min:5|max:1000',
        ]);

        try {
            $record          = $this->tokenService->consume($token, 'reject');
            $approvalRequest = $record->approvalRequest;
            $approver        = $record->approver;

            $this->workflowService->reject($approvalRequest, $approver, $request->input('reason'));

            $entity = $approvalRequest->approvable;

            return view('email-approval.confirmed', [
                'action'    => 'rejected',
                'reference' => $entity->reference_number ?? "#{$approvalRequest->id}",
                'module'    => $this->moduleLabel($approvalRequest->approvable_type),
                'requester' => optional($entity->requester)->name ?? 'the requester',
            ]);
        } catch (TokenExpiredException $e) {
            return view('email-approval.error', [
                'reason'  => 'expired',
                'message' => 'This rejection link has expired. Please log in to the portal to action the request.',
            ]);
        } catch (TokenUsedException $e) {
            return view('email-approval.error', [
                'reason'  => 'used',
                'message' => 'This rejection link has already been used.',
            ]);
        } catch (ModelNotFoundException $e) {
            return view('email-approval.error', [
                'reason'  => 'invalid',
                'message' => 'This rejection link is invalid.',
            ]);
        } catch (ValidationException $e) {
            // Re-render the form with the error
            return view('email-approval.reject-form', [
                'token' => $token,
                'error' => $e->getMessage(),
            ]);
        } catch (Throwable $e) {
            return view('email-approval.error', [
                'reason'  => 'error',
                'message' => 'An unexpected error occurred. Please log in to the portal to action this request.',
            ]);
        }
    }

    private function moduleLabel(?string $approvableType): string
    {
        $map = [
            'App\\Models\\TravelRequest'        => 'Travel',
            'App\\Models\\LeaveRequest'         => 'Leave',
            'App\\Models\\ImprestRequest'       => 'Imprest',
            'App\\Models\\ProcurementRequest'   => 'Procurement',
            'App\\Models\\SalaryAdvanceRequest' => 'Salary Advance',
        ];

        return $map[$approvableType] ?? 'Request';
    }
}
