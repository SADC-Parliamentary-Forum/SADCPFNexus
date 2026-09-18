<?php

namespace App\Modules\Assets\Support;

use App\Models\User;

final class AssetAccess
{
    public static function canManage(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->isSystemAdmin()) {
            return true;
        }

        return $user->hasAnyPermission(['assets.admin', 'assets.manage']);
    }

    public static function canClearRegister(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->isSystemAdmin()) {
            return true;
        }

        return $user->hasPermissionTo('assets.admin');
    }

    public static function canViewFinancials(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return $user->hasAnyPermission([
            'assets.financials.view',
            'finance.admin',
            'finance.approve',
            'finance.export',
        ]);
    }

    public static function canManageHandover(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->isSystemAdmin()) {
            return true;
        }

        return $user->hasAnyPermission([
            'assets.handover.manage', 'assets.admin', 'assets.manage',
        ]);
    }

    public static function canAcceptHandover(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return self::canManageHandover($user)
            || $user->hasAnyPermission(['assets.handover.accept', 'assets.view', 'profile.read.self']);
    }

    public static function canScan(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return $user->isSystemAdmin()
            || $user->hasAnyPermission(['assets.scan', 'assets.view', 'assets.verify', 'assets.admin', 'assets.manage']);
    }

    /** @return list<string> */
    public static function financialHidden(): array
    {
        return [
            'purchase_value', 'value', 'salvage_value', 'accumulated_depreciation',
            'book_value', 'opening_depreciation', 'source_depreciation', 'source_book_value',
            'current_value', 'vat_amount',
        ];
    }
}
