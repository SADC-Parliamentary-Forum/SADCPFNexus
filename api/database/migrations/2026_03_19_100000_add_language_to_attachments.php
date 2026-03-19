<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            $table->string('language', 8)->nullable()->after('document_type')
                ->comment('ISO 639-1 code: en, fr, pt');
        });

        DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON attachments TO app_user");
    }

    public function down(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            $table->dropColumn('language');
        });
    }
};
