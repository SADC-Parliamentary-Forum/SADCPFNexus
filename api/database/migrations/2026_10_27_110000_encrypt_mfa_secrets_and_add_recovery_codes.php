<?php

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TOTP secrets were stored in plaintext. User::$casts now encrypts
 * mfa_secret with the application key; this migration widens the column
 * (ciphertext exceeds 255 chars) and encrypts existing values in place.
 *
 * Idempotent: values that already decrypt are left alone, so a partial run
 * can be re-run safely. Requires the production APP_KEY — run it on the
 * environment whose key will read the data (rotate keys via APP_PREVIOUS_KEYS).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('mfa_secret')->nullable()->change();
            if (! Schema::hasColumn('users', 'mfa_recovery_codes')) {
                $table->text('mfa_recovery_codes')->nullable()->after('mfa_secret');
            }
        });

        DB::table('users')->whereNotNull('mfa_secret')->orderBy('id')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                if ($this->isEncrypted($user->mfa_secret)) {
                    continue;
                }
                DB::table('users')->where('id', $user->id)->update([
                    'mfa_secret' => Crypt::encryptString($user->mfa_secret),
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::table('users')->whereNotNull('mfa_secret')->orderBy('id')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                if (! $this->isEncrypted($user->mfa_secret)) {
                    continue;
                }
                DB::table('users')->where('id', $user->id)->update([
                    'mfa_secret' => Crypt::decryptString($user->mfa_secret),
                ]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('mfa_recovery_codes');
        });
        // mfa_secret stays text: narrowing could truncate values.
    }

    private function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);

            return true;
        } catch (DecryptException) {
            return false;
        }
    }
};
