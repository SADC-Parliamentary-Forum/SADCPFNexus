<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Models\Notifications\NotificationAuditEvent;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDeadLetter;
use App\Models\Notifications\NotificationRecipient;
use App\Models\User;
use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\SecureLinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationAdminController extends Controller
{
    public function deliveries(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.view-delivery-status');

        $query = NotificationChannelDelivery::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->latest('id');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($channel = $request->query('channel')) {
            $query->where('channel', $channel);
        }

        $paginated = $query->paginate((int) $request->query('per_page', 25));

        return response()->json([
            'data' => $paginated->items(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    public function failures(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.view-failures');

        $failed = NotificationChannelDelivery::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->whereIn('status', ['failed', 'retry_scheduled'])
            ->latest('id')
            ->limit(100)
            ->get();

        $dead = NotificationDeadLetter::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('status', 'open')
            ->latest('id')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => [
                'failed_deliveries' => $failed,
                'dead_letters' => $dead,
            ],
        ]);
    }

    public function retry(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.retry');

        $delivery = NotificationChannelDelivery::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $recipient = NotificationRecipient::find($delivery->recipient_id);
        $user = $recipient ? User::find($recipient->user_id) : null;
        if (! $user) {
            return response()->json(['message' => 'Recipient not found.'], 422);
        }

        $links = app(SecureLinkService::class);
        app(ChannelDeliveryService::class)->retry(
            $delivery,
            $user,
            'Administrator retry — sign in to Nexus for details.',
            $links->absoluteSecureUrl('/notifications'),
        );

        return response()->json(['message' => 'Retry queued.', 'data' => $delivery->fresh()]);
    }

    public function suppress(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.suppress');

        $delivery = NotificationChannelDelivery::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $reason = (string) $request->input('reason', 'admin_suppressed');
        $updated = app(ChannelDeliveryService::class)->suppress($delivery, $reason, $request->user()->id);

        return response()->json(['message' => 'Delivery suppressed.', 'data' => $updated]);
    }

    public function deadLetters(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.view-failures');

        $rows = NotificationDeadLetter::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->latest('id')
            ->paginate((int) $request->query('per_page', 25));

        return response()->json([
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function resolveDeadLetter(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.admin');

        $row = NotificationDeadLetter::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->findOrFail($id);

        $row->update([
            'status' => 'resolved',
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
            'resolution_notes' => $request->input('notes'),
        ]);

        return response()->json(['message' => 'Dead letter resolved.', 'data' => $row->fresh()]);
    }

    public function audit(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request, 'notifications.view-audit');

        $rows = NotificationAuditEvent::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->latest('id')
            ->paginate((int) $request->query('per_page', 50));

        return response()->json([
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
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
