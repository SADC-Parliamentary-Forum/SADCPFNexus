<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'removed_at')) {
                $table->timestamp('removed_at')->nullable()->after('offboarded_at');
            }
            // The sign-in email a removed account held, released so a new account can use it.
            if (! Schema::hasColumn('users', 'former_email')) {
                $table->string('former_email')->nullable()->after('email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['removed_at', 'former_email']);
        });
    }
};
