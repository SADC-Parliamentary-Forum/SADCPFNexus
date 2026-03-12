<?php
namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrPersonalFile;
use App\Models\HrFileDocument;
use App\Models\HrFileTimelineEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrPersonalFileController extends Controller
{
    private function canViewFile(HrPersonalFile $file, $user): bool
    {
        if ($user->isSystemAdmin() || $user->hasPermissionTo('hr.admin')) return true;
        if ($file->employee_id === $user->id) return true;
        if ($file->supervisor_id === $user->id && $user->hasPermissionTo('hr.supervisor')) return true;
        return false;
    }

    private function canEditFile(HrPersonalFile $file, $user): bool
    {
        return $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = HrPersonalFile::where('tenant_id', $user->tenant_id)
            ->with(['employee:id,name,email', 'department:id,name', 'supervisor:id,name,email']);

        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('hr.admin')) {
            if ($user->hasPermissionTo('hr.supervisor')) {
                $query->where(function ($q) use ($user) {
                    $q->where('employee_id', $user->id)->orWhere('supervisor_id', $user->id);
                });
            } else {
                $query->where('employee_id', $user->id);
            }
        }

        if ($request->input('file_status')) $query->where('file_status', $request->input('file_status'));
        if ($request->input('employment_status')) $query->where('employment_status', $request->input('employment_status'));
        if ($request->input('probation_status')) $query->where('probation_status', $request->input('probation_status'));
        if ($request->input('department_id')) $query->where('department_id', (int) $request->input('department_id'));
        if ($request->input('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->whereHas('employee', fn ($q) => $q->where('name', 'like', $search)->orWhere('email', 'like', $search));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);
        return response()->json($query->orderBy('created_at', 'desc')->paginate($perPage));
    }

    public function show(Request $request, HrPersonalFile $hrPersonalFile): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless($this->canViewFile($hrPersonalFile, $user), 403);

        $hrPersonalFile->load([
            'employee:id,name,email',
            'department:id,name',
            'supervisor:id,name,email',
            'hrOfficer:id,name,email',
            'createdBy:id,name,email',
        ]);

        if ($request->boolean('with_documents')) {
            $hrPersonalFile->load('documents');
        }
        if ($request->boolean('with_timeline')) {
            $hrPersonalFile->load(['timelineEvents' => fn ($q) => $q->orderByDesc('event_date')]);
        }

        return response()->json($hrPersonalFile);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSystemAdmin() || $user->hasPermissionTo('hr.admin'), 403);

        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:users,id'],
            'staff_number' => ['nullable', 'string', 'max:64'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:32'],
            'nationality' => ['nullable', 'string', 'max:64'],
            'id_passport_number' => ['nullable', 'string', 'max:64'],
            'marital_status' => ['nullable', 'string', 'max:32'],
            'residential_address' => ['nullable', 'string'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:64'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
            'appointment_date' => ['nullable', 'date'],
            'employment_status' => ['nullable', 'string', 'in:permanent,contract,secondment,acting,probation,separated'],
            'contract_type' => ['nullable', 'string', 'max:64'],
            'probation_status' => ['nullable', 'string', 'in:on_probation,confirmed,extended,terminated,not_applicable'],
            'current_position' => ['nullable', 'string', 'max:255'],
            'grade_scale' => ['nullable', 'string', 'max:64'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'supervisor_id' => ['nullable', 'integer', 'exists:users,id'],
            'contract_expiry_date' => ['nullable', 'date'],
            'payroll_number' => ['nullable', 'string', 'max:64'],
            'current_hr_officer_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $file = HrPersonalFile::create(array_merge($validated, [
            'tenant_id' => $user->tenant_id,
            'created_by' => $user->id,
        ]));

        $file->load(['employee:id,name,email', 'department:id,name', 'supervisor:id,name,email']);
        return response()->json($file, 201);
    }

    public function update(Request $request, HrPersonalFile $hrPersonalFile): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless($this->canEditFile($hrPersonalFile, $user), 403);

        $validated = $request->validate([
            'staff_number' => ['nullable', 'string', 'max:64'],
            'file_status' => ['nullable', 'string', 'in:active,probation,suspended,separated,archived'],
            'confidentiality_classification' => ['nullable', 'string', 'in:standard,restricted,confidential'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:32'],
            'nationality' => ['nullable', 'string', 'max:64'],
            'id_passport_number' => ['nullable', 'string', 'max:64'],
            'marital_status' => ['nullable', 'string', 'max:32'],
            'residential_address' => ['nullable', 'string'],
            'emergency_contact_name' => ['nullable', 'string', 'max:255'],
            'emergency_contact_relationship' => ['nullable', 'string', 'max:64'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
            'next_of_kin_details' => ['nullable', 'string'],
            'appointment_date' => ['nullable', 'date'],
            'employment_status' => ['nullable', 'string', 'in:permanent,contract,secondment,acting,probation,separated'],
            'contract_type' => ['nullable', 'string', 'max:64'],
            'probation_status' => ['nullable', 'string', 'in:on_probation,confirmed,extended,terminated,not_applicable'],
            'confirmation_date' => ['nullable', 'date'],
            'current_position' => ['nullable', 'string', 'max:255'],
            'grade_scale' => ['nullable', 'string', 'max:64'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'supervisor_id' => ['nullable', 'integer', 'exists:users,id'],
            'contract_expiry_date' => ['nullable', 'date'],
            'separation_date' => ['nullable', 'date'],
            'separation_reason' => ['nullable', 'string', 'max:255'],
            'promotion_history' => ['nullable', 'array'],
            'transfer_history' => ['nullable', 'array'],
            'payroll_number' => ['nullable', 'string', 'max:64'],
            'latest_appraisal_summary' => ['nullable', 'string'],
            'active_warning_flag' => ['nullable', 'boolean'],
            'commendation_count' => ['nullable', 'integer', 'min:0'],
            'open_development_action_count' => ['nullable', 'integer', 'min:0'],
            'training_hours_current_cycle' => ['nullable', 'numeric', 'min:0'],
            'last_file_review_date' => ['nullable', 'date'],
            'current_hr_officer_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $hrPersonalFile->update($validated);
        $hrPersonalFile->load(['employee:id,name,email', 'department:id,name', 'supervisor:id,name,email']);
        return response()->json($hrPersonalFile);
    }

    public function timeline(Request $request, HrPersonalFile $hrPersonalFile): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless($this->canViewFile($hrPersonalFile, $user), 403);

        $events = $hrPersonalFile->timelineEvents()
            ->with(['recordedBy:id,name,email'])
            ->orderByDesc('event_date')
            ->get();

        return response()->json(['data' => $events]);
    }

    public function addTimelineEvent(Request $request, HrPersonalFile $hrPersonalFile): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless(
            $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin') || $hrPersonalFile->supervisor_id === $user->id,
            403
        );

        $validated = $request->validate([
            'event_type' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'event_date' => ['required', 'date'],
            'source_module' => ['nullable', 'string', 'max:64'],
            'linked_document_id' => ['nullable', 'integer', 'exists:hr_file_documents,id'],
        ]);

        $event = HrFileTimelineEvent::create(array_merge($validated, [
            'tenant_id' => $user->tenant_id,
            'hr_file_id' => $hrPersonalFile->id,
            'recorded_by' => $user->id,
        ]));

        $event->load('recordedBy:id,name,email');
        return response()->json($event, 201);
    }

    public function documents(Request $request, HrPersonalFile $hrPersonalFile): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless($this->canViewFile($hrPersonalFile, $user), 403);

        $query = $hrPersonalFile->documents()->with(['uploadedBy:id,name,email', 'verifiedBy:id,name,email']);

        // Employees can only see non-confidential documents of their own file
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('hr.admin')) {
            if ($hrPersonalFile->employee_id === $user->id) {
                $query->whereNotIn('confidentiality_level', ['restricted', 'confidential']);
            }
        }

        if ($request->input('document_type')) {
            $query->where('document_type', $request->input('document_type'));
        }

        return response()->json(['data' => $query->orderByDesc('created_at')->get()]);
    }

    public function uploadDocument(Request $request, HrPersonalFile $hrPersonalFile): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless($user->isSystemAdmin() || $user->hasPermissionTo('hr.admin'), 403);

        $validated = $request->validate([
            'document_type' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'confidentiality_level' => ['nullable', 'string', 'in:standard,restricted,confidential'],
            'issue_date' => ['nullable', 'date'],
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date'],
            'source_module' => ['nullable', 'string', 'max:64'],
            'tags' => ['nullable', 'array'],
            'remarks' => ['nullable', 'string'],
        ]);

        $doc = HrFileDocument::create(array_merge($validated, [
            'tenant_id' => $user->tenant_id,
            'hr_file_id' => $hrPersonalFile->id,
            'uploaded_by' => $user->id,
        ]));

        $doc->load('uploadedBy:id,name,email');
        return response()->json($doc, 201);
    }

    public function deleteDocument(Request $request, HrPersonalFile $hrPersonalFile, HrFileDocument $document): JsonResponse
    {
        $user = $request->user();
        abort_unless($hrPersonalFile->tenant_id === $user->tenant_id, 403);
        abort_unless($user->isSystemAdmin() || $user->hasPermissionTo('hr.admin'), 403);
        abort_unless($document->hr_file_id === $hrPersonalFile->id, 404);

        $document->delete();
        return response()->json(['message' => 'Document deleted.']);
    }
}
