<?php

namespace App\Modules\Leave\Services;

use App\Models\LeaveRequest;
use App\Models\User;
use App\Services\DelegationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class LeaveBulkCaptureService
{
    public const TEMPLATE_CSV = "employee_email,employee_name,leave_type,start_date,end_date,reason\njane.doe@example.org,Jane Doe,annual,2026-10-06,2026-10-07,Paper leave captured by HR\n";

    public function __construct(
        private readonly LeaveService $leaveService,
        private readonly DelegationService $delegation,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return array{created_count:int, error_count:int, created:list<LeaveRequest>, errors:list<array{row:int, message:string}>}
     */
    public function captureRows(User $actor, array $rows, bool $submit): array
    {
        $this->assertCanCapture($actor);

        $created = [];
        $errors = [];

        foreach (array_values($rows) as $index => $row) {
            $rowNumber = $index + 1;
            try {
                $created[] = $this->captureRow($actor, is_array($row) ? $row : [], $submit);
            } catch (ValidationException $e) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => collect($e->errors())->flatten()->first() ?: 'Invalid row.',
                ];
            } catch (Throwable $e) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => $e->getMessage() !== '' ? $e->getMessage() : 'Could not capture this leave row.',
                ];
            }
        }

        return [
            'created_count' => count($created),
            'error_count' => count($errors),
            'created' => $created,
            'errors' => $errors,
        ];
    }

    /**
     * @return array{created_count:int, error_count:int, created:list<LeaveRequest>, errors:list<array{row:int, message:string}>}
     */
    public function captureCsv(User $actor, UploadedFile $file, bool $submit): array
    {
        $this->assertCanCapture($actor);

        $parsed = $this->parseCsv($file);
        $created = [];
        $errors = [];

        foreach ($parsed as $entry) {
            try {
                $created[] = $this->captureRow($actor, $entry['data'], $submit);
            } catch (ValidationException $e) {
                $errors[] = [
                    'row' => $entry['row'],
                    'message' => collect($e->errors())->flatten()->first() ?: 'Invalid row.',
                ];
            } catch (Throwable $e) {
                $errors[] = [
                    'row' => $entry['row'],
                    'message' => $e->getMessage() !== '' ? $e->getMessage() : 'Could not capture this leave row.',
                ];
            }
        }

        return [
            'created_count' => count($created),
            'error_count' => count($errors),
            'created' => $created,
            'errors' => $errors,
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function captureRow(User $actor, array $row, bool $submit): LeaveRequest
    {
        $email = strtolower(trim((string) ($row['employee_email'] ?? '')));
        if ($email === '') {
            throw ValidationException::withMessages([
                'employee_email' => ['Employee email is required.'],
            ]);
        }

        $principal = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $principal) {
            throw ValidationException::withMessages([
                'employee_email' => ['No employee matched this email.'],
            ]);
        }

        $data = [
            'leave_type' => $row['leave_type'] ?? 'annual',
            'start_date' => $row['start_date'] ?? null,
            'end_date' => $row['end_date'] ?? null,
            'reason' => $row['reason'] ?? null,
            'prepared_on_behalf_of' => $principal->id,
        ];

        $delegation = $this->delegation->authorise($actor, $principal->id, 'leave', 'draft');
        $leave = $this->leaveService->create($data, $principal);
        $this->delegation->stampPreparation($leave, $actor, $principal->id, 'leave', 'draft', $delegation);
        $leave->save();

        if ($submit) {
            $leave = $this->leaveService->submit($leave, $actor);
        }

        return $leave->fresh(['requester', 'preparedBy', 'preparedOnBehalfOf']);
    }

    /**
     * @return list<array{row:int, data:array<string, string>}>
     */
    private function parseCsv(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath() ?: '', 'r');
        if (! is_resource($handle)) {
            throw ValidationException::withMessages(['file' => ['The CSV file could not be read.']]);
        }

        $header = fgetcsv($handle);
        if (! is_array($header) || $header === [null] || $header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => ['The CSV file has no header row.']]);
        }

        $header = array_map(fn ($value) => Str::of((string) $value)->trim()->lower()->toString(), $header);
        $rows = [];
        $rowNumber = 1;

        while (($line = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($line === [null] || $line === []) {
                continue;
            }
            $assoc = [];
            foreach ($header as $i => $key) {
                if ($key === '') {
                    continue;
                }
                $assoc[$key] = trim((string) ($line[$i] ?? ''));
            }
            $rows[] = ['row' => $rowNumber, 'data' => $assoc];
        }

        fclose($handle);

        return $rows;
    }

    private function assertCanCapture(User $actor): void
    {
        if ($this->delegation->canPrepareLeaveForOthers($actor)) {
            return;
        }

        abort(403, 'Access restricted to HR administrators.');
    }
}
