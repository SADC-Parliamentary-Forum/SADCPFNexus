<?php

namespace App\Modules\Procurement\Support;

final class BankAccountMasker
{
    public static function mask(?string $account): ?string
    {
        if ($account === null || $account === '') {
            return $account;
        }

        $compact = preg_replace('/\s+/', '', $account) ?? $account;
        $last = substr($compact, -4);

        return '••••'.$last;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public static function maskPayload(array $payload): array
    {
        if (array_key_exists('bank_account', $payload)) {
            $payload['bank_account'] = self::mask(is_string($payload['bank_account']) ? $payload['bank_account'] : null);
        }

        return $payload;
    }

    public static function canViewFull(mixed $user): bool
    {
        if (! $user) {
            return false;
        }

        if (method_exists($user, 'isSystemAdmin') && $user->isSystemAdmin()) {
            return true;
        }

        return method_exists($user, 'can') && (
            $user->can('procurement.supplier.bank.view')
            || $user->can('procurement.admin')
        );
    }
}
