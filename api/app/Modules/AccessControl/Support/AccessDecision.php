<?php

namespace App\Modules\AccessControl\Support;

final class AccessDecision
{
    public function __construct(
        public readonly bool $allowed,
        public readonly string $reasonCode,
        public readonly string $reasonMessage,
        public readonly ?string $matchedPermission = null,
        public readonly ?string $source = null,
        public readonly array $meta = [],
    ) {}

    public static function allow(string $reasonCode, string $message, ?string $permission = null, ?string $source = null, array $meta = []): self
    {
        return new self(true, $reasonCode, $message, $permission, $source, $meta);
    }

    public static function deny(string $reasonCode, string $message, array $meta = []): self
    {
        return new self(false, $reasonCode, $message, null, null, $meta);
    }

    public function toArray(): array
    {
        return [
            'allowed' => $this->allowed,
            'reason_code' => $this->reasonCode,
            'reason_message' => $this->reasonMessage,
            'matched_permission' => $this->matchedPermission,
            'source' => $this->source,
            'meta' => $this->meta,
        ];
    }
}
