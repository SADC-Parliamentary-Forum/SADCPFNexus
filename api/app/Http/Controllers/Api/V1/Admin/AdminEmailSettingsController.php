<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Admin\Services\TenantMailSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminEmailSettingsController extends Controller
{
    public function show(Request $request, TenantMailSettingsService $mail): JsonResponse
    {
        abort_unless($request->user()?->isSystemAdmin(), 403, 'Insufficient privileges.');

        return response()->json([
            'data' => $mail->show((int) $request->user()->tenant_id),
        ]);
    }

    public function update(Request $request, TenantMailSettingsService $mail): JsonResponse
    {
        abort_unless($request->user()?->isSystemAdmin(), 403, 'Insufficient privileges.');
        $data = $request->validate([
            'smtp' => ['nullable', 'array'],
            'smtp.enabled' => ['nullable', 'boolean'],
            'smtp.host' => ['nullable', 'string', 'max:255'],
            'smtp.port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'smtp.encryption' => ['nullable', 'in:tls,ssl,none'],
            'smtp.username' => ['nullable', 'string', 'max:255'],
            'smtp.password' => ['nullable', 'string', 'max:500'],
            'smtp.from_address' => ['nullable', 'email', 'max:255'],
            'smtp.from_name' => ['nullable', 'string', 'max:120'],
            'correspondence_imap' => ['nullable', 'array'],
            'correspondence_imap.enabled' => ['nullable', 'boolean'],
            'correspondence_imap.mailbox_address' => ['nullable', 'email', 'max:255'],
            'correspondence_imap.host' => ['nullable', 'string', 'max:255'],
            'correspondence_imap.port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'correspondence_imap.encryption' => ['nullable', 'in:ssl,tls,none'],
            'correspondence_imap.username' => ['nullable', 'string', 'max:255'],
            'correspondence_imap.password' => ['nullable', 'string', 'max:500'],
            'correspondence_imap.notes' => ['nullable', 'string', 'max:2000'],
            'procurement_imap' => ['nullable', 'array'],
            'procurement_imap.enabled' => ['nullable', 'boolean'],
            'procurement_imap.mailbox_address' => ['nullable', 'email', 'max:255'],
            'procurement_imap.host' => ['nullable', 'string', 'max:255'],
            'procurement_imap.port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'procurement_imap.encryption' => ['nullable', 'in:ssl,tls,none'],
            'procurement_imap.username' => ['nullable', 'string', 'max:255'],
            'procurement_imap.password' => ['nullable', 'string', 'max:500'],
            'procurement_imap.allowlist' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json([
            'data' => $mail->update((int) $request->user()->tenant_id, $request->user(), $data),
        ]);
    }
}
