<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('setup_completed')
                  ->default(false)
                  ->after('must_reset_password');
        });

        // Existing users who already have their password set are considered
        // to have completed setup so they aren't forced through the wizard.
        DB::statement("UPDATE users SET setup_completed = true WHERE must_reset_password = false OR must_reset_password IS NULL");
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('setup_completed');
        });
    }
};
