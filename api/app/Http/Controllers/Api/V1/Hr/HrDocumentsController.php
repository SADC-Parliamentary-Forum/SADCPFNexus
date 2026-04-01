<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\HrFileDocument;
use App\Models\HrPersonalFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrDocumentsController extends Controller
{
    /**
     * Aggregated list of HR file documents.
     * HR admin / system admin see all documents in the tenant.
     * Regular staff see only documents belonging to their own HR personal file.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $isHrAdmin = $user->isSystemAdmin() || $user->hasPermissionTo('hr.admin');

        $query = HrFileDocument::where('hr_file_documents.tenant_id', $tenantId)
            ->with([
                'hrFile:id,employee_id',
                'hrFile.employee:id,name,email',
                'uploadedBy:id,name,email',
            ])
            ->orderByDesc('created_at');

        if (! $isHrAdmin) {
            // Only show documents from the user's own HR personal file
            $fileId = HrPersonalFile::where('tenant_id', $tenantId)
                ->where('employee_id', $user->id)
                ->value('id');

            if (! $fileId) {
                return response()->json(['data' => [], 'total' => 0]);
            }
            $query->where('hr_file_id', $fileId);
        }

        // Optional filters
        if ($documentType = $request->input('document_type')) {
            $query->where('document_type', $documentType);
        }
        if ($confidentiality = $request->input('confidentiality_level')) {
            $query->where('confidentiality_level', $confidentiality);
        }
        if ($fileId = $request->input('hr_file_id')) {
            $query->where('hr_file_id', (int) $fileId);
        }
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('document_type', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 25), 100);
        $paginated = $query->paginate($perPage);

        return response()->json($paginated);
    }
}
