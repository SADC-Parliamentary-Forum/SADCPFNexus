<?php

use App\Models\Tenant;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const TEMPLATES = [
        [
            'code' => 'CONTRACT_TERMINATION_NOTICE',
            'name' => 'Contract Termination Notice',
            'subject_template' => 'Notice of Termination — Contract {{contract_number}}',
            'body_template' => "This serves as formal notice that Contract {{contract_number}} ({{contract_title}}) with {{counterparty_name}} is terminated effective {{effective_date}}.\n\nReason for termination: {{reason}}\n\nThis notice is generated automatically upon contract termination in Nexus and should be reviewed before dispatch.",
        ],
        [
            'code' => 'CONTRACT_AMENDMENT_NOTICE',
            'name' => 'Contract Amendment Notice',
            'subject_template' => 'Notice of Amendment — Contract {{contract_number}}, Amendment {{amendment_reference}}',
            'body_template' => "This serves as notice that Contract {{contract_number}} ({{contract_title}}) with {{counterparty_name}} has been amended under reference {{amendment_reference}}.\n\nReason for amendment: {{reason}}\n\nRevised contract value: {{revised_value}}\n\nThis notice is generated automatically upon a material contract amendment in Nexus and should be reviewed before dispatch.",
        ],
    ];

    public function up(): void
    {
        $now = now();

        foreach (Tenant::all() as $tenant) {
            foreach (self::TEMPLATES as $template) {
                DB::table('correspondence_letter_templates')->insertOrIgnore([
                    'tenant_id' => $tenant->id,
                    'created_by' => null,
                    'name' => $template['name'],
                    'code' => $template['code'],
                    'subject_template' => $template['subject_template'],
                    'body_template' => $template['body_template'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('correspondence_letter_templates')
            ->whereIn('code', array_column(self::TEMPLATES, 'code'))
            ->delete();
    }
};
