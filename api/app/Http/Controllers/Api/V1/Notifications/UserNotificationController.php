<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
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

        $query = $user->notifications()->latest();

        if ($filter === 'unread') {
            $query->whereNull('read_at');
        } elseif ($filter === 'read') {
            $query->whereNotNull('read_at');
        }

        $paginated = $query->paginate((int) $request->query('per_page', 20));

        // Decode JSON data field for each item
        $paginated->getCollection()->transform(fn ($n) => $this->format($n));

        return response()->json($paginated);
    }

    /**
     * Number of unread notifications for the bell badge.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = $request->user()->unreadNotifications()->count();
        return response()->json(['count' => $count]);
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();
        return response()->json(['message' => 'Marked as read.']);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);
        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * Delete a single notification.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->delete();
        return response()->json(['message' => 'Notification deleted.']);
    }

    // -------------------------------------------------------------------------

    private function format(object $notification): array
    {
        $data = is_string($notification->data)
            ? json_decode($notification->data, true)
            : (array) $notification->data;

        return [
            'id'          => $notification->id,
            'trigger_key' => $data['trigger_key'] ?? null,
            'subject'     => $data['subject'] ?? 'Notification',
            'body'        => $data['body'] ?? '',
            'meta'        => $data['meta'] ?? [],
            'read_at'     => $notification->read_at?->toISOString(),
            'created_at'  => $notification->created_at->toISOString(),
        ];
    }
}
