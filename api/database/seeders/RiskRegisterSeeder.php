<?php

namespace Database\Seeders;

use App\Models\Policy;
use App\Models\Risk;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use OpenSpout\Reader\XLSX\Reader;

class RiskRegisterSeeder extends Seeder
{
    // ── Scale mappings ──────────────────────────────────────────────────────

    private const IMPACT_MAP = [
        'insignificant' => 1,
        'minor'         => 2,
        'moderate'      => 3,
        'major'         => 4,
        'catastrophic'  => 5,
        'severe'        => 4,
        'extreme'       => 5,
        'high'          => 4,
        'medium'        => 3,
        'low'           => 2,
    ];

    private const LIKELIHOOD_MAP = [
        'rare'           => 1,
        'unlikely'       => 2,
        'possible'       => 3,
        'likely'         => 4,
        'almost certain' => 5,
        'frequent'       => 5,
        'almost'         => 4,
    ];

    private const CATEGORY_MAP = [
        'strategic'     => 'strategic',
        'strategy'      => 'strategic',
        'operational'   => 'operational',
        'operations'    => 'operational',
        'financial'     => 'financial',
        'finance'       => 'financial',
        'compliance'    => 'compliance',
        'legal'         => 'compliance',
        'governance'    => 'compliance',
        'reputational'  => 'reputational',
        'reputation'    => 'reputational',
        'security'      => 'security',
        'ict'           => 'security',
        'it '           => 'security',
    ];

