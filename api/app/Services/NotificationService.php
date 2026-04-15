<?php

namespace App\Services;

use App\Mail\ModuleNotificationMail;
use App\Models\DeviceToken;
use App\Services\FcmService;
use App\Models\Notification;
use App\Models\NotificationTemplate;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Dispatch an in-app notification and (optionally) an email to a user.
     *
     * @param  User   $recipient    The user to notify.
     * @param  string $triggerKey   e.g. 'travel.approved'
     * @param  array  $vars         Placeholder values: ['name' => '...', 'destination' => '...', ...]
     * @param  array  $meta         Extra data stored on the notification (module, record_id, url, etc.)
     * @param  bool   $sendEmail    Whether to also send an email (default true).
     */
    public function dispatch(
        User $recipient,
        string $triggerKey,
        array $vars = [],
        array $meta = [],
        bool $sendEmail = true,
        bool $sendPush = true
    ): void {
        $template = $this->resolveTemplate($recipient->tenant_id, $triggerKey);
        $subject  = $this->replacePlaceholders($template['subject'], $vars);
        $body     = $this->replacePlaceholders($template['body'], $vars);

        Notification::create([
            'tenant_id' => $recipient->tenant_id,
            'user_id'   => $recipient->id,
            'type'      => 'App\\Notifications\\ModuleNotification',
            'trigger'   => $triggerKey,
            'subject'   => $subject,
            'body'      => $body,
            'meta'      => $meta ?: null,
            'is_read'   => false,
        ]);

        // Queue email
        if ($sendEmail && filter_var($recipient->email, FILTER_VALIDATE_EMAIL)) {
            $approveUrl = $meta['approve_url'] ?? null;
            $rejectUrl  = $meta['reject_url']  ?? null;

            Mail::to($recipient->email)
                ->queue(new ModuleNotificationMail($subject, $body, $recipient->name, $approveUrl, $rejectUrl));
        }

        // FCM push notification
        if ($sendPush) {
            $this->sendPush($recipient, $subject, $body, $meta);
        }
    }

    /**
     * Send FCM push to all registered device tokens for this user.
     */
    private function sendPush(User $recipient, string $title, string $body, array $meta = []): void
    {
        $tokens = DeviceToken::where('user_id', $recipient->id)->pluck('token')->all();
        if (empty($tokens)) {
            return;
        }

        $fcm = app(FcmService::class);
        if (! $fcm->isConfigured()) {
            return;
        }

        $data = array_filter([
            'trigger' => $meta['trigger'] ?? '',
            'module'  => $meta['module']  ?? '',
            'url'     => $meta['url']     ?? '',
        ]);

        $fcm->sendToTokens($tokens, $title, $body, $data);
    }

    /**
     * Dispatch to multiple recipients at once.
     */
    public function dispatchToMany(
        iterable $recipients,
        string $triggerKey,
        array $vars = [],
        array $meta = [],
        bool $sendEmail = true
    ): void {
        foreach ($recipients as $recipient) {
            // Merge per-recipient name into vars
            $perVars = array_merge(['name' => $recipient->name], $vars);
            $this->dispatch($recipient, $triggerKey, $perVars, $meta, $sendEmail);
        }
    }

    // -------------------------------------------------------------------------

    private function resolveTemplate(int $tenantId, string $triggerKey): array
    {
        $stored = NotificationTemplate::where('tenant_id', $tenantId)
            ->where('trigger_key', $triggerKey)
            ->first();

        if ($stored) {
            return ['subject' => $stored->subject, 'body' => $stored->body];
        }

        return $this->defaultTemplate($triggerKey);
    }

    private function replacePlaceholders(string $text, array $vars): string
    {
        foreach ($vars as $key => $value) {
            $text = str_replace('{{' . $key . '}}', (string) ($value ?? ''), $text);
        }
        return $text;
    }

    private function defaultTemplate(string $triggerKey): array
    {
        $defaults = [
            // Travel
            'travel.submitted' => [
                'subject' => 'Travel request submitted — Action required',
                'body'    => "Dear {{name}},\n\nA travel request ({{reference}}) has been submitted by {{requester}} for approval.\n\nDestination: {{destination}}\nDeparture: {{date}}\n\nPlease review and action this request.\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.approved' => [
                'subject' => 'Your travel request has been approved',
                'body'    => "Dear {{name}},\n\nYour travel request ({{reference}}) to {{destination}} departing on {{date}} has been approved.\n\nRegards,\nSADC-PF HR",
            ],
            'travel.rejected' => [
                'subject' => 'Your travel request has been returned',
                'body'    => "Dear {{name}},\n\nYour travel request ({{reference}}) to {{destination}} has been returned with the following comment:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF HR",
            ],

            // Leave
            'leave.submitted' => [
                'subject' => 'Leave request submitted — Action required',
                'body'    => "Dear {{name}},\n\nA leave request ({{reference}}) has been submitted by {{requester}} for approval.\n\nLeave type: {{leave_type}}\nFrom: {{start_date}} to {{end_date}}\n\nPlease review and action this request.\n\nRegards,\nSADC-PF Nexus",
            ],
            'leave.approved' => [
                'subject' => 'Your leave request has been approved',
                'body'    => "Dear {{name}},\n\nYour {{leave_type}} leave from {{start_date}} to {{end_date}} has been approved.\n\nRegards,\nSADC-PF HR",
            ],
            'leave.rejected' => [
                'subject' => 'Your leave request has been returned',
                'body'    => "Dear {{name}},\n\nYour {{leave_type}} leave request ({{reference}}) from {{start_date}} to {{end_date}} has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF HR",
            ],

            // Imprest
            'imprest.submitted' => [
                'subject' => 'Imprest request submitted — Action required',
                'body'    => "Dear {{name}},\n\nAn imprest request ({{reference}}) of {{amount}} has been submitted by {{requester}} for approval.\n\nPlease review and action this request.\n\nRegards,\nSADC-PF Finance",
            ],
            'imprest.approved' => [
                'subject' => 'Your imprest request has been approved',
                'body'    => "Dear {{name}},\n\nYour imprest request ({{reference}}) of {{amount}} has been approved.\n\nPlease arrange collection with the Finance office.\n\nRegards,\nSADC-PF Finance",
            ],
            'imprest.rejected' => [
                'subject' => 'Your imprest request has been returned',
                'body'    => "Dear {{name}},\n\nYour imprest request ({{reference}}) has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Finance",
            ],
            'imprest.retirement_due' => [
                'subject' => 'Imprest retirement due — Action required',
                'body'    => "Dear {{name}},\n\nYour imprest of {{amount}} is due for retirement by {{due_date}}. Please submit your receipts to Finance.\n\nRegards,\nSADC-PF Finance",
            ],

            // Procurement
            'procurement.submitted' => [
                'subject' => 'Procurement request submitted — Action required',
                'body'    => "Dear {{name}},\n\nA procurement request ({{reference}}) has been submitted by {{requester}} for approval.\n\nDescription: {{description}}\nEstimated value: {{amount}}\n\nPlease review and action this request.\n\nRegards,\nSADC-PF Nexus",
            ],
            'procurement.approved' => [
                'subject' => 'Your procurement request has been approved',
                'body'    => "Dear {{name}},\n\nYour procurement request ({{reference}}) has been approved.\n\nPlease coordinate with the Procurement office for next steps.\n\nRegards,\nSADC-PF Procurement",
            ],
            'procurement.rejected' => [
                'subject' => 'Your procurement request has been returned',
                'body'    => "Dear {{name}},\n\nYour procurement request ({{reference}}) has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Procurement",
            ],
            'procurement.rfq_invited' => [
                'subject' => 'RFQ invitation — {{reference}}',
                'body'    => "Dear {{name}},\n\nAn RFQ matching your supplier profile is now open.\n\nReference: {{reference}}\nTitle: {{title}}\nDeadline: {{deadline}}\n\nPlease log in to the supplier portal to review the RFQ and submit your quotation.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.proforma_invoice_requested' => [
                'subject' => 'Purchase Order issued - submit proforma invoice',
                'body'    => "Dear {{name}},\n\nPurchase Order {{reference}} has been issued to {{vendor}}.\n\nAmount: {{amount}}\nExpected delivery: {{delivery_date}}\n\nPlease log in to the supplier portal and submit your proforma invoice so payment processing can begin.\n\nRegards,\nSADC-PF Procurement",
            ],

            // Supplier portal
            'supplier.application_submitted' => [
                'subject' => 'New supplier application awaiting review',
                'body'    => "Dear {{name}},\n\nA new supplier application has been submitted.\n\nSupplier: {{supplier}}\nPrimary contact: {{contact}}\n\nPlease log in to procurement and review the application.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.approved' => [
                'subject' => 'Your supplier account has been approved',
                'body'    => "Dear {{name}},\n\nYour supplier registration for {{supplier}} has been approved.\n\nYou can now log in to the supplier portal and participate in RFQs.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.rejected' => [
                'subject' => 'Your supplier application was not approved',
                'body'    => "Dear {{name}},\n\nYour supplier application for {{supplier}} was not approved.\n\nReason:\n{{comment}}\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.info_requested' => [
                'subject' => 'Additional supplier information required',
                'body'    => "Dear {{name}},\n\nProcurement has requested additional information for {{supplier}}.\n\nRequest:\n{{comment}}\n\nPlease log in to the supplier portal and update your profile.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.suspended' => [
                'subject' => 'Your supplier account has been suspended',
                'body'    => "Dear {{name}},\n\nYour supplier account for {{supplier}} has been suspended.\n\nReason:\n{{comment}}\n\nPlease contact Procurement for clarification.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.quote_submitted' => [
                'subject' => 'Supplier quote submitted â€” {{reference}}',
                'body'    => "Dear {{name}},\n\nA supplier has submitted a quotation for RFQ {{reference}}.\n\nSupplier: {{supplier}}\nTitle: {{title}}\nAmount: {{amount}}\n\nPlease log in to procurement to review the submission.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.profile_updated' => [
                'subject' => 'Supplier profile update awaiting review',
                'body'    => "Dear {{name}},\n\nA supplier profile update requires procurement review.\n\nSupplier: {{supplier}}\nPrimary contact: {{contact}}\nCategories: {{categories}}\n\nPlease log in to procurement and review the updated supplier profile.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.final_invoice_requested' => [
                'subject' => 'Payment recorded - submit final invoice documents',
                'body'    => "Dear {{name}},\n\nPayment has been recorded for purchase order {{reference}}.\n\nVendor: {{vendor}}\nAmount: {{amount}}\n\nPlease upload the final invoice and proof-of-payment supporting documents in the supplier portal.\n\nRegards,\nSADC-PF Finance",
            ],
            'supplier.final_invoice_submitted' => [
                'subject' => 'Supplier final invoice submitted - {{reference}}',
                'body'    => "Dear {{name}},\n\nThe supplier has submitted the final invoice and proof-of-payment package.\n\nReference: {{reference}}\nVendor: {{vendor}}\nAmount: {{amount}}\n\nPlease log in to procurement to review the submission.\n\nRegards,\nSADC-PF Finance",
            ],

            // Finance
            'finance.advance_due' => [
                'subject' => 'Salary advance repayment due',
                'body'    => "Dear {{name}},\n\nYour salary advance of {{amount}} has a repayment due on {{due_date}}.\n\nRegards,\nSADC-PF Finance",
            ],
            'budget.warning' => [
                'subject' => 'Budget line nearing limit',
                'body'    => "Dear {{name}},\n\nA budget line has reached 80% or more of its allocated amount.\n\n{{description}}\n\nPlease review expenditure and take corrective action if necessary.\n\nRegards,\nSADC-PF Finance",
            ],
            'budget.exceeded' => [
                'subject' => 'Budget line exceeded — immediate action required',
                'body'    => "Dear {{name}},\n\nA budget line has exceeded its allocated amount.\n\n{{description}}\n\nPlease review immediately and contact the Finance Controller.\n\nRegards,\nSADC-PF Finance",
            ],
            'finance.payment_requested' => [
                'subject' => 'Supplier payment request awaiting action - {{reference}}',
                'body'    => "Dear {{name}},\n\nA supplier has submitted a proforma invoice and payment processing is now required.\n\nInvoice reference: {{reference}}\nPurchase Order: {{po}}\nVendor: {{vendor}}\nAmount: {{amount}}\n\nPlease log in to finance and action this payment request.\n\nRegards,\nSADC-PF Procurement",
            ],

            // Assignments
            'assignment.issued' => [
                'subject' => 'New assignment: {{task_title}}',
                'body'    => "Dear {{name}},\n\nYou have been assigned a new task by {{issuer}}.\n\nReference: {{reference}}\nTask: {{task_title}}\nDue date: {{due_date}}\n\n{{description}}\n\nPlease log in to accept or query this assignment.\n\nRegards,\nSADC-PF Nexus",
            ],
            'assignment.accepted' => [
                'subject' => 'Assignment response received — {{task_title}}',
                'body'    => "Dear {{name}},\n\n{{assignee}} has responded to assignment {{reference}} ({{task_title}}) with decision: {{decision}}.\n\n{{notes}}\n\nRegards,\nSADC-PF Nexus",
            ],
            'assignment.completed' => [
                'subject' => 'Assignment completed — {{task_title}}',
                'body'    => "Dear {{name}},\n\n{{assignee}} has submitted assignment {{reference}} ({{task_title}}) for closure.\n\n{{notes}}\n\nPlease review and close or return the assignment.\n\nRegards,\nSADC-PF Nexus",
            ],
            'assignment.returned' => [
                'subject' => 'Assignment returned for further work — {{task_title}}',
                'body'    => "Dear {{name}},\n\nAssignment {{reference}} ({{task_title}}) has been returned by {{issuer}} for further work.\n\nReason: {{reason}}\n\nPlease address the feedback and resubmit.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Risk Register
            'risk.submitted' => [
                'subject' => 'Risk submitted for review — {{risk_code}}',
                'body'    => "Dear {{name}},\n\nA risk has been submitted for review by {{submitter}}.\n\nRisk Code: {{risk_code}}\nTitle: {{title}}\nCategory: {{category}}\nLevel: {{level}}\n\nPlease log in to review this risk.\n\nRegards,\nSADC-PF Nexus",
            ],
            'risk.approved' => [
                'subject' => 'Your risk has been approved — {{risk_code}}',
                'body'    => "Dear {{name}},\n\nYour risk ({{risk_code}}: {{title}}) has been approved by {{approved_by}}.\n\nRegards,\nSADC-PF Nexus",
            ],
            'risk.escalated' => [
                'subject' => 'Risk escalated — {{risk_code}} requires attention',
                'body'    => "Dear {{name}},\n\nA risk has been escalated to level {{level}} by {{actor}}.\n\nRisk Code: {{risk_code}}\nTitle: {{title}}\n\n{{notes}}\n\nPlease log in to review.\n\nRegards,\nSADC-PF Nexus",
            ],

            // SRHR / Field Researchers
            'srhr.deployment.started' => [
                'subject' => 'Field deployment confirmed — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour field deployment has been confirmed.\n\nReference: {{reference}}\nParliament: {{parliament}}\nStart date: {{start_date}}\n\nPlease liaise with your supervisor and submit monthly reports through the SRHR portal.\n\nRegards,\nSADC-PF HR",
            ],
            'srhr.deployment.recalled' => [
                'subject' => 'Your field deployment has been recalled — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour field deployment ({{reference}}) has been recalled with the following reason:\n\n{{reason}}\n\nPlease contact HR for further instructions.\n\nRegards,\nSADC-PF HR",
            ],
            'srhr.report.submitted' => [
                'subject' => 'Field researcher report submitted — Action required',
                'body'    => "Dear {{name}},\n\nA field researcher report ({{reference}}) has been submitted and requires your acknowledgement.\n\nResearcher: {{employee}}\nReport title: {{title}}\nPeriod: {{period}}\n\nPlease log in to review and acknowledge this report.\n\nRegards,\nSADC-PF Nexus",
            ],
            'srhr.report.acknowledged' => [
                'subject' => 'Your report has been acknowledged — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour field researcher report ({{reference}}) — \"{{title}}\" — has been acknowledged.\n\nThank you for your submission.\n\nRegards,\nSADC-PF HR",
            ],
            'srhr.report.revision_requested' => [
                'subject' => 'Revision requested on your report — {{reference}}',
                'body'    => "Dear {{name}},\n\nA revision has been requested on your report ({{reference}}) — \"{{title}}\".\n\nReviewer notes:\n{{notes}}\n\nPlease update and resubmit your report.\n\nRegards,\nSADC-PF HR",
            ],

            // Workflow — approver step assignment (sent with email action buttons)
            'workflow.approval_required' => [
                'subject' => 'Action required: {{module_label}} request {{reference}} pending your approval',
                'body'    => "Dear {{name}},\n\nA {{module_label}} request ({{reference}}) submitted by {{requester}} is awaiting your approval.\n\n{{summary}}\n\nPlease use the buttons below to approve or return this request, or log in to the portal to review the full details.\n\nThis action link expires in 72 hours.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Workflow — final outcome notification (sent to HR/Directors after full approval)
            'workflow.completed' => [
                'subject' => '{{module_label}} request {{reference}} has been {{status}}',
                'body'    => "Dear {{name}},\n\nThe {{module_label}} request ({{reference}}) submitted by {{requester}} has been {{status}} by {{approved_by}}.\n\nThis notification is for your records.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Salary advance
            'salary_advance.approved' => [
                'subject' => 'Your salary advance request has been approved',
                'body'    => "Dear {{name}},\n\nYour salary advance request ({{reference}}) of {{amount}} has been approved.\n\nPlease coordinate with the Finance office for disbursement arrangements.\n\nRegards,\nSADC-PF Finance",
            ],
            'salary_advance.rejected' => [
                'subject' => 'Your salary advance request has been returned',
                'body'    => "Dear {{name}},\n\nYour salary advance request ({{reference}}) has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Finance",
            ],
            'salary_advance.submitted' => [
                'subject' => 'Salary advance request submitted — Action required',
                'body'    => "Dear {{name}},\n\nA salary advance request ({{reference}}) of {{amount}} has been submitted by {{requester}} for approval.\n\nPlease review and action this request.\n\nRegards,\nSADC-PF Finance",
            ],

            // Generic rejection fallback
            'request.rejected' => [
                'subject' => 'Your request has been returned',
                'body'    => "Dear {{name}},\n\nYour {{module}} request has been returned with the following comment:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Nexus",
            ],
            'hr.task_assigned' => [
                'subject' => 'New task assigned to you',
                'body'    => "Dear {{name}},\n\nYou have been assigned a new task: {{task_title}}.\nDue date: {{due_date}}\n\nRegards,\nSADC-PF Nexus",
            ],

            // User management
            'user.welcome' => [
                'subject' => 'Welcome to SADC-PF Nexus — Your account is ready',
                'body'    => "Dear {{name}},\n\nYour SADC-PF Nexus account has been created.\n\nEmail: {{email}}\nTemporary password: {{password}}\nRole: {{role}}\n\nPlease log in at {{portal_url}} and change your password immediately.\n\nRegards,\nSADC-PF Nexus Administrator",
            ],

            // Daily alert digest (sent to managers/admins)
            'alerts.daily_digest' => [
                'subject' => 'SADC-PF Nexus — Daily Alerts Digest ({{date}})',
                'body'    => "Dear {{name}},\n\nYour daily alert digest for {{date}}:\n\n{{digest}}\n\nLog in at {{portal_url}} for full details.\n\nRegards,\nSADC-PF Nexus",
            ],
        ];

        return $defaults[$triggerKey] ?? [
            'subject' => 'Notification from SADC-PF Nexus',
            'body'    => "Dear {{name}},\n\nYou have a new notification.\n\nRegards,\nSADC-PF Nexus",
        ];
    }
}
