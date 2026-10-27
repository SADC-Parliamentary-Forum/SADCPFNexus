<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyRecord;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Opt-in idempotency for authenticated writes: when a client sends an
 * `Idempotency-Key` header, the first request with that key runs normally
 * and its successful response is stored; any retry with the same key and
 * the same request replays the stored response instead of running again.
 *
 * This lets the mobile offline sync retry a create or submit after a lost
 * response without creating a duplicate record. Requests without the
 * header are untouched.
 */
class EnforceIdempotencyKey
{
    /**
     * An in-flight reservation older than this is treated as abandoned (crashed
     * worker). Kept well above the longest legitimate request (exports, large
     * uploads) so a slow request is never executed a second time.
     */
    private const STALE_AFTER_SECONDS = 1800;

    private const RETAIN_HOURS = 48;

    /** Responses larger than this are not stored; a replay then reports "already processed". */
    private const MAX_STORED_BYTES = 512 * 1024;

    /**
     * Never stored or replayed: responses here carry credentials, tokens, TOTP
     * secrets or recovery codes that must not persist outside their own tables.
     */
    private const EXCLUDED_PATHS = ['api/v1/auth/*', 'api/v1/profile/2fa/*', 'api/v1/profile/password*', 'api/v1/*/password*', 'api/v1/*token*'];

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');
        $user = $request->user();

        if (! $user || ! is_string($key) || $key === '' || ! in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)
            || $request->is(...self::EXCLUDED_PATHS)) {
            return $next($request);
        }

        if (strlen($key) > 128) {
            return response()->json(['message' => 'Idempotency-Key must be at most 128 characters.'], 422);
        }

        $fingerprint = $this->fingerprint($request);

        $existing = $this->reserve($request, (int) $user->id, (int) $user->tenant_id, $key, $fingerprint);
        if ($existing !== null) {
            return $existing;
        }

        try {
            $response = $next($request);
        } catch (Throwable $e) {
            $this->release((int) $user->id, $key);
            throw $e;
        }

        $this->settle((int) $user->id, $key, $response);

        return $response;
    }

    /**
     * Claim the key for this request. Returns null when this request should
     * run, or the response to send instead (replay / conflict / in progress).
     */
    private function reserve(Request $request, int $userId, int $tenantId, string $key, string $fingerprint, bool $retried = false): ?Response
    {
        $now = now();
        $inserted = DB::table('idempotency_records')->insertOrIgnore([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'idempotency_key' => $key,
            'method' => $request->method(),
            'path' => substr($request->path(), 0, 255),
            'request_fingerprint' => $fingerprint,
            'status' => 'processing',
            'expires_at' => $now->copy()->addHours(self::RETAIN_HOURS),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($inserted > 0) {
            return null;
        }

        $record = IdempotencyRecord::where('user_id', $userId)->where('idempotency_key', $key)->first();
        if ($record === null) {
            // Released between our insert and read; try once more.
            return $retried ? $this->inProgress() : $this->reserve($request, $userId, $tenantId, $key, $fingerprint, true);
        }

        if (! hash_equals($record->request_fingerprint, $fingerprint)) {
            return response()->json([
                'message' => 'This Idempotency-Key was already used for a different request.',
            ], 422);
        }

        if ($record->status === 'completed') {
            if ($record->response_body === null) {
                return response()->json([
                    'message' => 'This request was already processed.',
                ], 409)->header('Idempotent-Replayed', 'true');
            }

            return response(Crypt::decryptString($record->response_body), $record->response_status ?? 200)
                ->header('Content-Type', 'application/json')
                ->header('Idempotent-Replayed', 'true');
        }

        if (! $retried && $record->updated_at !== null && $record->updated_at->lt(now()->subSeconds(self::STALE_AFTER_SECONDS))) {
            IdempotencyRecord::whereKey($record->getKey())->where('status', 'processing')->delete();

            return $this->reserve($request, $userId, $tenantId, $key, $fingerprint, true);
        }

        return $this->inProgress();
    }

    /**
     * Same key + same request ⇔ same fingerprint: method, full URI (incl. query)
     * and body — for multipart uploads the raw body is empty in PHP, so form
     * fields and each file's name, size and content hash are included.
     */
    private function fingerprint(Request $request): string
    {
        $parts = [$request->method(), $request->getRequestUri(), $request->getContent()];

        if ($request->files->count() > 0) {
            $parts[] = json_encode($request->except(array_keys($request->allFiles())));
            foreach ($request->allFiles() as $field => $files) {
                foreach ((array) $files as $file) {
                    if ($file instanceof UploadedFile && $file->isValid()) {
                        $parts[] = $field.':'.$file->getClientOriginalName().':'.$file->getSize().':'.hash_file('sha256', $file->getRealPath());
                    }
                }
            }
        }

        return hash('sha256', implode("\n", $parts));
    }

    private function inProgress(): Response
    {
        return response()->json([
            'message' => 'A request with this Idempotency-Key is still being processed. Retry shortly.',
        ], 409)->header('Retry-After', '5');
    }

    /** Store a successful outcome for replay; free the key after a failure so the client can retry. */
    private function settle(int $userId, string $key, Response $response): void
    {
        $query = IdempotencyRecord::where('user_id', $userId)->where('idempotency_key', $key);

        if (! $response->isSuccessful()) {
            $query->delete();

            return;
        }

        $body = $response->getContent();
        $isJson = str_contains((string) $response->headers->get('Content-Type'), 'json');
        $storable = $isJson && is_string($body) && strlen($body) <= self::MAX_STORED_BYTES;

        $query->update([
            'status' => 'completed',
            'response_status' => $response->getStatusCode(),
            // Encrypted at rest: replayed bodies are business records.
            'response_body' => $storable ? Crypt::encryptString($body) : null,
            'updated_at' => now(),
        ]);
    }

    private function release(int $userId, string $key): void
    {
        try {
            IdempotencyRecord::where('user_id', $userId)->where('idempotency_key', $key)->delete();
        } catch (Throwable $e) {
            // An aborted transaction can reject this; the stale-reservation
            // takeover in reserve() recovers the key later.
            report($e);
        }
    }
}