    // ── Run ─────────────────────────────────────────────────────────────────

    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            $this->command->warn('RiskRegisterSeeder: tenant "sadcpf" not found — skipping.');
            return;
        }

        $admin = User::where('tenant_id', $tenant->id)
                     ->whereHas('roles', fn ($q) => $q->where('name', 'System Admin'))
                     ->first();
        if (! $admin) {
            $this->command->warn('RiskRegisterSeeder: System Admin user not found — skipping.');
            return;
        }

        $this->command->info('Seeding policies…');
        $policyCount = $this->seedPolicies($tenant, $admin);
        $this->command->info("  → {$policyCount} policies seeded.");

        // Documents are in the monorepo root (one level above api/)
        $docsDir      = base_path('../Documents');
        $currentFile  = $docsDir . '/Current-Risks-02-April-2026-13-13.xlsx';
        $archivedFile = $docsDir . '/Archived-Risks-02-April-2026-13-15.xlsx';

        $this->command->info('Seeding current risks…');
        $n1 = $this->seedRisksFromFile($currentFile, $tenant, $admin, 'approved');
        $this->command->info("  → {$n1} current risks seeded.");

        $this->command->info('Seeding archived risks…');
        $n2 = $this->seedRisksFromFile($archivedFile, $tenant, $admin, 'archived');
        $this->command->info("  → {$n2} archived risks seeded.");
    }

    // ── Policy seeding ───────────────────────────────────────────────────────

    private function seedPolicies(Tenant $tenant, User $admin): int
    {
        $file = base_path('../Documents/Policies-02-April-2026-13-14.xlsx');
        if (! file_exists($file)) {
            $this->command->warn("  Policies file not found: {$file}");
            return 0;
        }

        $count   = 0;
        $headers = null;

        $reader = new Reader();
        $reader->open($file);

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $rowIndex => $row) {
                $cells = $row->toArray(); // toArray() returns raw values directly
                if ($rowIndex === 1) {
                    $headers = array_map(fn ($c) => strtolower(trim((string) $c)), $cells);
                    continue;
                }
                if (! $headers) {
                    continue;
                }
                $values = $cells; // already raw values
                // Pad values to match headers length
                while (count($values) < count($headers)) {
                    $values[] = null;
                }
                $data = array_combine($headers, array_slice($values, 0, count($headers)));

                $title = trim((string) ($data['policy'] ?? ''));
                if (! $title) {
                    continue;
                }

                $renewalDate = $this->parseDate($data['renewal'] ?? null);

                Policy::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'title' => $title],
                    [
                        'description'  => trim((string) ($data['description'] ?? '')),
                        'owner_name'   => trim((string) ($data['owner'] ?? '')),
                        'renewal_date' => $renewalDate,
                        'status'       => 'active',
                        'created_by'   => $admin->id,
                    ]
                );
                $count++;
            }
            break; // first sheet only
        }
        $reader->close();
        return $count;
    }

    // ── Risk seeding ─────────────────────────────────────────────────────────

    private function seedRisksFromFile(string $file, Tenant $tenant, User $admin, string $defaultStatus): int
    {
        if (! file_exists($file)) {
            $this->command->warn("  File not found: {$file}");
            return 0;
        }

        $count   = 0;
        $headers = null;

        $reader = new Reader();
        $reader->open($file);

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $rowIndex => $row) {
                $cells = $row->toArray(); // toArray() returns raw values directly
                if ($rowIndex === 1) {
                    $headers = array_map(fn ($c) => strtolower(trim((string) $c)), $cells);
                    continue;
                }
                if (! $headers) {
                    continue;
                }
                $values = $cells; // already raw values
                while (count($values) < count($headers)) {
                    $values[] = null;
                }
                $data = array_combine($headers, array_slice($values, 0, count($headers)));

                $title = trim((string) ($data['risk title'] ?? $data['title'] ?? ''));
                if (! $title) {
                    continue;
                }

                // Store original system ID as a note prefix for traceability.
                // The model auto-generates risk_code (RSK-XXXXXXXX, max 30 chars).
                // Use title-based idempotency instead.
                if (Risk::where('tenant_id', $tenant->id)->where('title', $title)->exists()) {
                    continue; // idempotent
                }
                $origId = trim((string) ($data['system id'] ?? ''));

                $likelihood = $this->parseScale((string) ($data['inherent likelihood'] ?? ''), self::LIKELIHOOD_MAP);
                $impact     = $this->parseScale((string) ($data['inherent impact'] ?? ''), self::IMPACT_MAP);
                $resLikelihood = $this->parseScale((string) ($data['residual likelihood'] ?? ''), self::LIKELIHOOD_MAP);
                $resImpact     = $this->parseScale((string) ($data['residual impact'] ?? ''), self::IMPACT_MAP);

                // Determine status
                $archived   = strtolower(trim((string) ($data['archived'] ?? '')));
                $status     = ($archived === 'yes' || $archived === 'true' || $archived === '1')
                    ? 'archived'
                    : $defaultStatus;

                $reviewDate  = $this->parseDate($data['formal review date'] ?? null);
                $reviewFreq  = $this->mapReviewFrequency($data['formal review frequency (months)'] ?? null);
                $controls    = trim((string) ($data['key controls in place'] ?? ''));

                $reviewNotesValue = implode("\n", array_filter([
                    $origId ? "Original ID: {$origId}" : null,
                    $controls ?: null,
                ])) ?: null;

                $createData = [
                    'tenant_id'           => $tenant->id,
                    'title'               => $title,
                    'description'         => trim((string) ($data['principal inherent risk'] ?? $data['description'] ?? '')),
                    'category'            => $this->mapCategory((string) ($data['risk category'] ?? '')),
                    'likelihood'          => $likelihood,
                    'impact'              => $impact,
                    'residual_likelihood' => $resLikelihood,
                    'residual_impact'     => $resImpact,
                    'review_frequency'    => $reviewFreq,
                    'next_review_date'    => $reviewDate,
                    'review_notes'        => $reviewNotesValue,
                    'submitted_by'        => $admin->id,
                    'risk_owner_id'       => $admin->id,
                    'status'              => 'draft', // will be updated below
                ];

                $risk = Risk::create($createData);

                // Set final status directly (bypass service layer)
                if ($status !== 'draft') {
                    $risk->updateQuietly([
                        'status'      => $status,
                        'approved_by' => $admin->id,
                        'approved_at' => now(),
                    ]);
                }

                $count++;
            }
            break; // first sheet only
        }
        $reader->close();
        return $count;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function parseScale(string $value, array $map, int $default = 3): int
    {
        $normalised = strtolower(trim($value));
        if (isset($map[$normalised])) {
            return $map[$normalised];
        }
        // Partial match
        foreach ($map as $key => $score) {
            if (str_contains($normalised, $key)) {
                return $score;
            }
        }
        // Numeric fallback (direct 1–5 values from spreadsheet)
        if (is_numeric($value) && $value >= 1 && $value <= 5) {
            return (int) $value;
        }
        return $default;
    }

    private function mapCategory(string $value): string
    {
        $normalised = strtolower(trim($value));
        foreach (self::CATEGORY_MAP as $key => $mapped) {
            if (str_contains($normalised, $key)) {
                return $mapped;
            }
        }
        return 'other';
    }

    private function mapReviewFrequency(mixed $months): ?string
    {
        $m = (int) $months;
        return match ($m) {
            1       => 'monthly',
            3       => 'quarterly',
            6       => 'bi_annual',
            12      => 'annual',
            default => null,
        };
    }

    private function parseDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_string($value) && $value !== '') {
            try {
                return (new \DateTime($value))->format('Y-m-d');
            } catch (\Exception) {
                return null;
            }
        }
        return null;
    }
}
