<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Payslip;
use App\Models\User;
use App\Modules\Finance\Services\PayslipAutoFillService;
use App\Modules\Finance\Services\PayslipDistributionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayslipController extends Controller
{
    /** Check that the authenticated user has payslip management access. */
    private function authorizePayslipAccess(Request $request): void
    {
        $user = $request->user();
        $allowed = $user->isSystemAdmin()
            || $user->hasPermissionTo('hr.admin')
            || $user->hasAnyRole(['HR Manager', 'HR Administrator']);
        abort_if(!$allowed, 403, 'Insufficient permissions to manage payslips.');
    }

    /**
     * List all payslips in the authenticated user's tenant (for admin view).
     * Optional filters: user_id, employee_number, search (name/email).
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        $tenantId = $request->user()->tenant_id;
        $perPage = (int) $request->get('per_page', 50);

        $query = Payslip::where('tenant_id', $tenantId)
            ->with('user:id,name,email,employee_number');

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->user_id);
        }

        if ($request->filled('employee_number')) {
            $term = '%' . $request->employee_number . '%';
            $query->whereHas('user', function ($q) use ($term) {
                $q->where('employee_number', 'ilike', $term);
            });
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->whereHas('user', function ($q) use ($term) {
                $q->where('name', 'ilike', $term)
                    ->orWhere('email', 'ilike', $term)
                    ->orWhere('employee_number', 'ilike', $term);
            });
        }

        if ($request->filled('period_month')) {
            $query->where('period_month', (int) $request->period_month);
        }
        if ($request->filled('period_year')) {
            $query->where('period_year', (int) $request->period_year);
        }
        if ($request->filled('confirmation_status')) {
            $query->where('confirmation_status', (string) $request->confirmation_status);
        }

        $payslips = $query
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->paginate($perPage);

        $payslips->getCollection()->each->append(['has_file', 'period_label']);

        return response()->json($payslips);
    }

    public function match(Request $request, PayslipDistributionService $distribution): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        $hasFiles = $request->hasFile('files');
        $data = $request->validate([
            'filenames' => [$hasFiles ? 'nullable' : 'required', 'array', 'min:1', 'max:80'],
            'filenames.*' => ['required', 'string', 'max:255'],
            'files' => [$hasFiles ? 'required' : 'nullable', 'array', 'min:1', 'max:80'],
            'files.*' => ['file', 'max:25600', 'mimes:pdf,xlsx,xls,zip'],
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'period_year' => ['required', 'integer', 'min:2020', 'max:2100'],
        ]);

        if ($hasFiles) {
            /** @var list<UploadedFile> $files */
            $files = array_values(array_filter(
                $request->file('files', []) ?? [],
                fn ($f) => $f instanceof UploadedFile
            ));

            return response()->json([
                'data' => $distribution->previewFromUploads(
                    $request->user(),
                    $files,
                    (int) $data['period_month'],
                    (int) $data['period_year'],
                ),
            ]);
        }

        return response()->json([
            'data' => $distribution->preview(
                $request->user(),
                array_values($data['filenames']),
                (int) $data['period_month'],
                (int) $data['period_year'],
            ),
        ]);
    }

    public function directory(Request $request, PayslipDistributionService $distribution): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
        ]);
        $rows = $distribution->directory($request->user(), $data['q'] ?? null)
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'employee_number' => $u->employee_number,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function periodCoverage(Request $request, PayslipDistributionService $distribution): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        $data = $request->validate([
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'period_year' => ['required', 'integer', 'min:2020', 'max:2100'],
        ]);

        return response()->json([
            'data' => $distribution->periodCoverage(
                $request->user(),
                (int) $data['period_month'],
                (int) $data['period_year'],
            ),
        ]);
    }

    public function distribute(Request $request, PayslipDistributionService $distribution): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        $data = $request->validate([
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'period_year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'files' => ['required', 'array', 'min:1', 'max:80'],
            'files.*' => ['file', 'max:25600', 'mimes:pdf,xlsx,xls,zip'],
            'assignments' => ['nullable'],
        ]);

        $assignments = $data['assignments'] ?? [];
        if (is_string($assignments)) {
            if (trim($assignments) === '') {
                $assignments = [];
            } else {
                $decoded = json_decode($assignments, true);
                if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
                    return response()->json(['message' => 'Assignments must be valid JSON.'], 422);
                }
                $assignments = $decoded;
            }
        }
        if (! is_array($assignments)) {
            $assignments = [];
        }
        $assignments = array_values(array_filter($assignments, function ($row) {
            return is_array($row)
                && isset($row['filename'], $row['user_id'])
                && is_string($row['filename'])
                && $row['filename'] !== ''
                && is_numeric($row['user_id']);
        }));

        /** @var list<UploadedFile> $files */
        $files = array_values(array_filter(
            $request->file('files', []) ?? [],
            fn ($f) => $f instanceof UploadedFile
        ));

        $result = $distribution->distribute(
            $request->user(),
            $files,
            $assignments,
            (int) $data['period_month'],
            (int) $data['period_year'],
        );

        return response()->json([
            'message' => sprintf(
                '%d payslip%s issued%s.',
                $result['issued'] + $result['replaced'],
                ($result['issued'] + $result['replaced']) === 1 ? '' : 's',
                $result['replaced'] > 0 ? sprintf(' (%d replaced)', $result['replaced']) : ''
            ),
            'data' => [
                'issued' => $result['issued'],
                'replaced' => $result['replaced'],
                'failed' => $result['failed'],
                'payslips' => array_map(
                    fn (Payslip $p) => $p->append(['has_file', 'period_label']),
                    $result['payslips']
                ),
            ],
        ], 201);
    }

    /**
     * Show a single payslip (tenant-scoped).
     */
    public function show(Request $request, Payslip $payslip): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        if ((int) $payslip->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $payslip->load('user:id,name,email,employee_number');
        $payslip->append(['has_file', 'period_label']);
        return response()->json($payslip);
    }

    /**
     * Stream payslip file (tenant-scoped).
     */
    public function download(Request $request, Payslip $payslip): JsonResponse|StreamedResponse
    {
        $this->authorizePayslipAccess($request);
        if ((int) $payslip->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if (! $payslip->file_path || ! Storage::disk('local')->exists($payslip->file_path)) {
            return response()->json([
                'message' => 'Payslip document not yet available.',
                'payslip' => $payslip->only(['id', 'period_month', 'period_year', 'net_amount', 'gross_amount', 'currency']),
            ], 404);
        }
        $ext = pathinfo($payslip->file_path, PATHINFO_EXTENSION) ?: 'pdf';
        $filename = sprintf('payslip-%d-%02d-%d.%s', $payslip->period_year, $payslip->period_month, $payslip->id, $ext);
        $stream = Storage::disk('local')->readStream($payslip->file_path);
        return response()->streamDownload(function () use ($stream) {
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }

    /**
     * Upload or replace a single payslip (multipart: file, user_id, period_month, period_year).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        $request->validate([
            'file'          => ['required', 'file', 'mimes:pdf,xlsx,xls', 'max:25600'],
            'user_id'       => ['required', 'integer', 'exists:users,id'],
            'period_month'  => ['required', 'integer', 'min:1', 'max:12'],
            'period_year'   => ['required', 'integer', 'min:2020', 'max:2100'],
        ]);

        $tenantId = $request->user()->tenant_id;
        $user = User::where('id', $request->user_id)->where('tenant_id', $tenantId)->first();
        if (! $user) {
            return response()->json(['message' => 'User not found in tenant.'], 404);
        }

        $file = $request->file('file');
        $dir = sprintf('payslips/%s/%s', $tenantId, $user->id);
        $path = $file->storeAs($dir, sprintf('%d-%02d.%s', $request->period_year, $request->period_month, $file->getClientOriginalExtension() ?: 'pdf'), 'local');

        $payslip = Payslip::updateOrCreate(
            [
                'tenant_id'    => $tenantId,
                'user_id'      => $user->id,
                'period_year'  => (int) $request->period_year,
                'period_month' => (int) $request->period_month,
            ],
            [
                'file_path'     => $path,
                'gross_amount'  => $request->get('gross_amount', 0),
                'net_amount'    => $request->get('net_amount', 0),
                'currency'      => $request->get('currency', 'NAD'),
                'issued_at'     => now(),
            ]
        );
        $payslip->load('user:id,name,email,employee_number');
        $payslip->append(['has_file', 'period_label']);

        AuditLog::record('finance.payslip.uploaded', [
            'tenant_id' => $tenantId,
            'user_id' => $request->user()->id,
            'auditable_type' => Payslip::class,
            'auditable_id' => $payslip->id,
            'new_values' => [
                'subject_user_id' => $user->id,
                'period_month' => (int) $request->period_month,
                'period_year' => (int) $request->period_year,
            ],
            'tags' => ['payslips', 'hr'],
        ]);

        // Auto-fill payslip details from system data
        try {
            app(PayslipAutoFillService::class)->fill($payslip->fresh('user'));
        } catch (\Throwable $e) {
            Log::error('Payslip auto-fill failed', ['payslip_id' => $payslip->id, 'error' => $e->getMessage()]);
        }

        return response()->json([
            'message' => 'Payslip saved.',
            'data'    => $payslip->fresh('user'),
        ], 201);
    }

    /**
     * Manually re-run auto-fill for a payslip (e.g. after grade or allowance data changes).
     */
    public function refresh(Request $request, Payslip $payslip): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        if ((int) $payslip->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $refreshed = app(PayslipAutoFillService::class)->fill($payslip->load('user'));

        return response()->json([
            'message' => 'Payslip auto-fill completed.',
            'data'    => $refreshed->fresh('user'),
        ]);
    }

    /**
     * Delete a payslip (tenant-scoped). Optionally remove file from storage.
     */
    public function destroy(Request $request, Payslip $payslip): JsonResponse
    {
        $this->authorizePayslipAccess($request);
        if ((int) $payslip->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ($payslip->file_path && Storage::disk('local')->exists($payslip->file_path)) {
            Storage::disk('local')->delete($payslip->file_path);
        }
        $payslip->delete();
        return response()->json(['message' => 'Payslip deleted.']);
    }
}
