<?php

namespace App\Modules\Finance\Services;

use App\Models\AuditLog;
use App\Models\Payslip;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use ZipArchive;

class PayslipDistributionService
{
    public const MAX_FILES = 80;

    /** 25 MiB — same ceiling as a single uploaded payslip. */
    public const MAX_EXTRACTED_BYTES = 25 * 1024 * 1024;

    /** @var list<resource> */
    private array $tmpHandles = [];

    public function __destruct()
    {
        foreach ($this->tmpHandles as $handle) {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }
        $this->tmpHandles = [];
    }

    public function __construct(
        private readonly PayslipFilenameMatcher $matcher,
        private readonly PayslipAutoFillService $autoFill,
    ) {}

    /**
     * @param  list<string>  $filenames
     * @return array{period_month: int, period_year: int, items: list<array<string, mixed>>, coverage: array<string, mixed>}
     */
    public function preview(User $actor, array $filenames, int $periodMonth, int $periodYear): array
    {
        $users = $this->tenantStaff($actor->tenant_id);
        $existing = $this->existingByUser($actor->tenant_id, $periodMonth, $periodYear);

        $items = [];
        foreach ($filenames as $filename) {
            $match = $this->matcher->match((string) $filename, $users);
            $userId = $match['user']['id'] ?? null;
            $items[] = array_merge($match, [
                'filename' => (string) $filename,
                'archive' => null,
                'existing_payslip_id' => $userId ? ($existing[$userId] ?? null) : null,
            ]);
        }

        return [
            'period_month' => $periodMonth,
            'period_year' => $periodYear,
            'items' => $items,
            'coverage' => $this->coverage($actor->tenant_id, $periodMonth, $periodYear, $users, $existing),
        ];
    }

    /**
     * Preview from uploaded PDFs and/or a ZIP so HR can assign inner files before issuing.
     *
     * @param  list<UploadedFile>  $files
     * @return array{period_month: int, period_year: int, items: list<array<string, mixed>>, coverage: array<string, mixed>}
     */
    public function previewFromUploads(User $actor, array $files, int $periodMonth, int $periodYear): array
    {
        $expanded = $this->expandUploads($files);
        if (count($expanded) > self::MAX_FILES) {
            throw ValidationException::withMessages([
                'files' => 'A pay-period envelope may contain at most '.self::MAX_FILES.' documents.',
            ]);
        }
        $filenames = [];
        $archives = [];
        foreach ($expanded as $entry) {
            $name = $entry['file']->getClientOriginalName();
            $filenames[] = $name;
            $archives[$this->normalizeFilename($name)] = $entry['archive'];
        }
        $preview = $this->preview($actor, $filenames, $periodMonth, $periodYear);
        $preview['items'] = array_map(function (array $item) use ($archives) {
            $item['archive'] = $archives[$this->normalizeFilename((string) $item['filename'])] ?? null;

            return $item;
        }, $preview['items']);

        return $preview;
    }

    /**
     * @return array{issued: list<array<string, mixed>>, missing: list<array<string, mixed>>, totals: array<string, int>}
     */
    public function periodCoverage(User $actor, int $periodMonth, int $periodYear): array
    {
        $users = $this->tenantStaff($actor->tenant_id);
        $existing = $this->existingByUser($actor->tenant_id, $periodMonth, $periodYear);
        $issued = [];
        $missing = [];
        foreach ($users as $user) {
            $payload = [
                'id' => (int) $user->id,
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'employee_number' => $user->employee_number ? (string) $user->employee_number : null,
                'payslip_id' => $existing[$user->id] ?? null,
            ];
            if (isset($existing[$user->id])) {
                $issued[] = $payload;
            } else {
                $missing[] = $payload;
            }
        }

        return [
            'period_month' => $periodMonth,
            'period_year' => $periodYear,
            'issued' => $issued,
            'missing' => array_slice($missing, 0, 200),
            'totals' => [
                'staff' => $users->count(),
                'issued' => count($issued),
                'missing' => count($missing),
            ],
        ];
    }

