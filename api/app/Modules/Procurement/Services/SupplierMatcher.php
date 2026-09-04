<?php

namespace App\Modules\Procurement\Services;

use App\Models\Vendor;

final class SupplierMatcher
{
    /**
     * @return array{vendor: ?Vendor, status: string, score: int, differences: list<array<string, mixed>>}
     */
    public function match(int $tenantId, array $extracted): array
    {
        $candidates = Vendor::query()->where('tenant_id', $tenantId)->get();
        $best = null;
        $bestScore = 0;

        foreach ($candidates as $vendor) {
            $score = 0;
            $name = strtolower((string) ($extracted['supplier_name'] ?? ''));
            $vName = strtolower((string) $vendor->name);
            if ($name !== '' && $vName !== '') {
                similar_text($this->normalizeName($name), $this->normalizeName($vName), $percent);
                $score += (int) round($percent);
            }
            if (! empty($extracted['supplier_email']) && strcasecmp((string) $vendor->contact_email, (string) $extracted['supplier_email']) === 0) {
                $score += 40;
            }
            if (! empty($extracted['supplier_tax_number']) && $vendor->tax_number && strcasecmp((string) $vendor->tax_number, (string) $extracted['supplier_tax_number']) === 0) {
                $score += 40;
            }
            if (! empty($extracted['supplier_registration_number']) && $vendor->registration_number
                && strcasecmp((string) $vendor->registration_number, (string) $extracted['supplier_registration_number']) === 0) {
                $score += 35;
            }
            $phone = preg_replace('/\D+/', '', (string) ($extracted['supplier_phone'] ?? ''));
            $vPhone = preg_replace('/\D+/', '', (string) ($vendor->contact_phone ?? ''));
            if ($phone !== '' && $vPhone !== '' && $phone === $vPhone) {
                $score += 30;
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $vendor;
            }
        }

        if (! $best || $bestScore < 55) {
            return ['vendor' => null, 'status' => 'unmatched', 'score' => $bestScore, 'differences' => []];
        }

        $differences = $this->differences($best, $extracted);
        $bankMismatch = $this->bankMismatch($best, $extracted);

        return [
            'vendor' => $best,
            'status' => $best->is_approved && $best->is_active ? 'matched' : 'matched_inactive',
            'score' => min(99, $bestScore),
            'differences' => $differences,
            'bank_mismatch' => $bankMismatch,
        ];
    }

    /**
     * @return list<array{field: string, master: mixed, document: mixed}>
     */
    private function differences(Vendor $vendor, array $extracted): array
    {
        $map = [
            'contact_phone' => 'supplier_phone',
            'contact_email' => 'supplier_email',
            'tax_number' => 'supplier_tax_number',
            'registration_number' => 'supplier_registration_number',
        ];
        $out = [];
        foreach ($map as $masterField => $docField) {
            $master = trim((string) ($vendor->{$masterField} ?? ''));
            $doc = trim((string) ($extracted[$docField] ?? ''));
            if ($master !== '' && $doc !== '' && $this->normalizeContact($master) !== $this->normalizeContact($doc)) {
                $out[] = ['field' => $masterField, 'master' => $master, 'document' => $doc];
            }
        }

        return $out;
    }

    private function bankMismatch(Vendor $vendor, array $extracted): bool
    {
        $doc = preg_replace('/\D+/', '', (string) ($extracted['bank_account'] ?? ''));
        $master = preg_replace('/\D+/', '', (string) ($vendor->bank_account ?? ''));

        return $doc !== '' && $master !== '' && $doc !== $master;
    }

    private function normalizeName(string $name): string
    {
        $name = strtolower($name);
        $name = preg_replace('/\b(pty|ltd|cc|service|services|the)\b/', '', $name) ?? $name;

        return trim(preg_replace('/\s+/', ' ', $name) ?? $name);
    }

    private function normalizeContact(string $value): string
    {
        return strtolower(preg_replace('/[\s\-\(\)]+/', '', $value) ?? $value);
    }
}
