<?php

namespace App\Modules\Assignments\Services;

use App\Models\Assignment;
use App\Models\GoogleCalendarConnection;
use App\Models\GoogleCalendarWebhookReceipt;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Two-way Google Calendar sync for Assignments.
 * Never invents assignments from arbitrary personal calendar events —
 * pull only updates rows already linked via google_calendar_event_id.
 */
final class AssignmentGoogleCalendarSyncService
{
    public function credentialsPresent(): bool
    {
        $serviceAccount = trim((string) config('services.google.calendar_service_account_json', ''));
        if ($serviceAccount !== '' && is_readable($serviceAccount)) {
            return true;
        }

        $clientId = trim((string) config('services.google.calendar_client_id', ''));
        $clientSecret = trim((string) config('services.google.calendar_client_secret', ''));
        $refresh = trim((string) config('services.google.calendar_refresh_token', ''));

        if ($clientId !== '' && $clientSecret !== '' && $refresh !== '') {
            return true;
        }

        return GoogleCalendarConnection::query()
            ->whereNotNull('refresh_token_encrypted')
            ->exists();
    }

    public function syncStatus(): string
    {
        return $this->credentialsPresent() ? 'configured' : 'not_configured';
    }

    /**
     * @param  array{tenant?:int|null,dry_run?:bool,direction?:string}  $options
     * @return array{status:string,pushed:int,pulled:int,skipped:int,errors:list<string>,dry_run:bool}
     */
    public function sync(array $options = []): array
    {
        $dryRun = (bool) ($options['dry_run'] ?? false);
        $tenantId = isset($options['tenant']) ? (int) $options['tenant'] : null;
        $direction = (string) ($options['direction'] ?? 'both');

        if (! $this->credentialsPresent()) {
            return [
                'status' => 'not_configured',
                'pushed' => 0,
                'pulled' => 0,
                'skipped' => 0,
                'errors' => [],
                'dry_run' => $dryRun,
            ];
        }

        $errors = [];
        $pushed = 0;
        $pulled = 0;
        $skipped = 0;

        try {
            if (in_array($direction, ['both', 'push'], true)) {
                $pushResult = $this->pushAll($tenantId, $dryRun);
                $pushed = $pushResult['pushed'];
                $skipped += $pushResult['skipped'];
                $errors = array_merge($errors, $pushResult['errors']);
            }

            if (in_array($direction, ['both', 'pull'], true)) {
                $pullResult = $this->pullEvents($tenantId, $dryRun);
                $pulled = $pullResult['pulled'];
                $skipped += $pullResult['skipped'];
                $errors = array_merge($errors, $pullResult['errors']);
            }
        } catch (\Throwable $e) {
            Log::warning('assignments.google_calendar.sync_failed', ['error' => $e->getMessage()]);
            $errors[] = $e->getMessage();

            return [
                'status' => 'error',
                'pushed' => $pushed,
                'pulled' => $pulled,
                'skipped' => $skipped,
                'errors' => $errors,
                'dry_run' => $dryRun,
            ];
        }

        return [
            'status' => empty($errors) ? 'ok' : 'partial',
            'pushed' => $pushed,
            'pulled' => $pulled,
            'skipped' => $skipped,
            'errors' => $errors,
            'dry_run' => $dryRun,
        ];
    }

    public function pushAssignment(Assignment $assignment, bool $dryRun = false): ?string
    {
        if (! $this->credentialsPresent()) {
            return null;
        }

        if ($assignment->is_template || ! $assignment->due_date) {
            return null;
        }

        $payload = $this->eventPayload($assignment);
        $existingId = $assignment->google_calendar_event_id;

        if ($dryRun) {
            return $existingId ?: 'dry-run-event';
        }

        $client = $this->httpClient();
        $calendarId = rawurlencode($this->calendarId($assignment->tenant_id));

        if ($existingId) {
            $response = $client->patch(
                "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events/".rawurlencode($existingId),
                $payload
            );
        } else {
            $response = $client->post(
                "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events",
                $payload
            );
        }

        if (! $response->successful()) {
            throw new \RuntimeException('Google Calendar push failed: '.$response->body());
        }

        $eventId = (string) ($response->json('id') ?: $existingId);
        $assignment->forceFill([
            'google_calendar_event_id' => $eventId,
            'google_calendar_etag' => $response->json('etag'),
            'google_calendar_synced_at' => now(),
        ])->save();

        return $eventId;
    }

