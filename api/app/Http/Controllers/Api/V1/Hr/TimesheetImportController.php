<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessTimesheetImportJob;
use App\Models\TimesheetImportBatch;
use App\Models\TimesheetImportMapping;
use App\Models\TimesheetImportTemplate;
use App\Modules\Timesheets\Import\NexusTimesheetTemplateWorkbook;
use App\Modules\Timesheets\Services\TimesheetImportCommitService;
use App\Modules\Timesheets\Services\TimesheetImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetImportController extends Controller
{
    public function __construct(
        private readonly TimesheetImportService $imports,
        private readonly TimesheetImportCommitService $commits,
    ) {}

    public function template(Request $request): Response
    {
        $actor = $request->user();
        abort_unless(
            $actor->can('timesheets.import-own')
            || $actor->can('timesheets.import-single')
            || $actor->can('timesheets.import-multi')
            || $actor->can('timesheets.admin'),
            403
        );
        $payload = $this->imports->templateBinary($actor);

        return response($payload['binary'], 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$payload['filename'].'"',
            'Content-Length' => (string) strlen($payload['binary']),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = TimesheetImportBatch::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('id');
        if (! ($user->can('timesheets.import-view-batches') || $user->can('timesheets.admin'))) {
            $query->where('uploaded_by', $user->id);
        }
        $rows = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($rows->items())->map(fn (TimesheetImportBatch $b) => $this->imports->serializeBatch($b)),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:20480'],
            'mode' => ['nullable', Rule::in([TimesheetImportBatch::MODE_SELF, TimesheetImportBatch::MODE_SINGLE, TimesheetImportBatch::MODE_MULTI])],
            'target_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'import_as_verified' => ['sometimes', 'boolean'],
            'justification' => ['nullable', 'string', 'max:2000'],
        ]);

        $batch = $this->imports->ingest(
            $request->file('file'),
            $request->user(),
            $data['mode'] ?? TimesheetImportBatch::MODE_SELF,
            $data['target_user_id'] ?? null,
            (bool) ($data['import_as_verified'] ?? false),
            $data['justification'] ?? null,
        );

        if ($batch->status === TimesheetImportBatch::STATUS_UPLOADED) {
            ProcessTimesheetImportJob::dispatch($batch->id, 'ingest');
        }

        $batch = $batch->fresh();

        return response()->json([
            'message' => 'Upload successful. Processing records…',
            'data' => $this->imports->serializeBatch($batch),
        ], 201);
    }

    public function show(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $this->imports->assertCanView($request->user(), $timesheetImportBatch);

        return response()->json([
            'data' => $this->imports->preview(
                $timesheetImportBatch,
                $request->user(),
                $request->query('filter'),
                $request->integer('page', 1),
                $request->integer('per_page', 50),
            ),
        ]);
    }

    public function map(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $data = $request->validate([
            'column_map' => ['nullable', 'array'],
            'employee_maps' => ['nullable', 'array'],
            'employee_maps.*.email' => ['required_with:employee_maps', 'email'],
            'employee_maps.*.user_id' => ['required_with:employee_maps', 'integer'],
            'apply_to_all' => ['sometimes', 'boolean'],
        ]);

        $batch = $this->imports->applyMap(
            $timesheetImportBatch,
            $request->user(),
            $data['column_map'] ?? [],
            $data['employee_maps'] ?? [],
            $data['apply_to_all'] ?? true,
        );

        return response()->json([
            'message' => 'Mappings applied.',
            'data' => $this->imports->serializeBatch($batch),
        ]);
    }

    public function validateBatch(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $this->imports->assertCanImport($request->user(), $timesheetImportBatch->mode);
        $batch = $this->imports->processStaging($timesheetImportBatch);

        return response()->json([
            'message' => 'Validation complete.',
            'data' => $this->imports->serializeBatch($batch),
        ]);
    }

    public function preview(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        return $this->show($request, $timesheetImportBatch);
    }

    public function failures(Request $request, TimesheetImportBatch $timesheetImportBatch): StreamedResponse
    {
        return $this->imports->failuresCsv($timesheetImportBatch, $request->user());
    }

    public function confirm(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $data = $request->validate([
            'import_valid_only' => ['sometimes', 'boolean'],
        ]);
        $actor = $request->user();
        $this->imports->assertCanImport($actor, $timesheetImportBatch->mode);
        abort_unless((int) $timesheetImportBatch->tenant_id === (int) $actor->tenant_id, 404);

        $already = [
            TimesheetImportBatch::STATUS_IMPORTED,
            TimesheetImportBatch::STATUS_PARTIAL,
            TimesheetImportBatch::STATUS_VERIFIED,
        ];
        if (in_array($timesheetImportBatch->status, $already, true)) {
            return response()->json([
                'message' => 'Import already processed.',
                'data' => $this->imports->serializeBatch($timesheetImportBatch),
            ]);
        }
        if ($timesheetImportBatch->status !== TimesheetImportBatch::STATUS_PREVIEW_READY
            && $timesheetImportBatch->status !== TimesheetImportBatch::STATUS_PROCESSING) {
            abort(422, 'Confirm the import only after preview is ready.');
        }

        $key = $request->header('Idempotency-Key');
        if ($timesheetImportBatch->status === TimesheetImportBatch::STATUS_PREVIEW_READY) {
            ProcessTimesheetImportJob::dispatch(
                $timesheetImportBatch->id,
                'commit',
                $actor->id,
                $data['import_valid_only'] ?? true,
                is_string($key) && $key !== '' ? $key : null,
            );
        }

        return response()->json([
            'message' => 'Import processed.',
            'data' => $this->imports->serializeBatch($timesheetImportBatch->fresh()),
        ]);
    }

    public function verify(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $data = $request->validate([
            'justification' => ['required', 'string', 'max:2000'],
            'user_id' => ['nullable', 'integer'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
        ]);
        $batch = $this->commits->verify(
            $timesheetImportBatch,
            $request->user(),
            $data['justification'],
            $data['user_id'] ?? null,
            $data['period_start'] ?? null,
            $data['period_end'] ?? null,
        );

        return response()->json([
            'message' => 'Historical batch verified.',
            'data' => $this->imports->serializeBatch($batch),
        ]);
    }

    public function rollback(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $batch = $this->commits->rollback($timesheetImportBatch, $request->user(), $data['reason']);

        return response()->json([
            'message' => 'Import batch rolled back.',
            'data' => $this->imports->serializeBatch($batch),
        ]);
    }

    public function reverse(Request $request, TimesheetImportBatch $timesheetImportBatch): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $batch = $this->commits->reverse($timesheetImportBatch, $request->user(), $data['reason']);

        return response()->json([
            'message' => 'Verified import reversed.',
            'data' => $this->imports->serializeBatch($batch),
        ]);
    }

    public function file(Request $request, TimesheetImportBatch $timesheetImportBatch): StreamedResponse
    {
        $this->imports->assertCanView($request->user(), $timesheetImportBatch);
        abort_unless($timesheetImportBatch->file_storage_key && Storage::disk('local')->exists($timesheetImportBatch->file_storage_key), 404);

        return Storage::disk('local')->download(
            $timesheetImportBatch->file_storage_key,
            $timesheetImportBatch->filename
        );
    }

    public function mappings(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('timesheets.manage-mappings') || $request->user()->can('timesheets.admin'), 403);
        $rows = TimesheetImportMapping::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function storeMapping(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('timesheets.manage-mappings') || $request->user()->can('timesheets.admin'), 403);
        $data = $request->validate([
            'kind' => ['required', 'string', 'max:32'],
            'historical_value' => ['required', 'string', 'max:255'],
            'nexus_value' => ['nullable', 'string', 'max:255'],
            'mapped_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);
        $row = TimesheetImportMapping::create([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
            'created_by' => $request->user()->id,
            'is_active' => true,
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('timesheets.manage-import-templates') || $request->user()->can('timesheets.admin'), 403);
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx', 'max:5120']]);
        $file = $request->file('file');
        $contents = file_get_contents($file->getRealPath() ?: '');
        $version = (int) TimesheetImportTemplate::query()->where('tenant_id', $request->user()->tenant_id)->max('version') + 1;
        $path = sprintf('timesheet-imports/%s/templates/v%s.xlsx', $request->user()->tenant_id, $version);
        Storage::disk('local')->put($path, $contents);
        TimesheetImportTemplate::query()->where('tenant_id', $request->user()->tenant_id)->update(['is_current' => false]);
        $row = TimesheetImportTemplate::create([
            'tenant_id' => $request->user()->tenant_id,
            'version' => $version,
            'filename' => $file->getClientOriginalName() ?: NexusTimesheetTemplateWorkbook::FILENAME,
            'storage_path' => $path,
            'file_hash' => hash('sha256', $contents ?: ''),
            'is_current' => true,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $row], 201);
    }
}
