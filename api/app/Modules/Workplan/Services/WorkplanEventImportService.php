<?php

namespace App\Modules\Workplan\Services;

use App\Models\MeetingType;
use App\Models\User;
use App\Models\WorkplanEvent;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class WorkplanEventImportService
{
    public const TEMPLATE_CSV = "title,type,date,end_date,description,meeting_type,responsible,responsible_emails\nPlenary Session,meeting,2026-10-01,2026-10-03,Annual plenary meeting,Plenary,Secretariat,\nBudget submission deadline,deadline,2026-11-30,,,Finance close-out,,\n";

    public const MAX_ROWS = 500;

    public function __construct(private readonly WorkplanService $workplan) {}

    /**
     * @return array{created_count:int, error_count:int, created:list<WorkplanEvent>, errors:list<array{row:int, message:string}>}
     */
    public function importCsv(User $actor, UploadedFile $file): array
    {
        $parsed = $this->parseCsv($file);
        $created = [];
        $errors = [];

        foreach ($parsed as $entry) {
            try {
                $created[] = $this->importRow($actor, $entry['data']);
            } catch (ValidationException $e) {
                $errors[] = [
                    'row' => $entry['row'],
                    'message' => collect($e->errors())->flatten()->first() ?: 'Invalid row.',
                ];
            } catch (Throwable $e) {
                $errors[] = [
                    'row' => $entry['row'],
                    'message' => $e->getMessage() !== '' ? $e->getMessage() : 'Could not import this event row.',
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
     * @param  array<string, string>  $row
     */
    private function importRow(User $actor, array $row): WorkplanEvent
    {
        $title = $this->cell($row, ['title', 'event_title', 'name']);
        if ($title === '') {
            throw ValidationException::withMessages(['title' => 'Title is required.']);
        }

        $date = $this->parseDate($this->cell($row, ['date', 'start_date', 'start']));
        if ($date === null) {
            throw ValidationException::withMessages(['date' => 'Date is required (YYYY-MM-DD).']);
        }

        $endRaw = $this->cell($row, ['end_date', 'end']);
        $endDate = $endRaw === '' ? null : $this->parseDate($endRaw);
        if ($endRaw !== '' && $endDate === null) {
            throw ValidationException::withMessages(['end_date' => 'End date must be YYYY-MM-DD or DD/MM/YYYY.']);
        }
        if ($endDate !== null && $endDate < $date) {
            throw ValidationException::withMessages(['end_date' => 'End date must be on or after the start date.']);
        }

        $type = Str::slug($this->cell($row, ['type', 'event_type'])) ?: 'meeting';
        if (strlen($type) > 32) {
            throw ValidationException::withMessages(['type' => 'Event type is too long.']);
        }

        $duplicate = WorkplanEvent::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('title', $title)
            ->whereDate('date', $date)
            ->exists();
        if ($duplicate) {
            throw ValidationException::withMessages(['title' => 'An event with this title and date already exists.']);
        }

        $meetingTypeId = null;
        $meetingTypeName = $this->cell($row, ['meeting_type']);
        if ($meetingTypeName !== '') {
            $meetingType = MeetingType::query()
                ->where('tenant_id', $actor->tenant_id)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($meetingTypeName)])
                ->first();
            if (! $meetingType) {
                throw ValidationException::withMessages(['meeting_type' => 'Meeting type not found.']);
            }
            $meetingTypeId = $meetingType->id;
        }

        $responsibleIds = $this->resolveResponsibleEmails($actor, $this->cell($row, ['responsible_emails', 'emails', 'email']));

        return $this->workplan->create([
            'title' => $title,
            'type' => $type,
            'date' => $date,
            'end_date' => $endDate,
            'description' => $this->cell($row, ['description', 'notes']) ?: null,
            'responsible' => $this->cell($row, ['responsible']) ?: null,
            'meeting_type_id' => $meetingTypeId,
            'responsible_user_ids' => $responsibleIds,
        ], $actor);
    }

    /**
     * @return list<int>
     */
    private function resolveResponsibleEmails(User $actor, string $raw): array
    {
        if ($raw === '') {
            return [];
        }

        $emails = preg_split('/[,;]+/', $raw) ?: [];
        $ids = [];
        foreach ($emails as $email) {
            $email = strtolower(trim($email));
            if ($email === '') {
                continue;
            }
            $user = User::query()
                ->where('tenant_id', $actor->tenant_id)
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();
            if (! $user) {
                throw ValidationException::withMessages([
                    'responsible_emails' => "No staff member matched email {$email}.",
                ]);
            }
            $ids[] = $user->id;
        }

        return array_values(array_unique($ids));
    }

    /**
     * @return list<array{row:int, data:array<string, string>}>
     */
    private function parseCsv(UploadedFile $file): array
    {
        $path = $file->getRealPath();
        if ($path === false) {
            throw ValidationException::withMessages(['file' => 'The CSV file could not be read.']);
        }

        $handle = fopen($path, 'r');
        if (! is_resource($handle)) {
            throw ValidationException::withMessages(['file' => 'The CSV file could not be opened.']);
        }

        $header = fgetcsv($handle);
        if (! is_array($header) || $header === [null] || $header === false) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'The CSV file has no header row.']);
        }

        $header = array_map(function ($value) {
            $normalized = Str::of((string) $value)
                ->replace("\u{FEFF}", '')
                ->trim()
                ->lower()
                ->replace([' ', '-'], '_')
                ->toString();

            return ltrim($normalized, "\xEF\xBB\xBF");
        }, $header);

        if (! in_array('title', $header, true) && ! in_array('event_title', $header, true) && ! in_array('name', $header, true)) {
            fclose($handle);
            throw ValidationException::withMessages([
                'file' => 'Missing required column: title. Download the template and keep the header row.',
            ]);
        }

        $rows = [];
        $rowNumber = 1;
        while (($line = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($line === [null] || $line === []) {
                continue;
            }
            if (count($rows) >= self::MAX_ROWS) {
                fclose($handle);
                throw ValidationException::withMessages([
                    'file' => 'CSV has more than '.self::MAX_ROWS.' data rows.',
                ]);
            }
            $assoc = [];
            foreach ($header as $i => $key) {
                if ($key === '') {
                    continue;
                }
                $assoc[$key] = trim((string) ($line[$i] ?? ''));
            }
            if (count(array_filter($assoc, fn ($v) => $v !== '')) === 0) {
                continue;
            }
            $rows[] = ['row' => $rowNumber, 'data' => $assoc];
        }

        fclose($handle);

        return $rows;
    }

    /**
     * @param  array<string, string>  $row
     * @param  list<string>  $keys
     */
    private function cell(array $row, array $keys): string
    {
        foreach ($keys as $key) {
            if (isset($row[$key]) && trim($row[$key]) !== '') {
                return trim($row[$key]);
            }
        }

        return '';
    }

    private function parseDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'j/n/Y'] as $format) {
            try {
                $parsed = Carbon::createFromFormat($format, $value);
                if ($parsed instanceof Carbon && $parsed->format($format) === $value) {
                    return $parsed->toDateString();
                }
            } catch (Throwable) {
                continue;
            }
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (Throwable) {
            throw ValidationException::withMessages(['date' => 'Date must be YYYY-MM-DD or DD/MM/YYYY.']);
        }
    }
}
