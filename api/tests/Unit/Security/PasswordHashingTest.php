<?php

namespace Tests\Unit\Security;

use PHPUnit\Framework\TestCase;

class PasswordHashingTest extends TestCase
{
    public function test_new_passwords_use_argon2id(): void
    {
        $hash = password_hash('Strong-Test-Password!123', PASSWORD_ARGON2ID);

        $this->assertStringStartsWith('$argon2id$', $hash);
        $this->assertTrue(password_verify('Strong-Test-Password!123', $hash));
    }

    public function test_legacy_bcrypt_hashes_are_detected_for_upgrade(): void
    {
        $hash = password_hash('Strong-Test-Password!123', PASSWORD_BCRYPT);

        $this->assertStringStartsNotWith('$argon2id$', $hash);
        $this->assertTrue(password_needs_rehash($hash, PASSWORD_ARGON2ID));
    }
}
