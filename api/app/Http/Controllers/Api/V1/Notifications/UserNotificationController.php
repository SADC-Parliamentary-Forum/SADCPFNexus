<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Notifications\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserNotificationController extends Controller
{
    /**
     * List paginated notifications for the authenticated user.
     * ?filter=all|unread|read|action_required|archived
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $filter = $request->query('filter', 'all');

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->latest();

        if ($filter === 'unread') {
            $query->where('is_read', false)->whereNull('archived_at');
        } elseif ($filter === 'read') {
            $query->where('is_read', true)->whereNull('archived_at');
        } elseif ($filter === 'action_required') {
            $query->where('action_required', true)->whereNull('archived_at');
        } elseif ($filter === 'archived') {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }

        $module = $request->query('module');
        if (is_string($module) && $module !== '') {
            $query->where(function ($q) use ($module) {
                $q->where('category', $module)
                    ->orWhere('meta->module', $module);
            });
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

    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = Notification::where('user_id', $user->id)
            ->where('tenant_id', $user->tenant_id)
            ->where('is_read', false)
            ->whereNull('archived_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $notification = $this->owned($request, $id);

        return response()->json(['data' => $this->format($notification)]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $this->owned($request, $id);
        $notification->update(['is_read' => true, 'read_at' => now()]);

        return response()->json(['message' => 'Marked as read.']);
    }

    public function markUnread(Request $request, string $id): JsonResponse
    {
        $notification = $this->owned($request, $id);
        $notification->update(['is_read' => false, 'read_at' => null]);

        return response()->json(['message' => 'Marked as unread.']);
    }

    public function acknowledge(Request $request, string $id): JsonResponse
    {
        $notification = $this->owned($request, $id);
        $notification->update([
            'is_read' => true,
            'read_at' => $notification->read_at ?? now(),
            'acknowledged_at' => now(),
        ]);

        return response()->json(['message' => 'Acknowledged.']);
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        $notification = $this->owned($request, $id);
        $notification->update(['archived_at' => now(), 'is_read' => true, 'read_at' => $notification->read_at ?? now()]);

        return response()->json(['message' => 'Archived.']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        Notification::where('user_id', $request->user()->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = $this->owned($request, $id);
        $notification->delete();

        return response()->json(['message' => 'Notification deleted.']);
    }

    public function preferences(Request $request): JsonResponse
    {
        $prefs = NotificationPreference::query()
            ->where('user_id', $request->user()->id)
            ->get();

        return response()->json(['data' => $prefs]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.*.category' => ['required', 'string', 'max:64'],
            'preferences.*.in_app_enabled' => ['sometimes', 'boolean'],
            'preferences.*.email_enabled' => ['sometimes', 'boolean'],
            'preferences.*.push_enabled' => ['sometimes', 'boolean'],
            'preferences.*.digest_mode' => ['sometimes', 'in:immediate,daily,weekly,off'],
            'preferences.*.quiet_hours_start' => ['nullable', 'date_format:H:i'],
            'preferences.*.quiet_hours_end' => ['nullable', 'date_format:H:i'],
            'preferences.*.preferred_language' => ['sometimes', 'in:en,fr,pt'],
        ]);

        $user = $request->user();
        $saved = [];
        foreach ($data['preferences'] as $row) {
            // Mandatory categories cannot be fully disabled — enforced at delivery time.
            $pref = NotificationPreference::updateOrCreate(
                ['user_id' => $user->id, 'category' => $row['category']],
                [
                    'tenant_id' => $user->tenant_id,
                    'in_app_enabled' => $row['in_app_enabled'] ?? true,
                    'email_enabled' => $row['email_enabled'] ?? true,
                    'push_enabled' => $row['push_enabled'] ?? true,
                    'digest_mode' => $row['digest_mode'] ?? 'immediate',
                    'quiet_hours_start' => isset($row['quiet_hours_start']) ? $row['quiet_hours_start'].':00' : null,
                    'quiet_hours_end' => isset($row['quiet_hours_end']) ? $row['quiet_hours_end'].':00' : null,
                    'preferred_language' => $row['preferred_language'] ?? 'en',
                ]
            );
            $saved[] = $pref;
        }

        return response()->json(['data' => $saved, 'message' => 'Preferences saved. Mandatory notices always deliver.']);
    }

    private function owned(Request $request, string $id): Notification
    {
        return Notification::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();
    }

    private function format(Notification $notification): array
    {
        return [
            'id' => $notification->id,
            'user_id' => $notification->user_id,
            'trigger_key' => $notification->trigger,
            'category' => $notification->category,
            'importance' => $notification->importance,
            'confidentiality' => $notification->confidentiality,
            'action_required' => (bool) $notification->action_required,
            'subject' => $notification->subject,
            'body' => $notification->body,
            'meta' => $notification->meta ?? [],
            'secure_route' => $notification->secure_route,
            'is_read' => $notification->is_read,
            'read_at' => $notification->read_at?->toISOString(),
            'acknowledged_at' => $notification->acknowledged_at?->toISOString(),
            'archived_at' => $notification->archived_at?->toISOString(),
            'created_at' => $notification->created_at->toISOString(),
        ];
    }
}
