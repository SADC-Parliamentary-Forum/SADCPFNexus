<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('password_reset_tokens')) {
            Schema::create('password_reset_tokens', function (Blueprint $table) {
                $table->string('email')->primary();
                $table->string('token');
                $table->timestamp('created_at')->nullable();
            });
        }

        $this->addUserLifecycleColumns();

        if (! Schema::hasTable('account_invitations')) {
            Schema::create('account_invitations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('invited_by_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('email')->index();
                $table->string('token_hash', 64)->unique();
                $table->string('status', 32)->default('pending')->index();
                $table->timestamp('expires_at')->index();
                $table->timestamp('accepted_at')->nullable();
                $table->timestamp('revoked_at')->nullable();
                $table->foreignId('revoked_by_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('superseded_by_id')->nullable()->constrained('account_invitations')->nullOnDelete();
                $table->timestamps();

                $table->index(['user_id', 'status']);
                $table->index(['email', 'status']);
            });
        }

        if (! Schema::hasTable('password_histories')) {
            Schema::create('password_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('password');
                $table->timestamp('created_at')->useCurrent();

                $table->index(['user_id', 'created_at']);
            });
        }

        $this->grantAppUserIfPostgres();
    }

    public function down(): void
    {
        Schema::dropIfExists('password_histories');
        Schema::dropIfExists('account_invitations');

        Schema::table('users', function (Blueprint $table) {
            foreach ([
                'account_status',
                'status_changed_at',
                'suspended_at',
                'disabled_at',
                'offboarded_at',
                'invited_at',
                'activated_at',
                'status_reason',
                'password_changed_at',
            ] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function addUserLifecycleColumns(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'account_status')) {
                $table->string('account_status', 32)->default('active')->after('is_active')->index();
            }
            if (! Schema::hasColumn('users', 'status_changed_at')) {
                $table->timestamp('status_changed_at')->nullable()->after('account_status');
            }
            if (! Schema::hasColumn('users', 'suspended_at')) {
                $table->timestamp('suspended_at')->nullable()->after('status_changed_at');
            }
            if (! Schema::hasColumn('users', 'disabled_at')) {
                $table->timestamp('disabled_at')->nullable()->after('suspended_at');
            }
            if (! Schema::hasColumn('users', 'offboarded_at')) {
                $table->timestamp('offboarded_at')->nullable()->after('disabled_at');
            }
            if (! Schema::hasColumn('users', 'invited_at')) {
                $table->timestamp('invited_at')->nullable()->after('offboarded_at');
            }
            if (! Schema::hasColumn('users', 'activated_at')) {
                $table->timestamp('activated_at')->nullable()->after('invited_at');
            }
            if (! Schema::hasColumn('users', 'status_reason')) {
                $table->text('status_reason')->nullable()->after('activated_at');
            }
            if (! Schema::hasColumn('users', 'password_changed_at')) {
                $table->timestamp('password_changed_at')->nullable()->after('must_reset_password');
            }
        });

        DB::table('users')
            ->whereNull('account_status')
            ->orWhere('account_status', '')
            ->update(['account_status' => DB::raw("CASE WHEN is_active THEN 'active' ELSE 'disabled' END")]);

        DB::table('users')
            ->where('is_active', false)
            ->where('account_status', 'active')
            ->update([
                'account_status' => 'disabled',
                'disabled_at' => now(),
                'status_changed_at' => now(),
            ]);

        if (Schema::hasColumn('users', 'password_changed_at')) {
            DB::table('users')
                ->whereNull('password_changed_at')
                ->update(['password_changed_at' => DB::raw('COALESCE(updated_at, created_at, NOW())')]);
        }
    }

    private function grantAppUserIfPostgres(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach (['account_invitations', 'password_histories'] as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::statement('SAVEPOINT auth_lifecycle_grant_'.$table);
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
                DB::statement('RELEASE SAVEPOINT auth_lifecycle_grant_'.$table);
            } catch (\Throwable) {
                DB::statement('ROLLBACK TO SAVEPOINT auth_lifecycle_grant_'.$table);
            }
        }
    }
};
