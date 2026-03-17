<?php
namespace App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Controller;
use App\Models\NotificationTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationTemplateController extends Controller
{
    private array $defaults = [
        ['name' => 'Travel Approved',    'trigger_key' => 'travel.approved',        'subject' => 'Your travel request has been approved',        'body' => "Dear {{name}},\n\nYour travel request to {{destination}} departing on {{date}} has been approved.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Leave Approved',     'trigger_key' => 'leave.approved',         'subject' => 'Your leave request has been approved',          'body' => "Dear {{name}},\n\nYour {{leave_type}} leave from {{start_date}} to {{end_date}} has been approved.\n\nRegards,\nSADC-PF HR"],
        ['name' => 'Imprest Due',        'trigger_key' => 'imprest.retirement_due', 'subject' => 'Imprest retirement due — Action required',      'body' => "Dear {{name}},\n\nYour imprest of {{amount}} is due for retirement by {{due_date}}. Please submit your receipts.\n\nRegards,\nFinance"],
        ['name' => 'Request Rejected',   'trigger_key' => 'request.rejected',       'subject' => 'Your request has been returned',                'body' => "Dear {{name}},\n\nYour {{module}} request has been returned with the following comment:\n\n{{comment}}\n\nPlease revise and resubmit."],
        ['name' => 'Salary Advance Due', 'trigger_key' => 'finance.advance_due',    'subject' => 'Salary advance repayment due',                  'body' => "Dear {{name}},\n\nYour salary advance of {{amount}} has a repayment due on {{due_date}}.\n\nRegards,\nFinance"],
        ['name' => 'New Assignment',     'trigger_key' => 'hr.task_assigned',       'subject' => 'New task assigned to you',                      'body' => "Dear {{name}},\n\nYou have been assigned a new task: {{task_title}}.\nDue date: {{due_date}}\n\nRegards,\nSADC-PF Nexus"],
    ];

    public function index(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $stored = NotificationTemplate::where('tenant_id', $tenantId)
            ->get()
            ->keyBy('trigger_key');

        $result = array_map(function ($def) use ($stored, $tenantId) {
            $t = $stored[$def['trigger_key']] ?? null;
            return [
                'id' => $t?->id ?? null,
                'name' => $def['name'],
                'trigger_key' => $def['trigger_key'],
                'subject' => $t?->subject ?? $def['subject'],
                'body' => $t?->body ?? $def['body'],
            ];
        }, $this->defaults);

        return response()->json($result);
    }

    public function updateByTrigger(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;
        $validated = $request->validate([
            'trigger_key' => 'required|string',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
        ]);

        // Find the default name for this trigger
        $def = collect($this->defaults)->firstWhere('trigger_key', $validated['trigger_key']);
        $name = $def['name'] ?? $validated['trigger_key'];

        $template = NotificationTemplate::updateOrCreate(
            ['tenant_id' => $tenantId, 'trigger_key' => $validated['trigger_key']],
            ['name' => $name, 'subject' => $validated['subject'], 'body' => $validated['body']]
        );

        return response()->json($template);
    }
}
