<?php

namespace Database\Seeders;

use App\Models\SupplierCategory;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class SupplierCategorySeeder extends Seeder
{
    public function run(): void
    {
        $tenantId = Tenant::query()->where('is_active', true)->value('id')
            ?? Tenant::query()->value('id');

        $categories = [
            ['name' => 'ICT Equipment & Services',          'code' => 'ict_equipment',       'description' => 'Computers, servers, networking equipment, software licences, and IT support services.'],
            ['name' => 'Office Supplies & Stationery',      'code' => 'office_supplies',      'description' => 'Paper, pens, toner cartridges, filing materials, and general consumables.'],
            ['name' => 'Consulting & Professional Services', 'code' => 'consulting',           'description' => 'Management consulting, advisory services, project management, and specialist expertise.'],
            ['name' => 'Catering & Events',                 'code' => 'catering_events',      'description' => 'Catering for meetings and events, venue hire, and event management services.'],
            ['name' => 'Construction & Maintenance',        'code' => 'construction',         'description' => 'Building works, renovations, plumbing, electrical, air-conditioning, and general facility maintenance.'],
            ['name' => 'Transport & Logistics',             'code' => 'transport',            'description' => 'Vehicle hire, freight, courier services, and travel logistics.'],
            ['name' => 'Security Services',                 'code' => 'security',             'description' => 'Manned guarding, CCTV systems, access control, and security consulting.'],
            ['name' => 'Printing & Publishing',             'code' => 'printing',             'description' => 'Offset and digital printing, booklet production, signage, and branded materials.'],
            ['name' => 'Training & Capacity Building',      'code' => 'training',             'description' => 'Workshops, e-learning platforms, facilitation, and skills development programmes.'],
            ['name' => 'Legal Services',                    'code' => 'legal',                'description' => 'Legal advice, contract drafting, litigation support, and compliance services.'],
            ['name' => 'Financial & Audit Services',        'code' => 'audit_finance',        'description' => 'External audit, internal audit, tax advisory, and accounting services.'],
            ['name' => 'Communication & Media',             'code' => 'communication_media',  'description' => 'Public relations, media buying, graphic design, photography, and videography.'],
            ['name' => 'Cleaning & Facilities Management',  'code' => 'cleaning_facilities',  'description' => 'Office cleaning, landscaping, waste management, and facilities management.'],
            ['name' => 'Medical & Health Supplies',         'code' => 'medical_health',       'description' => 'First-aid supplies, PPE, medical equipment, and health-related consumables.'],
            ['name' => 'Research & Documentation',          'code' => 'research_docs',        'description' => 'Research services, report writing, translation, interpretation, and documentation.'],
            ['name' => 'Translation & Interpretation',      'code' => 'translation_interpretation', 'description' => 'Written translation, simultaneous and consecutive interpretation, and language services.'],
        ];

        foreach ($categories as $cat) {
            SupplierCategory::firstOrCreate(
                ['tenant_id' => $tenantId, 'code' => $cat['code']],
                [
                    'name'        => $cat['name'],
                    'description' => $cat['description'],
                    'is_active'   => true,
                ]
            );
        }
    }
}
