<?php

namespace App\Modules\MAndE\Services;

use App\Models\Programme;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Historical activity CSV import scaffold (Phase 2).
 * Expected headers: activity_title, start_date, end_date, pif_number, non_pif_reason
 */
class MeImportService
{
    public function __construct(private readonly MeActivityReportService $reports) {}

    /**
     * @return array{rows: list<array<string,mixed>>, valid: int, invalid: int}
     */
    public function preview(UploadedFile $file, User $user): array
    {
        $parsed = $this->parseFile($file);

        $valid = 0;
        $invalid = 0;
        $rows = [];

        foreach ($parsed as $index => $row) {
            $errors = $this->validateRow($row, $user);
            $ok = $errors === [];
            if ($ok) {
                $valid++;
            } else {
                $invalid++;
            }
            $rows[] = [
                'line'   => $index + 2, // header is line 1
                'data'   => $row,
                'ok'     => $ok,
                'errors' => $errors,
            ];
        }

        return compact('rows', 'valid', 'invalid');
    }

    /**
     * @return array{created: int, skipped: int, errors: list<array<string,mixed>>}
     */
    public function commit(UploadedFile $file, User $user): array
    {
        $preview = $this->preview($file, $user);
        $created = 0;
        $skipped = 0;
        $errors = [];

        DB::transaction(function () use ($preview, $user, &$created, &$skipped, &$errors) {
            foreach ($preview['rows'] as $row) {
                if (! $row['ok']) {
                    $skipped++;
                    $errors[] = ['line' => $row['line'], 'errors' => $row['errors']];
                    continue;
                }

                $data = $row['data'];
                $payload = [
                    'activity_title' => $data['activity_title'],
                    'start_date'     => $data['start_date'] ?: null,
                    'end_date'       => $data['end_date'] ?: null,
                ];

                if (! empty($data['pif_number'])) {
                    $programme = Programme::query()
                        ->where('tenant_id', $user->tenant_id)
                        ->where('reference_number', $data['pif_number'])
                        ->first();
                    if (! $programme) {
                        $skipped++;
                        $errors[] = ['line' => $row['line'], 'errors' => ['pif_number' => 'PIF not found.']];
                        continue;
                    }
                    $payload['programme_id'] = $programme->id;
                } else {
                    $payload['non_pif_reason'] = $data['non_pif_reason'] ?: 'Historical import (non-PIF)';
                }

                $this->reports->create($payload, $user);
                $created++;
            }
        });

        return compact('created', 'skipped', 'errors');
    }

    /**
     * @return list<array{activity_title: string, start_date: string, end_date: string, pif_number: string, non_pif_reason: string}>
     */
    private function parseFile(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));
        if (in_array($ext, ['xlsx', 'xls'], true)) {
            return $this->parseXlsx($file);
        }

        return $this->parseCsv($file);
    }

    /**
     * @return list<array{activity_title: string, start_date: string, end_date: string, pif_number: string, non_pif_reason: string}>
     */
    private function parseXlsx(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        if ($path === false) {
            throw ValidationException::withMessages(['file' => 'Unable to read uploaded file.']);
        }

        $reader = new \OpenSpout\Reader\XLSX\Reader();
        $reader->open($path);

        $header = null;
        $rows = [];

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $rowIndex => $row) {
                $cells = $row->toArray();
                if ($rowIndex === 1) {
                    $header = array_map(fn ($c) => strtolower(trim((string) $c)), $cells);
                    if (! in_array('activity_title', $header, true)) {
                        $reader->close();
                        throw ValidationException::withMessages([
                            'file' => 'Missing required column: activity_title. Expected: activity_title, start_date, end_date, pif_number, non_pif_reason',
                        ]);
                    }
                    continue;
                }
                if ($header === null) {
                    continue;
                }
                if (count(array_filter($cells, fn ($c) => trim((string) $c) !== '')) === 0) {
                    continue;
                }
                $assoc = [];
                foreach ($header as $i => $key) {
                    $val = $cells[$i] ?? '';
                    if ($val instanceof \DateTimeInterface) {
                        $val = $val->format('Y-m-d');
                    }
                    $assoc[$key] = trim((string) $val);
                }
                $rows[] = [
                    'activity_title' => $assoc['activity_title'] ?? '',
                    'start_date'     => $assoc['start_date'] ?? '',
                    'end_date'       => $assoc['end_date'] ?? '',
                    'pif_number'     => $assoc['pif_number'] ?? '',
                    'non_pif_reason' => $assoc['non_pif_reason'] ?? '',
                ];
                if (count($rows) >= 500) {
                    break 2;
                }
            }
            break; // first sheet only
        }
        $reader->close();

        return $rows;
    }

    /**
     * @return list<array{activity_title: string, start_date: string, end_date: string, pif_number: string, non_pif_reason: string}>
     */
    private function parseCsv(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        if ($path === false) {
            throw ValidationException::withMessages(['file' => 'Unable to read uploaded file.']);
        }

        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw ValidationException::withMessages(['file' => 'Unable to open uploaded file.']);
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'CSV is empty.']);
        }

        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $header);
        $required = ['activity_title'];
        foreach ($required as $col) {
            if (! in_array($col, $header, true)) {
                fclose($handle);
                throw ValidationException::withMessages([
                    'file' => "Missing required column: {$col}. Expected: activity_title, start_date, end_date, pif_number, non_pif_reason",
                ]);
            }
        }

        $rows = [];
        while (($cols = fgetcsv($handle)) !== false) {
            if (count(array_filter($cols, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue;
            }
            $assoc = [];
            foreach ($header as $i => $key) {
                $assoc[$key] = trim((string) ($cols[$i] ?? ''));
            }
            $rows[] = [
                'activity_title' => $assoc['activity_title'] ?? '',
                'start_date'     => $assoc['start_date'] ?? '',
                'end_date'       => $assoc['end_date'] ?? '',
                'pif_number'     => $assoc['pif_number'] ?? '',
                'non_pif_reason' => $assoc['non_pif_reason'] ?? '',
            ];
            if (count($rows) >= 500) {
                break;
            }
        }
        fclose($handle);

        return $rows;
    }

    /**
     * @param  array{activity_title: string, start_date: string, end_date: string, pif_number: string, non_pif_reason: string}  $row
     * @return array<string, string>
     */
    private function validateRow(array $row, User $user): array
    {
        $errors = [];
        if (strlen($row['activity_title']) < 3) {
            $errors['activity_title'] = 'Title must be at least 3 characters.';
        }
        if ($row['start_date'] !== '' && strtotime($row['start_date']) === false) {
            $errors['start_date'] = 'Invalid start date.';
        }
        if ($row['end_date'] !== '' && strtotime($row['end_date']) === false) {
            $errors['end_date'] = 'Invalid end date.';
        }
        if ($row['start_date'] !== '' && $row['end_date'] !== ''
            && strtotime($row['end_date']) < strtotime($row['start_date'])) {
            $errors['end_date'] = 'End date before start date.';
        }
        if ($row['pif_number'] === '' && strlen($row['non_pif_reason']) < 5 && $row['non_pif_reason'] !== '') {
            $errors['non_pif_reason'] = 'Reason must be at least 5 characters when provided.';
        }
        if ($row['pif_number'] === '' && $row['non_pif_reason'] === '') {
            // Will default on commit — OK for preview
        }
        if ($row['pif_number'] !== '') {
            $exists = Programme::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('reference_number', $row['pif_number'])
                ->exists();
            if (! $exists) {
                $errors['pif_number'] = 'PIF not found for this tenant.';
            }
        }

        return $errors;
    }
}
