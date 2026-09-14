<?php

namespace App\Modules\Procurement\Services;

use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use App\Support\FrontendUrl;
use Illuminate\Support\Carbon;

class SupplierEmailVerificationService
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function send(User $user): string
    {
        $url = $this->signedFrontendUrl($user);

        $this->notifications->dispatch(
            $user,
            'supplier.email_verification',
            [
                'name' => $user->name,
                'verify_url' => $url,
            ],
            [
                'module' => 'procurement',
                'record_id' => $user->vendor_id,
                'url' => '/supplier/verify-email',
                'allow_inactive' => true,
                'include_acting' => false,
                'include_delegates' => false,
                'idempotency_key' => 'supplier.email_verification:'.$user->id.':'.now()->format('YmdH'),
            ]
        );

        return $url;
    }

    public function signedFrontendUrl(User $user, ?Carbon $expires = null): string
    {
        $expiresAt = ($expires ?? now()->addDays(3))->timestamp;
        $signature = $this->signature((int) $user->id, (string) $user->email, $expiresAt);

        return FrontendUrl::to('supplier/verify-email').'?'.http_build_query([
            'user' => $user->id,
            'expires' => $expiresAt,
            'signature' => $signature,
        ]);
    }

    public function verify(int $userId, int $expires, string $signature): User
    {
        if ($expires < now()->timestamp) {
            abort(422, 'This verification link has expired.');
        }

        $user = User::query()->findOrFail($userId);
        $expected = $this->signature((int) $user->id, (string) $user->email, $expires);
        if (! hash_equals($expected, $signature)) {
            abort(422, 'This verification link is invalid.');
        }

        $updates = [];
        if (! $user->email_verified_at) {
            $updates['email_verified_at'] = now();
        }

        // Confirm the address, but never re-enable a staff-disabled portal user.
        // First-time draft applicants are still activated because draft is a login status.
        if (! $user->is_active) {
            $user->loadMissing('vendor');
            $vendor = $user->vendor;
            if ($vendor && in_array($vendor->normalizedStatus(), Vendor::PORTAL_LOGIN_STATUSES, true)) {
                $updates['is_active'] = true;
            }
        }

        if ($updates !== []) {
            $user->forceFill($updates)->save();
        }

        return $user->fresh();
    }

    private function signature(int $userId, string $email, int $expires): string
    {
        return hash_hmac('sha256', $userId.'|'.$email.'|'.$expires, (string) config('app.key'));
    }
}
