<?php

namespace App\Services;

use App\Models\NotificationTemplate;
use App\Models\User;
use App\Modules\Notifications\Services\NotificationDispatchService;

/**
 * Compatibility facade for module producers.
 * Phase 1+: all business notifications publish through the Notifications outbox engine.
 * Direct Mail:: calls from business modules are forbidden — use dispatch / dispatchExternal / dispatchTrackedMailable.
 */
class NotificationService
{
    /**
     * Dispatch an in-app notification and (optionally) an email to a user.
     */
    public function dispatch(
        User $recipient,
        string $triggerKey,
        array $vars = [],
        array $meta = [],
        bool $sendEmail = true,
        bool $sendPush = true,
        ?string $idempotencyKey = null,
    ): void {
        app(NotificationDispatchService::class)->dispatchLegacy(
            $recipient,
            $triggerKey,
            $vars,
            $meta,
            $sendEmail,
            $sendPush,
            $idempotencyKey ?? ($meta['idempotency_key'] ?? null),
        );
    }

    /**
     * Alias used by People & Authority and other callers.
     */
    public function notifyUser(
        User $recipient,
        string $triggerKey,
        array $vars = [],
        array $meta = [],
    ): void {
        $meta = array_merge(['module' => $vars['module'] ?? ($meta['module'] ?? null)], $meta);
        unset($vars['module']);
        $this->dispatch($recipient, $triggerKey, $vars, array_filter($meta), true, true);
    }

    /**
     * Dispatch to an external email address (vendor contact, RFQ invitee, etc.).
     */
    public function dispatchExternal(
        int $tenantId,
        string $email,
        string $name,
        string $triggerKey,
        array $vars = [],
        array $meta = [],
        ?string $idempotencyKey = null,
    ): void {
        app(NotificationDispatchService::class)->dispatchExternal(
            $tenantId,
            $email,
            $name,
            $triggerKey,
            $vars,
            $meta,
            $idempotencyKey ?? ($meta['idempotency_key'] ?? null),
        );
    }

