<?php

namespace App\Http\Controllers\Api\V1\HrSettings;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HrPersonnelFileSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PersonnelFileSectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', HrPersonnelFileSection::class);

        $items = HrPersonnelFileSection::where('tenant_id', $request->user()->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('section_name')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', HrPersonnelFileSection::class);

        $data = $request->validate([
            'section_code'            => ['required', 'string', 'max:30'],
            'section_name'            => ['required', 'string', 'max:100'],
            'visibility'              => ['nullable', 'in:employee,hr_only,supervisor,director,sg,hidden'],
            'is_editable_by_employee' => ['nullable', 'boolean'],
            'is_mandatory'            => ['nullable', 'boolean'],
            'retention_months'        => ['nullable', 'integer', 'min:1', 'max:1200'],
            'confidentiality_level'   => ['nullable', 'in:public,restricted,confidential'],
            'sort_order'              => ['nullable', 'integer'],
            'is_active'               => ['nullable', 'boolean'],
        ]);

        $model = HrPersonnelFileSection::create([
            'tenant_id' => $request->user()->tenant_id,
            ...$data,
        ]);

        AuditLog::record('hr_settings.personnel_file_section.created', [
            'auditable_type' => HrPersonnelFileSection::class,
            'auditable_id'   => $model->id,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Personnel file section created.', 'data' => $model], 201);
    }

    public function show(Request $request, HrPersonnelFileSection $personnelFileSection): JsonResponse
    {
        $this->authorize('view', $personnelFileSection);

        return response()->json(['data' => $personnelFileSection]);
    }

    public function update(Request $request, HrPersonnelFileSection $personnelFileSection): JsonResponse
    {
        $this->authorize('update', $personnelFileSection);

        $data = $request->validate([
            'section_code'            => ['sometimes', 'string', 'max:30'],
            'section_name'            => ['sometimes', 'string', 'max:100'],
            'visibility'              => ['nullable', 'in:employee,hr_only,supervisor,director,sg,hidden'],
            'is_editable_by_employee' => ['nullable', 'boolean'],
            'is_mandatory'            => ['nullable', 'boolean'],
            'retention_months'        => ['nullable', 'integer', 'min:1', 'max:1200'],
            'confidentiality_level'   => ['nullable', 'in:public,restricted,confidential'],
            'sort_order'              => ['nullable', 'integer'],
            'is_active'               => ['nullable', 'boolean'],
        ]);

        $old = $personnelFileSection->only(array_keys($data));
        $personnelFileSection->update($data);

        AuditLog::record('hr_settings.personnel_file_section.updated', [
            'auditable_type' => HrPersonnelFileSection::class,
            'auditable_id'   => $personnelFileSection->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Personnel file section updated.', 'data' => $personnelFileSection->fresh()]);
    }

    public function destroy(HrPersonnelFileSection $personnelFileSection): JsonResponse
    {
        $this->authorize('delete', $personnelFileSection);

        $personnelFileSection->delete();

        AuditLog::record('hr_settings.personnel_file_section.deleted', [
            'auditable_type' => HrPersonnelFileSection::class,
            'auditable_id'   => $personnelFileSection->id,
            'tags'           => 'hr_settings',
        ]);

        return response()->json(['message' => 'Personnel file section deleted.']);
    }

    public function reorder(Request $request): JsonResponse
    {
        $this->authorize('create', HrPersonnelFileSection::class);

        $items = $request->validate([
            'items'             => ['required', 'array'],
            'items.*.id'        => ['required', 'integer', 'exists:hr_personnel_file_sections,id'],
            'items.*.sort_order'=> ['required', 'integer'],
        ])['items'];

        foreach ($items as $item) {
            HrPersonnelFileSection::where('id', $item['id'])
                ->where('tenant_id', $request->user()->tenant_id)
                ->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['message' => 'Sections reordered.']);
    }
}
