<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserNotificationController extends Controller
{
    /**
     * List paginated notifications for the authenticated user.
     * ?filter=unread|read|all (default: all)
     */
    public function index(Request $request): JsonResponse
    {
        $user   = $request->user();
        $filter = $request->query('filter', 'all');

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->latest();

        if ($filter === 'unread') {
            $query->where('is_read', false);
        } elseif ($filter === 'read') {
            $query->where('is_read', true);
        }

        $paginated = $query->paginate((int) $request->query('per_page', 20));

        return response()->json([
            'data' => $paginated->getCollection()->map(fn ($n) => $this->format($n))->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    /**
     * Number of unread notifications for the bell badge.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = Notification::where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->where('is_read', false)
            ->count();
        return response()->json(['count' => $count]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = Notification::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
        $notification->update(['is_read' => true, 'read_at' => now()]);
        return response()->json(['message' => 'Marked as read.']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        Notification::where('user_id', $request->user()->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);
        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * Delete a single notification.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = Notification::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
        $notification->delete();
        return response()->json(['message' => 'Notification deleted.']);
    }

    // -------------------------------------------------------------------------

    private function format(Notification $notification): array
    {
        return [
            'id'          => $notification->id,
            'user_id'     => $notification->user_id,
            'trigger_key' => $notification->trigger,
            'subject'     => $notification->subject,
            'body'        => $notification->body,
            'meta'        => $notification->meta ?? [],
            'is_read'     => $notification->is_read,
            'read_at'     => $notification->read_at?->toISOString(),
            'created_at'  => $notification->created_at->toISOString(),
        ];
    }
}
