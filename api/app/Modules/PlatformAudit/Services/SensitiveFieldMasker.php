<?php

namespace App\Modules\PlatformAudit\Services;

/**
 * PRD §27–§29 — never log passwords, tokens, MFA secrets, keys, recovery codes,
 * full bank credentials, or medical contents.
 */
class SensitiveFieldMasker
{
    public const EXCLUDED_KEYS = [
        'password', 'password_confirmation', 'current_password', 'new_password',
        'token', 'access_token', 'refresh_token', 'api_token', 'api_key', 'secret',
        'mfa_secret', 'totp_secret', 'otp', 'recovery_code', 'recovery_codes',
        'private_key', 'signing_key', 'encryption_key', 'client_secret',
        'bank_account_number', 'iban', 'account_number', 'routing_number',
        'card_number', 'cvv', 'pin',
        'medical_notes', 'diagnosis', 'medical_content', 'health_details',
    ];

    public const MASKED_KEYS = [
        'national_id', 'passport_number', 'tax_id', 'ssn', 'id_number',
        'phone', 'mobile', 'bank_name', 'salary', 'basic_salary', 'net_pay',
    ];

    /**
     * @param  array<string, mixed>|null  $values
     * @return array{values: array<string, mixed>, redactions: array<string, string>}
     */
    public function scrub(?array $values): array
    {
        if ($values === null) {
            return ['values' => [], 'redactions' => []];
        }

        $clean = [];
        $redactions = [];

        foreach ($values as $key => $value) {
            $normalized = strtolower((string) $key);
            if ($this->isExcluded($normalized)) {
                $redactions[$key] = 'excluded';
                continue;
            }
            if ($this->isMasked($normalized)) {
                $clean[$key] = $this->maskValue($value);
                $redactions[$key] = 'masked';
                continue;
            }
            if (is_array($value)) {
                $nested = $this->scrub($value);
                $clean[$key] = $nested['values'];
                foreach ($nested['redactions'] as $nk => $rt) {
                    $redactions["{$key}.{$nk}"] = $rt;
                }
                continue;
            }
            $clean[$key] = $value;
        }

        return ['values' => $clean, 'redactions' => $redactions];
    }

    /**
     * Build change rows from old/new maps with masking.
     *
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     * @return list<array<string, mixed>>
     */
    public function buildChanges(?array $old, ?array $new): array
    {
        $old = $old ?? [];
        $new = $new ?? [];
        $keys = array_unique(array_merge(array_keys($old), array_keys($new)));
        $rows = [];

        foreach ($keys as $key) {
            $normalized = strtolower((string) $key);
            $oldRaw = $old[$key] ?? null;
            $newRaw = $new[$key] ?? null;

            if ($oldRaw === $newRaw) {
                continue;
            }

            if ($this->isExcluded($normalized)) {
                $rows[] = [
                    'field_name' => (string) $key,
                    'field_label' => (string) $key,
                    'data_classification' => 'secret',
                    'old_value' => null,
                    'new_value' => null,
                    'old_value_hash' => $oldRaw !== null ? hash('sha256', $this->stringify($oldRaw)) : null,
                    'new_value_hash' => $newRaw !== null ? hash('sha256', $this->stringify($newRaw)) : null,
                    'redaction_type' => 'excluded',
                ];
                continue;
            }

            if ($this->isMasked($normalized)) {
                $rows[] = [
                    'field_name' => (string) $key,
                    'field_label' => (string) $key,
                    'data_classification' => 'sensitive',
                    'old_value' => $oldRaw !== null ? $this->maskValue($oldRaw) : null,
                    'new_value' => $newRaw !== null ? $this->maskValue($newRaw) : null,
                    'old_value_hash' => $oldRaw !== null ? hash('sha256', $this->stringify($oldRaw)) : null,
                    'new_value_hash' => $newRaw !== null ? hash('sha256', $this->stringify($newRaw)) : null,
                    'redaction_type' => 'masked',
                ];
                continue;
            }

            $rows[] = [
                'field_name' => (string) $key,
                'field_label' => (string) $key,
                'data_classification' => 'internal',
                'old_value' => $this->stringify($oldRaw),
                'new_value' => $this->stringify($newRaw),
                'old_value_hash' => $oldRaw !== null ? hash('sha256', $this->stringify($oldRaw)) : null,
                'new_value_hash' => $newRaw !== null ? hash('sha256', $this->stringify($newRaw)) : null,
                'redaction_type' => 'none',
            ];
        }

        return $rows;
    }

    private function isExcluded(string $normalized): bool
    {
        foreach (self::EXCLUDED_KEYS as $key) {
            if ($normalized === $key || str_contains($normalized, $key)) {
                return true;
            }
        }

        return false;
    }

    private function isMasked(string $normalized): bool
    {
        foreach (self::MASKED_KEYS as $key) {
            if ($normalized === $key || str_ends_with($normalized, '_'.$key) || str_contains($normalized, $key)) {
                return true;
            }
        }

        return false;
    }

    private function maskValue(mixed $value): string
    {
        $str = $this->stringify($value);
        if ($str === '' || $str === 'null') {
            return '***';
        }
        if (strlen($str) <= 4) {
            return '****';
        }

        return str_repeat('*', max(4, strlen($str) - 4)).substr($str, -4);
    }

    private function stringify(mixed $value): string
    {
        if ($value === null) {
            return 'null';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_scalar($value)) {
            return (string) $value;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
    }
}
