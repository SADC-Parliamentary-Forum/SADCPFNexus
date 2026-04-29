<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\ModuleNotificationMail;
use App\Models\NotificationTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class NotificationTemplateController extends Controller
{
    private array $defaults = [
        // Travel
        ['name' => 'Travel Submitted (Approver)',  'trigger_key' => 'travel.submitted',          'subject' => 'Travel request submitted — Action required',          'body' => "Dear {{name}},\n\nA travel request ({{reference}}) has been submitted by {{requester}} for your approval.\n\nDestination: {{destination}}\nDeparture: {{date}}\n\nPlease log in to review and action this request.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Travel Approved',              'trigger_key' => 'travel.approved',            'subject' => 'Your travel request has been approved',                'body' => "Dear {{name}},\n\nYour travel request ({{reference}}) to {{destination}} departing on {{date}} has been approved.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Travel Rejected',              'trigger_key' => 'travel.rejected',            'subject' => 'Your travel request has been returned',                'body' => "Dear {{name}},\n\nYour travel request ({{reference}}) to {{destination}} has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF HR"],

        // Leave
        ['name' => 'Leave Submitted (Approver)',   'trigger_key' => 'leave.submitted',            'subject' => 'Leave request submitted — Action required',            'body' => "Dear {{name}},\n\nA leave request ({{reference}}) has been submitted by {{requester}} for your approval.\n\nLeave type: {{leave_type}}\nFrom: {{start_date}} to {{end_date}}\n\nPlease log in to review and action this request.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Leave Approved',               'trigger_key' => 'leave.approved',             'subject' => 'Your leave request has been approved',                 'body' => "Dear {{name}},\n\nYour {{leave_type}} leave from {{start_date}} to {{end_date}} has been approved.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Leave Rejected',               'trigger_key' => 'leave.rejected',             'subject' => 'Your leave request has been returned',                 'body' => "Dear {{name}},\n\nYour {{leave_type}} leave request ({{reference}}) has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF HR"],

        // Imprest
        ['name' => 'Imprest Submitted (Approver)', 'trigger_key' => 'imprest.submitted',          'subject' => 'Imprest request submitted — Action required',          'body' => "Dear {{name}},\n\nAn imprest request ({{reference}}) of {{amount}} has been submitted by {{requester}} for your approval.\n\nPlease log in to review and action this request.\n\nRegards,\nSADC-PF Finance"],
        ['name' => 'Imprest Approved',             'trigger_key' => 'imprest.approved',           'subject' => 'Your imprest request has been approved',               'body' => "Dear {{name}},\n\nYour imprest request ({{reference}}) of {{amount}} has been approved.\n\nPlease arrange collection with the Finance office.\n\nRegards,\nSADC-PF Finance"],
        ['name' => 'Imprest Rejected',             'trigger_key' => 'imprest.rejected',           'subject' => 'Your imprest request has been returned',               'body' => "Dear {{name}},\n\nYour imprest request ({{reference}}) has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Finance"],
        ['name' => 'Imprest Retirement Due',       'trigger_key' => 'imprest.retirement_due',     'subject' => 'Imprest retirement due — Action required',             'body' => "Dear {{name}},\n\nYour imprest of {{amount}} is due for retirement by {{due_date}}. Please submit your receipts to the Finance office.\n\nRegards,\nSADC-PF Finance"],

        // Procurement
        ['name' => 'Procurement Submitted',        'trigger_key' => 'procurement.submitted',      'subject' => 'Procurement request submitted — Action required',      'body' => "Dear {{name}},\n\nA procurement request ({{reference}}) has been submitted by {{requester}} for your approval.\n\nDescription: {{description}}\nEstimated value: {{amount}}\n\nPlease log in to review and action this request.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Procurement Approved',         'trigger_key' => 'procurement.approved',       'subject' => 'Your procurement request has been approved',           'body' => "Dear {{name}},\n\nYour procurement request ({{reference}}) has been approved.\n\nPlease coordinate with the Procurement office for next steps.\n\nRegards,\nSADC-PF Procurement"],
        ['name' => 'Procurement Rejected',         'trigger_key' => 'procurement.rejected',       'subject' => 'Your procurement request has been returned',           'body' => "Dear {{name}},\n\nYour procurement request ({{reference}}) has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Procurement"],
        ['name' => 'Procurement Awarded',          'trigger_key' => 'procurement.awarded',        'subject' => 'Contract awarded — {{reference}}',                     'body' => "Dear {{name}},\n\nYour procurement request ({{reference}}) has been awarded to {{vendor}} for {{amount}}.\n\nA Purchase Order will be issued shortly.\n\nRegards,\nSADC-PF Procurement"],
        ['name' => 'Purchase Order Issued',        'trigger_key' => 'procurement.po_issued',      'subject' => 'Purchase Order issued — {{reference}}',                'body' => "Dear {{name}},\n\nPurchase Order {{reference}} has been issued.\n\nVendor: {{vendor}}\nTotal: {{amount}}\nExpected delivery: {{delivery_date}}\n\nRegards,\nSADC-PF Procurement"],
        ['name' => 'Goods Receipt Recorded',       'trigger_key' => 'procurement.grn_recorded',   'subject' => 'Goods receipt recorded — {{reference}}',               'body' => "Dear {{name}},\n\nGoods receipt {{reference}} has been recorded against PO {{po_reference}}.\n\nPlease review and accept or reject the receipt.\n\nRegards,\nSADC-PF Procurement"],
        ['name' => 'Invoice Received',             'trigger_key' => 'procurement.invoice_received','subject' => 'Invoice received for review — {{reference}}',          'body' => "Dear {{name}},\n\nInvoice {{reference}} has been received and requires your review.\n\nVendor: {{vendor}}\nAmount: {{amount}}\nMatch status: {{match_status}}\n\nPlease log in to approve or reject.\n\nRegards,\nSADC-PF Finance"],
        ['name' => 'Invoice Approved',             'trigger_key' => 'procurement.invoice_approved','subject' => 'Invoice approved for payment — {{reference}}',         'body' => "Dear {{name}},\n\nInvoice {{reference}} for {{amount}} has been approved and has been forwarded for payment processing.\n\nRegards,\nSADC-PF Finance"],

        // Finance
        ['name' => 'Salary Advance Due',           'trigger_key' => 'finance.advance_due',        'subject' => 'Salary advance repayment due',                         'body' => "Dear {{name}},\n\nYour salary advance of {{amount}} has a repayment due on {{due_date}}.\n\nRegards,\nSADC-PF Finance"],
        ['name' => 'Budget Line Warning (80%)',    'trigger_key' => 'budget.warning',             'subject' => 'Budget line nearing limit',                            'body' => "Dear {{name}},\n\nA budget line has reached 80% or more of its allocated amount.\n\n{{description}}\n\nPlease review expenditure and take corrective action if necessary.\n\nRegards,\nSADC-PF Finance"],
        ['name' => 'Budget Line Exceeded',         'trigger_key' => 'budget.exceeded',            'subject' => 'Budget line exceeded — immediate action required',     'body' => "Dear {{name}},\n\nA budget line has exceeded its allocated amount.\n\n{{description}}\n\nPlease review immediately and contact the Finance Controller.\n\nRegards,\nSADC-PF Finance"],

        // Assignments / HR
        ['name' => 'Assignment Issued',            'trigger_key' => 'assignment.issued',          'subject' => 'New assignment: {{task_title}}',                        'body' => "Dear {{name}},\n\nYou have been assigned a new task by {{issuer}}.\n\nReference: {{reference}}\nTask: {{task_title}}\nDue date: {{due_date}}\n\n{{description}}\n\nPlease log in to accept or query this assignment.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Assignment Response',          'trigger_key' => 'assignment.accepted',        'subject' => 'Assignment response received — {{task_title}}',         'body' => "Dear {{name}},\n\n{{assignee}} has responded to assignment {{reference}} ({{task_title}}) with decision: {{decision}}.\n\n{{notes}}\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Assignment Completed',         'trigger_key' => 'assignment.completed',       'subject' => 'Assignment completed — {{task_title}}',                 'body' => "Dear {{name}},\n\n{{assignee}} has submitted assignment {{reference}} ({{task_title}}) for closure.\n\n{{notes}}\n\nPlease review and close or return the assignment.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Assignment Returned',          'trigger_key' => 'assignment.returned',        'subject' => 'Assignment returned for further work — {{task_title}}', 'body' => "Dear {{name}},\n\nAssignment {{reference}} ({{task_title}}) has been returned by {{issuer}} for further work.\n\nReason: {{reason}}\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'New Task (HR)',                 'trigger_key' => 'hr.task_assigned',           'subject' => 'New task assigned to you',                             'body' => "Dear {{name}},\n\nYou have been assigned a new task: {{task_title}}.\nDue date: {{due_date}}\n\nRegards,\nSADC-PF Nexus"],

        // Risk Register
        ['name' => 'Risk Submitted (Reviewer)',    'trigger_key' => 'risk.submitted',             'subject' => 'Risk submitted for review — {{risk_code}}',            'body' => "Dear {{name}},\n\nA risk has been submitted for review by {{submitter}}.\n\nRisk Code: {{risk_code}}\nTitle: {{title}}\nCategory: {{category}}\nLevel: {{level}}\n\nPlease log in to review.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Risk Approved',                'trigger_key' => 'risk.approved',              'subject' => 'Your risk has been approved — {{risk_code}}',           'body' => "Dear {{name}},\n\nYour risk ({{risk_code}}: {{title}}) has been approved by {{approved_by}}.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Risk Escalated',               'trigger_key' => 'risk.escalated',             'subject' => 'Risk escalated — {{risk_code}} requires attention',     'body' => "Dear {{name}},\n\nA risk has been escalated to level {{level}} by {{actor}}.\n\nRisk Code: {{risk_code}}\nTitle: {{title}}\n\n{{notes}}\n\nRegards,\nSADC-PF Nexus"],

        // Workflow
        ['name' => 'Approval Required',            'trigger_key' => 'workflow.approval_required', 'subject' => 'Action required: {{module_label}} request {{reference}} pending your approval', 'body' => "Dear {{name}},\n\nA {{module_label}} request ({{reference}}) submitted by {{requester}} is awaiting your approval.\n\n{{summary}}\n\nPlease use the buttons below to approve or return this request.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Workflow Completed (HR)',       'trigger_key' => 'workflow.completed',         'subject' => '{{module_label}} request {{reference}} has been {{status}}', 'body' => "Dear {{name}},\n\nThe {{module_label}} request ({{reference}}) submitted by {{requester}} has been {{status}} by {{approved_by}}.\n\nThis notification is for your records.\n\nRegards,\nSADC-PF Nexus"],

        // SRHR / Field Researchers
        ['name' => 'Deployment Started',           'trigger_key' => 'srhr.deployment.started',    'subject' => 'Field deployment confirmed — {{reference}}',           'body' => "Dear {{name}},\n\nYour field deployment has been confirmed.\n\nReference: {{reference}}\nParliament: {{parliament}}\nStart date: {{start_date}}\n\nPlease liaise with your supervisor and submit monthly reports through the SRHR portal.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Deployment Recalled',          'trigger_key' => 'srhr.deployment.recalled',   'subject' => 'Your field deployment has been recalled — {{reference}}', 'body' => "Dear {{name}},\n\nYour field deployment ({{reference}}) has been recalled with the following reason:\n\n{{reason}}\n\nPlease contact HR for further instructions.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Report Submitted (Reviewer)',  'trigger_key' => 'srhr.report.submitted',      'subject' => 'Field researcher report submitted — Action required',  'body' => "Dear {{name}},\n\nA field researcher report ({{reference}}) has been submitted and requires your acknowledgement.\n\nResearcher: {{employee}}\nReport title: {{title}}\nPeriod: {{period}}\n\nPlease log in to review and acknowledge this report.\n\nRegards,\nSADC-PF Nexus"],
        ['name' => 'Report Acknowledged',          'trigger_key' => 'srhr.report.acknowledged',   'subject' => 'Your report has been acknowledged — {{reference}}',    'body' => "Dear {{name}},\n\nYour field researcher report ({{reference}}) — \"{{title}}\" — has been acknowledged.\n\nThank you for your submission.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Report Revision Requested',    'trigger_key' => 'srhr.report.revision_requested', 'subject' => 'Revision requested on your report — {{reference}}', 'body' => "Dear {{name}},\n\nA revision has been requested on your report ({{reference}}) — \"{{title}}\".\n\nReviewer notes:\n{{notes}}\n\nPlease update and resubmit your report.\n\nRegards,\nSADC-PF HR"],

        // Timesheets
        ['name' => 'Timesheet Submitted (Approver)', 'trigger_key' => 'timesheet.submitted', 'subject' => 'Timesheet submitted for approval — {{requester}}', 'body' => "Dear {{name}},\n\nA timesheet has been submitted by {{requester}} for the week {{week_start}} – {{week_end}} ({{hours}} hours).\n\nPlease log in to review and approve.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Timesheet Approved',             'trigger_key' => 'timesheet.approved',   'subject' => 'Your timesheet has been approved',               'body' => "Dear {{name}},\n\nYour timesheet for the week {{week_start}} – {{week_end}} has been approved by {{approved_by}}.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Timesheet Rejected',             'trigger_key' => 'timesheet.rejected',   'subject' => 'Your timesheet has been returned',               'body' => "Dear {{name}},\n\nYour timesheet for the week {{week_start}} – {{week_end}} has been returned:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF HR"],

        // Generic
        ['name' => 'Request Rejected (Generic)',   'trigger_key' => 'request.rejected',           'subject' => 'Your request has been returned',                       'body' => "Dear {{name}},\n\nYour {{module}} request has been returned with the following comment:\n\n{{comment}}\n\nPlease revise and resubmit.\n\nRegards,\nSADC-PF Nexus"],
    ];

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $stored = NotificationTemplate::where('tenant_id', $tenantId)
            ->get()
            ->keyBy('trigger_key');

        $result = array_map(function ($def) use ($stored) {
            $t = $stored[$def['trigger_key']] ?? null;
            return [
                'id'          => $t?->id ?? null,
                'name'        => $def['name'],
                'trigger_key' => $def['trigger_key'],
                'subject'     => $t?->subject ?? $def['subject'],
                'body'        => $t?->body ?? $def['body'],
                'customised'  => $t !== null,
            ];
        }, $this->defaults);

        return response()->json($result);
    }

    public function updateByTrigger(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $tenantId  = $request->user()->tenant_id;
        $validated = $request->validate([
            'trigger_key' => 'required|string',
            'subject'     => 'required|string|max:255',
            'body'        => 'required|string',
        ]);

        $def  = collect($this->defaults)->firstWhere('trigger_key', $validated['trigger_key']);
        $name = $def['name'] ?? $validated['trigger_key'];

        $template = NotificationTemplate::updateOrCreate(
            ['tenant_id' => $tenantId, 'trigger_key' => $validated['trigger_key']],
            ['name' => $name, 'subject' => $validated['subject'], 'body' => $validated['body']]
        );

        return response()->json($template);
    }

    /**
     * Send a test email to the currently authenticated admin using a given template.
     */
    public function testSend(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $validated = $request->validate([
            'trigger_key' => 'required|string',
        ]);

        $tenantId = $request->user()->tenant_id;
        $user     = $request->user();

        $stored = NotificationTemplate::where('tenant_id', $tenantId)
            ->where('trigger_key', $validated['trigger_key'])
            ->first();

        $def = collect($this->defaults)->firstWhere('trigger_key', $validated['trigger_key']);

        $subject = $stored?->subject ?? $def['subject'] ?? 'Test Notification';
        $body    = $stored?->body    ?? $def['body']    ?? 'This is a test notification from SADC-PF Nexus.';

        // Replace placeholders with sample data for the test
        $samples = [
            'name'         => $user->name,
            'reference'    => 'TRV-SAMPLE001',
            'requester'    => 'Jane Doe',
            'destination'  => 'Windhoek, Namibia',
            'date'         => now()->addDays(7)->format('d M Y'),
            'start_date'   => now()->addDays(3)->format('d M Y'),
            'end_date'     => now()->addDays(8)->format('d M Y'),
            'leave_type'   => 'Annual Leave',
            'amount'       => 'NAD 5,000.00',
            'due_date'     => now()->addDays(14)->format('d M Y'),
            'comment'      => 'Please provide additional justification.',
            'module'       => 'Travel',
            'description'  => 'Sample task description.',
            'task_title'   => 'Review Q1 Programme Report',
        ];

        foreach ($samples as $key => $value) {
            $subject = str_replace('{{' . $key . '}}', $value, $subject);
            $body    = str_replace('{{' . $key . '}}', $value, $body);
        }

        Mail::to($user->email)
            ->queue(new ModuleNotificationMail('[TEST] ' . $subject, $body, $user->name));

        return response()->json(['message' => 'Test email queued to ' . $user->email]);
    }

    /**
     * Reset a customised template back to its system default by deleting the tenant override.
     */
    public function resetToDefault(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSystemAdmin(), 403, 'Insufficient privileges.');
        $validated = $request->validate([
            'trigger_key' => 'required|string',
        ]);

        $tenantId = $request->user()->tenant_id;

        NotificationTemplate::where('tenant_id', $tenantId)
            ->where('trigger_key', $validated['trigger_key'])
            ->delete();

        return response()->json(['message' => 'Template reset to system default.']);
    }
}