    /**
     * @param  list<UploadedFile>  $files
     * @param  list<array{filename?: string, user_id?: int}>  $assignments
     * @return array{issued: int, replaced: int, failed: list<array{filename: string, reason: string}>, payslips: list<Payslip>}
     */
    public function distribute(User $actor, array $files, array $assignments, int $periodMonth, int $periodYear): array
    {
        $expanded = $this->expandUploads($files);
        if (count($expanded) > self::MAX_FILES) {
            throw ValidationException::withMessages([
                'files' => 'A pay-period envelope may contain at most '.self::MAX_FILES.' documents.',
            ]);
        }
        if ($expanded === []) {
            throw ValidationException::withMessages(['files' => 'No payslip documents were found in the upload.']);
        }

        $assignmentMap = [];
        foreach ($assignments as $row) {
            $name = basename((string) ($row['filename'] ?? ''));
            $userId = (int) ($row['user_id'] ?? 0);
            if ($name !== '' && $userId > 0) {
                $assignmentMap[$this->normalizeFilename($name)] = $userId;
            }
        }

        $users = $this->tenantStaff($actor->tenant_id)->keyBy('id');
        $issued = 0;
        $replaced = 0;
        $failed = [];
        $payslips = [];
        $seenUsers = [];

        foreach ($expanded as $entry) {
            $file = $entry['file'];
            $filename = $file->getClientOriginalName();
            $key = $this->normalizeFilename($filename);
            $userId = $assignmentMap[$key] ?? null;
            if ($userId === null) {
                $match = $this->matcher->match($filename, $users->values());
                $userId = $match['user']['id'] ?? null;
            }
            if ($userId === null || ! $users->has($userId)) {
                $failed[] = ['filename' => $filename, 'reason' => 'unassigned'];
                continue;
            }
            if (isset($seenUsers[$userId])) {
                $failed[] = ['filename' => $filename, 'reason' => 'duplicate_person'];
                continue;
            }
            $seenUsers[$userId] = true;

            /** @var User $employee */
            $employee = $users->get($userId);
            $existing = Payslip::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('user_id', $employee->id)
                ->where('period_year', $periodYear)
                ->where('period_month', $periodMonth)
                ->first();

            try {
                $payslip = $this->storeFile($actor, $employee, $file, $periodMonth, $periodYear, $existing);
                $payslips[] = $payslip;
                if ($existing) {
                    $replaced++;
                } else {
                    $issued++;
                }
            } catch (\Throwable $e) {
                Log::error('Payslip distribute failed', ['filename' => $filename, 'error' => $e->getMessage()]);
                $failed[] = ['filename' => $filename, 'reason' => 'store_failed'];
            }
        }

        AuditLog::record('finance.payslips.distributed', [
            'tenant_id' => $actor->tenant_id,
            'user_id' => $actor->id,
            'auditable_type' => Payslip::class,
            'new_values' => [
                'period_month' => $periodMonth,
                'period_year' => $periodYear,
                'issued' => $issued,
                'replaced' => $replaced,
                'failed' => count($failed),
            ],
            'tags' => ['payslips', 'hr'],
        ]);

        return [
            'issued' => $issued,
            'replaced' => $replaced,
            'failed' => $failed,
            'payslips' => $payslips,
        ];
    }

    /**
     * @return Collection<int, User>
     */
    public function directory(User $actor, ?string $query, int $limit = 20): Collection
    {
        $q = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('is_active', true)
            ->orderBy('name')
            ->limit($limit);

        if (filled($query)) {
            $term = '%'.trim((string) $query).'%';
            $q->where(function ($inner) use ($term) {
                $inner->where('name', 'ilike', $term)
                    ->orWhere('email', 'ilike', $term)
                    ->orWhere('employee_number', 'ilike', $term);
            });
        }

        return $q->get(['id', 'name', 'email', 'employee_number']);
    }

    /**
     * @param  list<UploadedFile>  $files
     * @return list<array{file: UploadedFile, archive: ?string}>
     */
    private function expandUploads(array $files): array
    {
        $out = [];
        foreach ($files as $file) {
            if (! $file instanceof UploadedFile || ! $file->isValid()) {
                continue;
            }
            $ext = strtolower((string) $file->getClientOriginalExtension());
            if ($ext === 'zip') {
                $archive = $file->getClientOriginalName();
                foreach ($this->extractZip($file) as $inner) {
                    $out[] = ['file' => $inner, 'archive' => $archive];
                }
                continue;
            }
            if (! in_array($ext, ['pdf', 'xlsx', 'xls'], true)) {
                continue;
            }
            $out[] = ['file' => $file, 'archive' => null];
        }

        return $out;
    }

