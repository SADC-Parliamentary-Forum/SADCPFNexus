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
