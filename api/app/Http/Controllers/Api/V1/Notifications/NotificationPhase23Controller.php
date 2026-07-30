<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Models\Notifications\NotificationAckCampaign;
use App\Models\Notifications\NotificationAiSuggestion;
use App\Models\Notifications\NotificationBroadcast;
use App\Models\Notifications\NotificationMaintenanceAlert;
use App\Modules\Notifications\Services\AckCampaignService;
use App\Modules\Notifications\Services\BroadcastService;
use App\Modules\Notifications\Services\DeliveryAnalyticsService;
use App\Modules\Notifications\Services\ExternalPortalService;
use App\Modules\Notifications\Services\NotificationIntelligenceService;
use App\Modules\Notifications\Services\PushDeliveryService;
use App\Modules\Notifications\Services\SecureLinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPhase23Controller extends Controller
{
    public function registerDevice(Request $request, PushDeliveryService $push): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:512'],
            'platform' => ['nullable', 'string', 'in:android,ios,web'],
            'device_name' => ['nullable', 'string', 'max:255'],
            'app_version' => ['nullable', 'string', 'max:64'],
        ]);

        $row = $push->register(
            $request->user(),
            $data['token'],
            $data['platform'] ?? 'android',
            $data['device_name'] ?? null,
            $data['app_version'] ?? null,
        );

        return response()->json(['message' => 'Device registered.', 'data' => $row]);
    }

    public function refreshDevice(Request $request, PushDeliveryService $push): JsonResponse
    {
        $data = $request->validate([
            'old_token' => ['required', 'string', 'max:512'],
            'new_token' => ['required', 'string', 'max:512'],
        ]);

        $row = $push->refresh($request->user(), $data['old_token'], $data['new_token']);

        return response()->json(['message' => 'Device token refreshed.', 'data' => $row]);
    }

    public function revokeDevice(Request $request, PushDeliveryService $push): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string']]);
        $push->revoke($request->user(), $data['token']);

        return response()->json(['message' => 'Device token revoked.']);
    }

    public function createAckCampaign(Request $request, AckCampaignService $acks): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.ack-campaigns.manage');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'importance' => ['nullable', 'string'],
            'required' => ['nullable', 'boolean'],
            'deadline_at' => ['nullable', 'date'],
            'reminder_offsets_hours' => ['nullable', 'array'],
            'escalation_policy' => ['nullable', 'array'],
            'audience' => ['nullable', 'array'],
            'secure_route' => ['nullable', 'string'],
        ]);

        $campaign = $acks->create((int) $request->user()->tenant_id, (int) $request->user()->id, $data);

        return response()->json(['data' => $campaign], 201);
    }

    public function activateAckCampaign(Request $request, string $id, AckCampaignService $acks): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.ack-campaigns.manage');
        $campaign = NotificationAckCampaign::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $acks->activate($campaign)]);
    }

    public function acknowledgeCampaign(Request $request, string $id, AckCampaignService $acks): JsonResponse
    {
        $campaign = NotificationAckCampaign::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $acks->acknowledge($campaign, $request->user())]);
    }

    public function ackReport(Request $request, string $id, AckCampaignService $acks): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.ack-campaigns.view');
        $campaign = NotificationAckCampaign::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $acks->report($campaign)]);
    }

    public function createBroadcast(Request $request, BroadcastService $broadcasts): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.send-broadcast');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'impact' => ['nullable', 'string', 'in:normal,high,critical'],
            'broadcast_type' => ['nullable', 'string'],
            'audience' => ['nullable', 'array'],
            'scheduled_at' => ['nullable', 'date'],
            'idempotency_key' => ['nullable', 'string', 'max:191'],
        ]);

        return response()->json([
            'data' => $broadcasts->create((int) $request->user()->tenant_id, (int) $request->user()->id, $data),
        ], 201);
    }

    public function submitBroadcast(Request $request, string $id, BroadcastService $broadcasts): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.send-broadcast');
        $broadcast = NotificationBroadcast::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $broadcasts->submit($broadcast, $request->user())]);
    }

    public function approveBroadcast(Request $request, string $id, BroadcastService $broadcasts): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.approve-broadcast');
        $broadcast = NotificationBroadcast::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json(['data' => $broadcasts->approve($broadcast, $request->user())]);
    }

    public function cancelBroadcast(Request $request, string $id, BroadcastService $broadcasts): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.send-broadcast');
        $broadcast = NotificationBroadcast::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        return response()->json([
            'data' => $broadcasts->cancel($broadcast, $request->user(), $request->input('reason')),
        ]);
    }

    public function analytics(Request $request, DeliveryAnalyticsService $analytics): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.analytics');

        return response()->json([
            'data' => $analytics->summary(
                (int) $request->user()->tenant_id,
                $request->query('from'),
                $request->query('to'),
            ),
        ]);
    }

    public function issueExternalToken(Request $request, ExternalPortalService $portal): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.external-portal.issue');
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'minimal_body' => ['required', 'string', 'max:2000'],
            'recipient_email' => ['nullable', 'email'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'secure_route' => ['nullable', 'string'],
            'source_module' => ['nullable', 'string'],
            'source_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $portal->issue((int) $request->user()->tenant_id, $data),
        ], 201);
    }

    public function scheduleMaintenance(Request $request, BroadcastService $broadcasts): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.maintenance.manage');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date'],
            'revalidate_at' => ['nullable', 'date'],
            'impact' => ['nullable', 'string'],
            'audience' => ['nullable', 'array'],
            'idempotency_key' => ['nullable', 'string'],
        ]);

        return response()->json([
            'data' => $broadcasts->scheduleMaintenance((int) $request->user()->tenant_id, (int) $request->user()->id, $data),
        ], 201);
    }

    public function listMaintenance(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.maintenance.manage');
        $rows = NotificationMaintenanceAlert::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->latest('id')
            ->limit(50)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function deepLinkPreview(Request $request, SecureLinkService $links): JsonResponse
    {
        $data = $request->validate(['route' => ['nullable', 'string']]);

        return response()->json(['data' => $links->structuredDeepLinks($data['route'] ?? '/notifications')]);
    }

    public function nlSearch(Request $request, NotificationIntelligenceService $ai): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'max:500']]);
        $result = $ai->nlInboxSearch($request->user(), $data['q']);

        return response()->json(['data' => $result]);
    }

    public function preferenceSuggestions(Request $request, NotificationIntelligenceService $ai): JsonResponse
    {
        return response()->json(['data' => $ai->suggestPreferences($request->user())]);
    }

    public function fatigue(Request $request, NotificationIntelligenceService $ai): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.analytics');

        return response()->json(['data' => $ai->fatigueAnalysis((int) $request->user()->tenant_id)]);
    }

    public function predictChannels(Request $request, NotificationIntelligenceService $ai): JsonResponse
    {
        $policy = app(\App\Modules\Notifications\Services\PolicyService::class)
            ->resolvePolicy((int) $request->user()->tenant_id, (string) $request->input('event_key', 'operational.update'));

        return response()->json(['data' => $ai->predictChannel($request->user(), $policy)]);
    }

    public function confirmSuggestion(Request $request, string $id, NotificationIntelligenceService $ai): JsonResponse
    {
        $suggestion = NotificationAiSuggestion::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $apply = (bool) $request->boolean('apply');
        if ($apply) {
            $this->authorizeAdmin($request, 'notifications.ai.apply');
        }

        return response()->json([
            'data' => $ai->confirmSuggestion($suggestion, $request->user(), $apply),
        ]);
    }

    public function aiGuards(Request $request, NotificationIntelligenceService $ai): JsonResponse
    {
        return response()->json(['data' => $ai->guards()]);
    }

    private function authorizeAdmin(Request $request, string $permission): void
    {
        $user = $request->user();
        if ($user->can($permission) || $user->can('notifications.admin') || $user->hasRole(['System Admin', 'super-admin'])) {
            return;
        }

        abort(403, 'Unauthorized');
    }
}