    /**
     * @return list<UploadedFile>
     */
    private function extractZip(UploadedFile $zipFile): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw ValidationException::withMessages(['files' => 'ZIP support is not available on this server.']);
        }
        $zip = new ZipArchive();
        $opened = $zip->open($zipFile->getRealPath() ?: $zipFile->getPathname());
        if ($opened !== true) {
            throw ValidationException::withMessages(['files' => 'The ZIP archive could not be opened.']);
        }

        if ($zip->numFiles > self::MAX_FILES * 4) {
            $zip->close();
            throw ValidationException::withMessages(['files' => 'The ZIP archive contains too many entries.']);
        }

        $extracted = [];
        try {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (! is_string($name) || str_ends_with($name, '/')) {
                    continue;
                }
                if (str_contains($name, '..') || str_starts_with($name, '/') || str_contains($name, '\\')) {
                    throw ValidationException::withMessages(['files' => 'ZIP path is not allowed.']);
                }
                $ext = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
                if (! in_array($ext, ['pdf', 'xlsx', 'xls'], true)) {
                    continue;
                }
                $stream = $zip->getStream($name);
                if (! is_resource($stream)) {
                    continue;
                }
                $tmp = tmpfile();
                if ($tmp === false) {
                    fclose($stream);
                    continue;
                }
                $copied = stream_copy_to_stream($stream, $tmp, self::MAX_EXTRACTED_BYTES + 1);
                fclose($stream);
                if ($copied === false || $copied > self::MAX_EXTRACTED_BYTES) {
                    fclose($tmp);
                    throw ValidationException::withMessages(['files' => 'A file inside the ZIP exceeds the 25 MB limit.']);
                }
                $meta = stream_get_meta_data($tmp);
                $path = $meta['uri'] ?? null;
                if (! is_string($path) || $path === '') {
                    fclose($tmp);
                    continue;
                }
                $this->tmpHandles[] = $tmp;
                $extracted[] = new UploadedFile(
                    $path,
                    basename($name),
                    null,
                    null,
                    true
                );
            }
        } finally {
            $zip->close();
        }

        return $extracted;
    }

    private function storeFile(
        User $actor,
        User $employee,
        UploadedFile $file,
        int $periodMonth,
        int $periodYear,
        ?Payslip $existing
    ): Payslip {
        $dir = sprintf('payslips/%s/%s', $actor->tenant_id, $employee->id);
        $ext = strtolower((string) ($file->getClientOriginalExtension() ?: 'pdf'));
        $path = $file->storeAs(
            $dir,
            sprintf('%d-%02d.%s', $periodYear, $periodMonth, $ext ?: 'pdf'),
            'local'
        );

        if ($existing && $existing->file_path && $existing->file_path !== $path && Storage::disk('local')->exists($existing->file_path)) {
            Storage::disk('local')->delete($existing->file_path);
        }

        $payslip = Payslip::updateOrCreate(
            [
                'tenant_id' => $actor->tenant_id,
                'user_id' => $employee->id,
                'period_year' => $periodYear,
                'period_month' => $periodMonth,
            ],
            [
                'file_path' => $path,
                'gross_amount' => $existing?->gross_amount ?? 0,
                'net_amount' => $existing?->net_amount ?? 0,
                'currency' => $existing?->currency ?? 'NAD',
                'issued_at' => now(),
                'confirmation_status' => 'pending',
                'confirmed_by' => null,
                'confirmed_at' => null,
                'confirmation_notes' => null,
            ]
        );
        $payslip->load('user:id,name,email,employee_number');

        try {
            $this->autoFill->fill($payslip->fresh('user'));
        } catch (\Throwable $e) {
            Log::error('Payslip auto-fill failed', ['payslip_id' => $payslip->id, 'error' => $e->getMessage()]);
        }

        return $payslip->fresh('user');
    }

    /**
     * @return Collection<int, User>
     */
    private function tenantStaff(int $tenantId): Collection
    {
        return User::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'employee_number', 'tenant_id']);
    }

    /**
     * @return array<int, int> user_id => payslip_id
     */
    private function existingByUser(int $tenantId, int $periodMonth, int $periodYear): array
    {
        return Payslip::query()
            ->where('tenant_id', $tenantId)
            ->where('period_month', $periodMonth)
            ->where('period_year', $periodYear)
            ->pluck('id', 'user_id')
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function coverage(int $tenantId, int $periodMonth, int $periodYear, Collection $users, array $existing): array
    {
        return [
            'staff' => $users->count(),
            'already_issued' => count($existing),
            'missing' => max(0, $users->count() - count($existing)),
            'period_month' => $periodMonth,
            'period_year' => $periodYear,
        ];
    }

    private function normalizeFilename(string $filename): string
    {
        return strtolower(basename($filename));
    }
}