    /**
     * @return array{pulled:int,skipped:int,errors:list<string>}
     */
    public function pullEvents(?int $tenantId = null, bool $dryRun = false): array
    {
        if (! $this->credentialsPresent()) {
            return ['pulled' => 0, 'skipped' => 0, 'errors' => []];
        }

        $client = $this->httpClient();
        $calendarId = rawurlencode($this->calendarId($tenantId));
        $connection = $tenantId
            ? GoogleCalendarConnection::query()->where('tenant_id', $tenantId)->first()
            : GoogleCalendarConnection::query()->orderBy('id')->first();

        $query = ['singleEvents' => 'true', 'showDeleted' => 'false', 'maxResults' => 250];
        if ($connection?->sync_token) {
            $query['syncToken'] = $connection->sync_token;
        }

        $response = $client->get(
            "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events",
            $query
        );

        if (! $response->successful()) {
            return [
                'pulled' => 0,
                'skipped' => 0,
                'errors' => ['Google Calendar pull failed: '.$response->status()],
            ];
        }

        $pulled = 0;
        $skipped = 0;

        foreach ($response->json('items') ?? [] as $item) {
            $eventId = (string) ($item['id'] ?? '');
            if ($eventId === '') {
                $skipped++;
                continue;
            }

            $assignmentQuery = Assignment::query()->where('google_calendar_event_id', $eventId);
            if ($tenantId) {
                $assignmentQuery->where('tenant_id', $tenantId);
            }
            $assignment = $assignmentQuery->first();

            if (! $assignment) {
                // Never invent assignments from unlinked personal calendar events.
                $skipped++;
                continue;
            }

            $start = $item['start']['date'] ?? ($item['start']['dateTime'] ?? null);
            $end = $item['end']['date'] ?? ($item['end']['dateTime'] ?? null);
            if (! $start && ! $end) {
                $skipped++;
                continue;
            }

            if (! $dryRun) {
                $assignment->forceFill([
                    'start_date' => $start ? substr((string) $start, 0, 10) : $assignment->start_date,
                    'due_date' => $end ? substr((string) $end, 0, 10) : ($start ? substr((string) $start, 0, 10) : $assignment->due_date),
                    'google_calendar_etag' => $item['etag'] ?? $assignment->google_calendar_etag,
                    'google_calendar_synced_at' => now(),
                ])->save();
            }
            $pulled++;
        }

        $nextToken = $response->json('nextSyncToken');
        if ($nextToken && $connection && ! $dryRun) {
            $connection->forceFill([
                'sync_token' => $nextToken,
                'last_synced_at' => now(),
            ])->save();
        }

        return ['pulled' => $pulled, 'skipped' => $skipped, 'errors' => []];
    }

    /**
     * @return array{status:string,message:string,pulled?:int,skipped?:int}
     */
    public function handleWebhookNotification(array $headers): array
    {
        $channelId = (string) ($headers['X-Goog-Channel-ID'] ?? $headers['x-goog-channel-id'] ?? '');
        $resourceId = (string) ($headers['X-Goog-Resource-ID'] ?? $headers['x-goog-resource-id'] ?? '');
        $messageNumber = (string) ($headers['X-Goog-Message-Number'] ?? $headers['x-goog-message-number'] ?? '');

        if ($channelId === '' || $messageNumber === '') {
            return ['status' => 'ignored', 'message' => 'Missing channel headers.'];
        }

        $existing = GoogleCalendarWebhookReceipt::query()
            ->where('channel_id', $channelId)
            ->where('message_number', $messageNumber)
            ->first();

        if ($existing) {
            return ['status' => 'duplicate', 'message' => 'Notification already processed.'];
        }

        GoogleCalendarWebhookReceipt::create([
            'channel_id' => $channelId,
            'resource_id' => $resourceId ?: null,
            'message_number' => $messageNumber,
            'processed_at' => now(),
        ]);

        $pull = $this->pullEvents();

        return [
            'status' => 'ok',
            'message' => 'Webhook processed.',
            'pulled' => $pull['pulled'],
            'skipped' => $pull['skipped'],
        ];
    }

