<?php

namespace App\Services;

use App\Mail\ModuleNotificationMail;
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
        bool $sendEmail = true
    ): void {
        $template = $this->resolveTemplate($recipient->tenant_id, $triggerKey);
        $subject  = $this->replacePlaceholders($template['subject'], $vars);
        $body     = $this->replacePlaceholders($template['body'], $vars);

        // Store in-app notification (Laravel DB notifications channel)
        $recipient->notifications()->create([
            'id'   => \Illuminate\Support\Str::uuid(),
            'type' => 'App\\Notifications\\ModuleNotification',
            'data' => json_encode([
                'trigger_key' => $triggerKey,
                'subject'     => $subject,
                'body'        => $body,
                'meta'        => $meta,
            ]),
        ]);

        // Queue email
        if ($sendEmail && filter_var($recipient->email, FILTER_VALIDATE_EMAIL)) {
            $approveUrl = $meta['approve_url'] ?? null;
            $rejectUrl  = $meta['reject_url']  ?? null;

            Mail::to($recipient->email)
                ->queue(new ModuleNotificationMail($subject, $body, $recipient->name, $approveUrl, $rejectUrl));
        }
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

            // Assignments
            'assignment.issued' => [
                'subject' => 'New task assigned to you',
                'body'    => "Dear {{name}},\n\nYou have been assigned a new task: {{task_title}}\nDue date: {{due_date}}\n\n{{description}}\n\nRegards,\nSADC-PF Nexus",
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
        ];

        return $defaults[$triggerKey] ?? [
            'subject' => 'Notification from SADC-PF Nexus',
            'body'    => "Dear {{name}},\n\nYou have a new notification.\n\nRegards,\nSADC-PF Nexus",
        ];
    }
}