    /**
     * Track + queue a specialized Mailable (weekly summary / correspondence) via the outbox ledger.
     */
    public function dispatchTrackedMailable(
        int $tenantId,
        string $triggerKey,
        string $email,
        string $name,
        \Illuminate\Mail\Mailable $mailable,
        array $meta = [],
        ?User $user = null,
        ?string $idempotencyKey = null,
        ?string $subject = null,
    ): void {
        app(NotificationDispatchService::class)->dispatchTrackedMailable(
            $tenantId,
            $triggerKey,
            $email,
            $name,
            $mailable,
            $meta,
            $user,
            $idempotencyKey ?? ($meta['idempotency_key'] ?? null),
            $subject,
        );
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
            $perVars = array_merge(['name' => $recipient->name], $vars);
            $perMeta = $meta;
            if (isset($meta['idempotency_key'])) {
                $perMeta['idempotency_key'] = $meta['idempotency_key'].':user:'.$recipient->id;
            }
            $this->dispatch($recipient, $triggerKey, $perVars, $perMeta, $sendEmail);
        }
    }

    public function resolveTemplate(int $tenantId, string $triggerKey): array
    {
        $stored = NotificationTemplate::where('tenant_id', $tenantId)
            ->where('trigger_key', $triggerKey)
            ->first();

        if ($stored) {
            return ['subject' => $stored->subject, 'body' => $stored->body];
        }

        return $this->defaultTemplate($triggerKey);
    }

    public function replacePlaceholders(string $text, array $vars): string
    {
        foreach ($vars as $key => $value) {
            $text = str_replace('{{' . $key . '}}', (string) ($value ?? ''), $text);
        }
        return $text;
    }

    public function defaultTemplate(string $triggerKey): array
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
            'travel.director_finance_confirmed' => [
                'subject' => 'Travel funds confirmed — SG action',
                'body'    => "Dear {{name}},\n\nDirector Finance has confirmed funds for travel {{reference}} ({{destination}}). Please proceed with final approval.\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.booked' => [
                'subject' => 'Travel bookings committed',
                'body'    => "Dear {{name}},\n\nBookings have been committed for your travel request {{reference}}.\n\nRegards,\nSADC-PF Administration",
            ],
            'travel.returned' => [
                'subject' => 'Travel marked returned — retirement due',
                'body'    => "Dear {{name}},\n\nYour mission {{reference}} has been marked returned. Please complete retirement by {{due_date}} (mission report required).\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.toil_candidate' => [
                'subject' => 'Potential TOIL from travel',
                'body'    => "Dear {{name}},\n\nTOIL candidates were calculated for travel {{reference}} ({{count}} day(s)). Leave credit is applied only after your supervisor confirms duty and HR validates entitlement. Use within 30 days unless the Secretary General extends.\n\nRegards,\nSADC-PF HR",
            ],
            'travel.toil_approval_required' => [
                'subject' => 'TOIL approval required — {{reference}}',
                'body'    => "Dear {{name}},\n\n{{count}} TOIL candidate day(s) were auto-calculated for {{traveller}} on travel {{reference}}. Please confirm actual duty (supervisor) and validate entitlement/OT rules (HR) in Nexus. Leave is NOT credited until both approvals complete.\n\nOpen: /travel/toil\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.toil_hr_validation_required' => [
                'subject' => 'TOIL HR validation required — {{reference}}',
                'body'    => "Dear {{name}},\n\nSupervisor confirmed duty for TOIL on {{date}} ({{hours}}h) for {{traveller}} (travel {{reference}}). Please validate entitlement / OT rules. Leave credit is applied only after your approval.\n\nOpen: /travel/toil\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.toil_credited' => [
                'subject' => 'TOIL credited — {{reference}}',
                'body'    => "Dear {{name}},\n\nHR has credited {{hours}}h TOIL from travel {{reference}}. Expiry: {{expires_at}} (normally 30 days from accrual date unless SG extends).\n\nRegards,\nSADC-PF HR",
            ],
            'travel.visa_reminder' => [
                'subject' => 'Travel visa reminder — {{reference}}',
                'body'    => "Dear {{name}},\n\nVisa follow-up is required for travel {{reference}} to {{destination}}.\n\nStatus: {{visa_status}}\nAppointment: {{appointment_date}}\nExpiry: {{expiry_date}}\nReason: {{reason}}\n\nPlease update visa progress in Nexus.\n\nRegards,\nSADC-PF Administration",
            ],
            'travel.finance_dsa_calculated' => [
                'subject' => 'Finance DSA calculated — {{reference}}',
                'body'    => "Dear {{name}},\n\nFinance has calculated DSA for travel {{reference}}.\n\nPayable: {{amount}}\n\nRegards,\nSADC-PF Finance",
            ],
            'travel.retirement_due' => [
                'subject' => 'Travel retirement due — {{reference}}',
                'body'    => "Dear {{name}},\n\nRetirement for mission {{reference}} is due by {{due_date}}. Please submit your mission report and complete retirement.\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.retirement_overdue' => [
                'subject' => 'Travel retirement OVERDUE — {{reference}}',
                'body'    => "Dear {{name}},\n\nRetirement for mission {{reference}} is overdue (due {{due_date}}). Please complete retirement immediately.\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.cancelled' => [
                'subject' => 'Travel request cancelled — {{reference}}',
                'body'    => "Dear {{name}},\n\nTravel request {{reference}} has been cancelled.\n\nReason: {{comment}}\n\nRegards,\nSADC-PF Nexus",
            ],
            'travel.returned_for_correction' => [
                'subject' => 'Travel request returned for correction — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour travel request {{reference}} was returned for correction:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Audit Management — privacy-safe (no confidential detail in subject/body)
            'audit.engagement_notified' => [
                'subject' => 'Audit engagement update',
                'body'    => "Dear {{name}},\n\nAn audit engagement requires your attention. Sign in to Nexus to view details.\n\nRegards,\nSADC-PF Internal Audit",
            ],
            'audit.evidence_requested' => [
                'subject' => 'Audit evidence request',
                'body'    => "Dear {{name}},\n\nAn evidence request has been issued. Sign in to Nexus to respond.\n\nRegards,\nSADC-PF Internal Audit",
            ],
            'audit.finding_issued' => [
                'subject' => 'Audit finding requires response',
                'body'    => "Dear {{name}},\n\nAn audit finding requires a management response. Sign in to Nexus for details.\n\nRegards,\nSADC-PF Internal Audit",
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

            'leave.toil_expiry_alert' => [
                'subject' => 'TOIL {{reference}} expires in {{days}} day(s)',
                'body'    => "Dear {{name}},\n\nYour TOIL credit {{reference}} has {{remaining}} day(s) remaining and expires on {{expiry_date}}. It must normally be taken within 30 days unless the Secretary General authorises an extension.\n\nRegards,\nSADC-PF HR",
            ],
            'leave.toil_extended' => [
                'subject' => 'TOIL extension approved - {{reference}}',
                'body'    => "Dear {{name}},\n\nThe Secretary General has extended TOIL credit {{reference}} to {{expiry_date}}.\n\nRegards,\nSADC-PF HR",
            ],

            // Correspondence deadlines
            'correspondence.deadline_overdue' => [
                'subject' => 'Correspondence deadline overdue — {{reference}}',
                'body'    => "Dear {{name}},\n\nCorrespondence {{reference}} ({{subject}}) is overdue.\n\nDeadline: {{deadline}}\nDays overdue: {{days_overdue}}\n\nPlease action or update the register.\n\nRegards,\nSADC-PF Nexus",
            ],
            'correspondence.deadline_escalated' => [
                'subject' => 'Escalation: correspondence overdue — {{reference}}',
                'body'    => "Dear {{name}},\n\nCorrespondence {{reference}} ({{subject}}) has been overdue for {{days_overdue}} day(s) and is escalated for management attention.\n\nDeadline: {{deadline}}\n\nPlease intervene or reassign ownership.\n\nRegards,\nSADC-PF Nexus",
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
            'procurement.lpo_approved' => [
                'subject' => 'LPO {{reference}} has been approved',
                'body'    => "Dear {{name}},\n\nLocal Purchase Order {{reference}} has been approved.\n\nRegards,\nSADC-PF Procurement",
            ],
            'procurement.lpo_issued_external' => [
                'subject' => 'SADC Parliamentary Forum — Local Purchase Order {{reference}}',
                'body'    => "Dear {{name}},\n\nPlease find Local Purchase Order {{reference}} ({{amount}}).\n\nRegards,\nSADC Parliamentary Forum Procurement",
            ],
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
            'procurement.rfq_external_invite' => [
                'subject' => 'RFQ Invitation — {{reference}}',
                'body'    => "Dear {{name}},\n\nYou have been invited to submit a quotation for {{title}}.\n\nPlease use the secure link in Nexus (or the registration link below) to submit your quote before the deadline.\n\nWe strongly encourage you to register as a supplier on SADC-PF Nexus to view the full RFQ, receive future supplier notifications, and manage your submissions in one place.\n\nSupplier registration: {{register_url}}\nQuote link: {{quote_url}}\n\nRegards,\nSADC-PF Procurement",
            ],
            'procurement.rfq_vendor_contact' => [
                'subject' => 'RFQ Invitation — {{reference}}',
                'body'    => "Dear {{name}},\n\nAn RFQ matching your supplier categories is available in the SADC-PF supplier portal.\n\nTitle: {{title}}\nDeadline: {{deadline}}\nPortal: {{portal_url}}\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.proforma_invoice_requested' => [
                'subject' => 'Purchase Order issued - submit proforma invoice',
                'body'    => "Dear {{name}},\n\nPurchase Order {{reference}} has been issued to {{vendor}}.\n\nAmount: {{amount}}\nExpected delivery: {{delivery_date}}\n\nPlease log in to the supplier portal and submit your proforma invoice so payment processing can begin.\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.proforma_invoice_requested_external' => [
                'subject' => 'Purchase Order issued - {{reference}}',
                'body'    => "Dear {{name}},\n\nPurchase Order {{reference}} has been issued to {{vendor}}.\n\nPlease log in to the supplier portal and submit your proforma invoice so payment processing can begin.\n\nAmount: {{amount}}\nExpected delivery: {{delivery_date}}\nPortal: {{portal_url}}\n\nRegards,\nSADC-PF Procurement",
            ],
            'supplier.final_invoice_requested_external' => [
                'subject' => 'Payment recorded - submit final invoice documents',
                'body'    => "Dear {{name}},\n\nPayment has been recorded against purchase order {{reference}}.\n\nPlease upload the final invoice and proof-of-payment supporting documents in the supplier portal.\n\nAmount: {{amount}}\nPortal: {{portal_url}}\n\nRegards,\nSADC-PF Finance",
            ],
            'weekly_summary.generated' => [
                'subject' => 'SADCPFNexus Weekly Summary — {{period}}',
                'body'    => "Dear {{name}},\n\nYour weekly summary for {{period}} is ready. Sign in to Nexus for the full report.\n\nRegards,\nSADC-PF Nexus",
            ],
            'correspondence.outbound_mail' => [
                'subject' => '{{subject}}',
                'body'    => "Dear {{name}},\n\nCorrespondence has been sent to you. Please see the attached letter or sign in to Nexus if you have an account.\n\nRegards,\nSADC-PF Nexus",
            ],
            'notifications.template_test' => [
                'subject' => '[TEST] {{subject}}',
                'body'    => "{{body}}",
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
            'risk.kri_breached' => [
                'subject' => 'KRI breach — {{kri_code}}',
                'body'    => "Dear {{name}},\n\nKey Risk Indicator {{kri_code}} ({{kri_name}}) has breached its threshold.\n\nCurrent value: {{value}} {{unit}}\nBreach threshold: {{threshold}}\n\nPlease review the KRI dashboard.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Meeting Resolutions / Decision Register
            'decision.adopted' => [
                'subject' => 'Decision adopted — {{reference}}',
                'body'    => "Dear {{name}},\n\nDecision {{reference}} ({{title}}) has been adopted by {{adopter}}.\n\nPlease log in to review implementation responsibilities.\n\nRegards,\nSADC-PF Nexus",
            ],
            'decision.assigned' => [
                'subject' => 'Decision follow-up assigned — {{reference}}',
                'body'    => "Dear {{name}},\n\nYou have been assigned a follow-up for decision {{reference}} ({{title}}).\n\nDue date: {{due_date}}\n\nPlease log in to review.\n\nRegards,\nSADC-PF Nexus",
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
                'body'    => "Dear {{name}},\n\nA {{module_label}} request ({{reference}}) submitted by {{requester}} is awaiting your approval.\n\n{{summary}}\n\nSign in to Nexus to review and action this request. Email links never approve or reject on their own.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Workflow — final outcome notification (sent to HR/Directors after full approval)
            'workflow.completed' => [
                'subject' => '{{module_label}} request {{reference}} has been {{status}}',
                'body'    => "Dear {{name}},\n\nThe {{module_label}} request ({{reference}}) submitted by {{requester}} has been {{status}} by {{approved_by}}.\n\nThis notification is for your records.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Workflow — returned for correction (sent to requester)
            'workflow.returned' => [
                'subject' => 'Your {{module_label}} request {{reference}} has been returned for correction',
                'body'    => "Dear {{name}},\n\nYour {{module_label}} request ({{reference}}) has been returned for correction with the following instructions:\n\n{{comment}}\n\nPlease make the necessary corrections and resubmit.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Delegated authority lifecycle (WS1 — PRD §7.4)
            'delegation.activated' => [
                'subject' => 'Delegated authority activated — {{principal}}',
                'body'    => "Dear {{name}},\n\nYou have been granted delegated authority to act on behalf of {{principal}} for {{module}} from {{start_date}} to {{end_date}}.\n\nActions you take under this delegation are recorded as \"prepared on behalf of {{principal}}\". You are NOT logged in as {{principal}}.\n\nRegards,\nSADC-PF Nexus",
            ],
            'delegation.expired' => [
                'subject' => 'Delegated authority expired — {{principal}}',
                'body'    => "Dear {{name}},\n\nYour delegated authority to act on behalf of {{principal}} for {{module}} expired on {{end_date}}.\n\nYou can no longer prepare or submit requests on their behalf.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Programmes / PIF → M&E handoff
            'programme.approved_for_me' => [
                'subject' => 'Your PIF is approved — ready for M&E reporting',
                'body'    => "Dear {{name}},\n\nYour approved PIF ({{reference}}) \"{{title}}\" is now ready for post-activity reporting in the M&E module once the activity is implemented.\n\nRegards,\nSADC-PF Nexus",
            ],
            'programme.me_intake_available' => [
                'subject' => 'A new approved PIF is available for M&E linkage',
                'body'    => "Dear {{name}},\n\nA newly approved PIF ({{reference}}) \"{{title}}\" is available in the M&E PIF-linkages queue for reporting setup.\n\nRegards,\nSADC-PF Nexus",
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
                'body'    => "Dear {{name}},\n\nYour SADC-PF Nexus account has been created.\n\nEmail: {{email}}\nRole: {{role}}\n\nUse the invitation or password-reset link sent separately to register your own password. Nexus will never email you a password.\n\nRegards,\nSADC-PF Nexus Administrator",
            ],
            'user.invited' => [
                'subject' => 'Activate your SADC-PF Nexus account',
                'body'    => "Dear {{name}},\n\nYou have been invited to SADC-PF Nexus.\n\nEmail: {{email}}\nRole: {{role}}\n\nActivate your account and register your password here:\n{{activation_url}}\n\nThis invitation expires on {{expires_at}}. Nexus will never email you a password.\n\nRegards,\nSADC-PF Nexus Administrator",
            ],
            'user.security_reset_link' => [
                'subject' => 'SADC-PF Nexus password reset link sent',
                'body'    => "Dear {{name}},\n\nA password reset link has been sent for your SADC-PF Nexus account. If you did not request this, contact the System Administrator immediately.\n\nRegards,\nSADC-PF Nexus Administrator",
            ],
            'user.mfa_reset' => [
                'subject' => 'SADC-PF Nexus MFA reset',
                'body'    => "Dear {{name}},\n\nMulti-factor authentication was reset for your SADC-PF Nexus account by an authorised administrator. You must enroll MFA again where policy requires it.\n\nIf you did not expect this change, contact the System Administrator immediately.\n\nRegards,\nSADC-PF Nexus Administrator",
            ],
            'user.sessions_revoked' => [
                'subject' => 'SADC-PF Nexus sessions revoked',
                'body'    => "Dear {{name}},\n\nYour active Nexus sessions were revoked by an authorised administrator. Sign in again if you still have approved access.\n\nRegards,\nSADC-PF Nexus Administrator",
            ],

            // BCRE — Balance Control & Reconciliation Engine
            'bcre.register_created' => [
                'subject' => 'Balance register opened — {{reference}}',
                'body'    => "Dear {{name}},\n\nA balance register ({{reference}}) has been opened for your {{module_label}} of {{amount}}.\n\nPlease log in to review your balance and confirm the opening balance when prompted.\n\nRegards,\nSADC-PF Finance",
            ],
            'bcre.balance_updated' => [
                'subject' => 'Balance register updated — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour balance register ({{reference}}) has been updated.\n\nTransaction type: {{type}}\nAmount: {{amount}}\nNew balance: {{new_balance}}\n\nPlease log in to confirm or dispute this update.\n\nRegards,\nSADC-PF Finance",
            ],
            'bcre.verification_required' => [
                'subject' => 'Balance update requires verification — {{reference}}',
                'body'    => "Dear {{name}},\n\nA balance update on register {{reference}} has been submitted by {{maker}} and requires your verification.\n\nTransaction type: {{type}}\nAmount: {{amount}}\n\nPlease log in to approve or reject this update.\n\nRegards,\nSADC-PF Finance",
            ],
            'bcre.transaction_verified' => [
                'subject' => 'Your balance update has been {{status}} — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour balance update on register {{reference}} has been {{status}} by {{checker}}.\n\n{{comments}}\n\nRegards,\nSADC-PF Finance",
            ],
            'bcre.balance_disputed' => [
                'subject' => 'Balance dispute raised — {{reference}}',
                'body'    => "Dear {{name}},\n\nAn employee has raised a dispute on balance register {{reference}}.\n\nEmployee: {{employee}}\nReason: {{reason}}\n\nPlease log in to review and resolve the dispute.\n\nRegards,\nSADC-PF Finance",
            ],
            'bcre.period_locked' => [
                'subject' => 'Balance register period locked — {{reference}}',
                'body'    => "Dear {{name}},\n\nBalance register {{reference}} has been locked for the current period by {{controller}}.\n\nNo further updates can be made until the period is unlocked.\n\nRegards,\nSADC-PF Finance",
            ],

            // Weekly Summary Reports (operational)
            'weekly_report.submitted' => [
                'subject' => 'Weekly summary submitted — {{reference}}',
                'body'    => "Dear {{name}},\n\n{{employee}} has submitted weekly summary {{reference}} for your review.\n\nRegards,\nSADC-PF Nexus",
            ],
            'weekly_report.returned' => [
                'subject' => 'Weekly summary returned — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour weekly summary {{reference}} has been returned for correction. Please revise and resubmit.\n\nRegards,\nSADC-PF Nexus",
            ],
            'weekly_report.accepted' => [
                'subject' => 'Weekly summary accepted — {{reference}}',
                'body'    => "Dear {{name}},\n\nYour weekly summary {{reference}} has been accepted.\n\nRegards,\nSADC-PF Nexus",
            ],
            'weekly_report.missing' => [
                'subject' => 'Weekly summary outstanding',
                'body'    => "Dear {{name}},\n\nYour weekly summary for the current reporting period has not yet been submitted.\n\nRegards,\nSADC-PF Nexus",
            ],

            // Consumables / Stock
            'stock.low_stock' => [
                'subject' => 'Low stock alert — {{item_code}}',
                'body'    => "Dear {{name}},\n\nStock item {{item_name}} ({{item_code}}) has fallen to {{balance}} unit(s), at or below the reorder level of {{reorder_level}}.\n\nRecorded by: {{actor}}\n\nPlease review replenishment needs in the Consumables / Stock register.\n\nRegards,\nSADC-PF Nexus",
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