    /**
     * @return array{pushed:int,skipped:int,errors:list<string>}
     */
    private function pushAll(?int $tenantId, bool $dryRun): array
    {
        $query = Assignment::query()
            ->where('is_template', false)
            ->whereNotNull('due_date')
            ->whereNotIn('status', ['cancelled', 'draft']);

        if ($tenantId) {
            $query->where('tenant_id', $tenantId);
        }

        $pushed = 0;
        $skipped = 0;
        $errors = [];

        foreach ($query->orderBy('id')->cursor() as $assignment) {
            try {
                $id = $this->pushAssignment($assignment, $dryRun);
                if ($id) {
                    $pushed++;
                } else {
                    $skipped++;
                }
            } catch (\Throwable $e) {
                $errors[] = 'assignment#'.$assignment->id.': '.$e->getMessage();
            }
        }

        return compact('pushed', 'skipped', 'errors');
    }

    /** @return array<string, mixed> */
    private function eventPayload(Assignment $assignment): array
    {
        $start = $assignment->start_date?->toDateString() ?: $assignment->due_date?->toDateString();
        $end = $assignment->due_date?->toDateString() ?: $start;

        return [
            'summary' => $assignment->title ?: 'Assignment',
            'description' => trim(($assignment->reference_number ?? '').' — '.$assignment->status),
            'start' => ['date' => $start],
            'end' => ['date' => $end],
            'extendedProperties' => [
                'private' => [
                    'sadcpf_assignment_id' => (string) $assignment->id,
                    'sadcpf_tenant_id' => (string) $assignment->tenant_id,
                ],
            ],
        ];
    }

    private function calendarId(?int $tenantId = null): string
    {
        if ($tenantId) {
            $conn = GoogleCalendarConnection::query()->where('tenant_id', $tenantId)->first();
            if ($conn?->calendar_id) {
                return $conn->calendar_id;
            }
        }

        return trim((string) config('services.google.calendar_id', 'primary')) ?: 'primary';
    }

    private function httpClient(): PendingRequest
    {
        return Http::withToken($this->accessToken())
            ->acceptJson()
            ->timeout(20);
    }

    private function accessToken(): string
    {
        $serviceAccount = trim((string) config('services.google.calendar_service_account_json', ''));
        if ($serviceAccount !== '' && is_readable($serviceAccount)) {
            // Service-account JWT exchange is environment-specific; tests use OAuth refresh path.
            // Operators place a JSON key path in GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON.
            throw new \RuntimeException(
                'Service-account JSON is configured; use a Google API client library or OAuth refresh token for HTTP sync in this build.'
            );
        }

        $refresh = trim((string) config('services.google.calendar_refresh_token', ''));
        $connection = null;
        if ($refresh === '') {
            $connection = GoogleCalendarConnection::query()
                ->whereNotNull('refresh_token_encrypted')
                ->orderBy('id')
                ->first();
            $refresh = (string) ($connection?->getRefreshToken() ?? '');
        }

        if ($refresh === '') {
            throw new \RuntimeException('Google Calendar refresh token is not configured.');
        }

        if ($connection?->getAccessToken() && $connection->token_expires_at?->isFuture()) {
            return (string) $connection->getAccessToken();
        }

        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'client_id' => config('services.google.calendar_client_id'),
            'client_secret' => config('services.google.calendar_client_secret'),
            'refresh_token' => $refresh,
            'grant_type' => 'refresh_token',
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('Failed to refresh Google Calendar access token.');
        }

        $token = (string) $response->json('access_token');
        if ($connection) {
            $connection->setAccessToken($token);
            $connection->token_expires_at = now()->addSeconds((int) ($response->json('expires_in') ?? 3500));
            $connection->save();
        }

        return $token;
    }
}
