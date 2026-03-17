<?php
namespace App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = AuditLog::where('tenant_id', $user->tenant_id)
            ->with('user:id,name,email')
            ->orderByDesc('created_at');

        if ($search = $request->input('user')) {
            $query->whereHas('user', fn($q) => $q->where('email', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%"));
        }
        if ($module = $request->input('module')) {
            if ($module !== 'All') {
                $query->where(function($q) use ($module) {
                    $q->where('tags', 'like', "%{$module}%")
                      ->orWhere('auditable_type', 'like', "%{$module}%");
                });
            }
        }
        if ($from = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $perPage = min((int) $request->input('per_page', 25), 100);
        $logs = $query->paginate($perPage);

        $data = $logs->getCollection()->map(fn($l) => [
            'id' => $l->id,
            'timestamp' => $l->created_at?->format('Y-m-d H:i:s'),
            'user' => $l->user?->email ?? 'system',
            'user_name' => $l->user?->name ?? 'System',
            'action' => $l->event,
            'module' => $l->tags ?? (class_basename($l->auditable_type ?? '') ?: 'System'),
            'record_id' => $l->auditable_id ? ($l->tags ? strtoupper(substr($l->tags, 0, 3)).'-'.str_pad($l->auditable_id, 3, '0', STR_PAD_LEFT) : (string)$l->auditable_id) : '—',
            'ip_address' => $l->ip_address,
        ]);

        return response()->json([
            'data' => $data,
            'current_page' => $logs->currentPage(),
            'last_page' => $logs->lastPage(),
            'per_page' => $logs->perPage(),
            'total' => $logs->total(),
        ]);
    }
}
