<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_years', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('label');
            $table->date('starts_on');
            $table->date('ends_on');
            $table->string('status', 40)->default('planned');
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('funding_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 40);
            $table->string('name');
            $table->string('type', 40)->default('other');
            $table->string('donor')->nullable();
            $table->string('agreement_reference')->nullable();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('currency', 3)->default('NAD');
            $table->json('restrictions')->nullable();
            $table->text('reporting_requirements')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::table('budgets', function (Blueprint $table) {
            if (! Schema::hasColumn('budgets', 'financial_year_id')) {
                $table->foreignId('financial_year_id')->nullable()->after('tenant_id')->constrained('financial_years')->nullOnDelete();
            }
            if (! Schema::hasColumn('budgets', 'status')) {
                $table->string('status', 40)->default('active')->after('type');
            }
        });

        Schema::table('budget_lines', function (Blueprint $table) {
            if (! Schema::hasColumn('budget_lines', 'code')) {
                $table->string('code', 60)->nullable()->after('budget_id');
            }
            if (! Schema::hasColumn('budget_lines', 'name')) {
                $table->string('name')->nullable()->after('code');
            }
            if (! Schema::hasColumn('budget_lines', 'funding_source_id')) {
                $table->foreignId('funding_source_id')->nullable()->after('name')->constrained('funding_sources')->nullOnDelete();
            }
            if (! Schema::hasColumn('budget_lines', 'programme_id')) {
                $table->foreignId('programme_id')->nullable()->after('funding_source_id')->constrained('programmes')->nullOnDelete();
            }
            if (! Schema::hasColumn('budget_lines', 'department_id')) {
                $table->foreignId('department_id')->nullable()->after('programme_id')->constrained('departments')->nullOnDelete();
            }
            if (! Schema::hasColumn('budget_lines', 'original_allocation')) {
                $table->decimal('original_allocation', 15, 2)->nullable()->after('amount_allocated');
            }
            if (! Schema::hasColumn('budget_lines', 'revised_allocation')) {
                $table->decimal('revised_allocation', 15, 2)->nullable()->after('original_allocation');
            }
            if (! Schema::hasColumn('budget_lines', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('amount_spent');
            }
            if (! Schema::hasColumn('budget_lines', 'gl_account_code')) {
                $table->string('gl_account_code', 60)->nullable()->after('account_code');
            }
            if (! Schema::hasColumn('budget_lines', 'parent_line_id')) {
                $table->foreignId('parent_line_id')->nullable()->after('budget_id')->constrained('budget_lines')->nullOnDelete();
            }
        });

        Schema::table('budget_reservations', function (Blueprint $table) {
            if (! Schema::hasColumn('budget_reservations', 'budget_line_id')) {
                $table->foreignId('budget_line_id')->nullable()->after('budget_line')->constrained('budget_lines')->nullOnDelete();
            }
            if (! Schema::hasColumn('budget_reservations', 'commitment_chain_id')) {
                $table->uuid('commitment_chain_id')->nullable()->after('id');
            }
            if (! Schema::hasColumn('budget_reservations', 'parent_commitment_id')) {
                $table->foreignId('parent_commitment_id')->nullable()->after('commitment_chain_id')
                    ->constrained('budget_reservations')->nullOnDelete();
            }
            if (! Schema::hasColumn('budget_reservations', 'source_type')) {
                $table->string('source_type', 40)->nullable()->after('budget_line_id');
            }
            if (! Schema::hasColumn('budget_reservations', 'source_id')) {
                $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            }
            if (! Schema::hasColumn('budget_reservations', 'source_key')) {
                $table->string('source_key', 120)->nullable()->after('source_id');
            }
            if (! Schema::hasColumn('budget_reservations', 'idempotency_key')) {
                $table->string('idempotency_key', 120)->nullable()->after('source_key');
            }
            if (! Schema::hasColumn('budget_reservations', 'original_amount')) {
                $table->decimal('original_amount', 15, 2)->nullable()->after('reserved_amount');
            }
            if (! Schema::hasColumn('budget_reservations', 'current_amount')) {
                $table->decimal('current_amount', 15, 2)->nullable()->after('original_amount');
            }
            if (! Schema::hasColumn('budget_reservations', 'status')) {
                $table->string('status', 40)->default('reserved')->after('current_amount');
            }
            if (! Schema::hasColumn('budget_reservations', 'reserved_at')) {
                $table->timestamp('reserved_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('budget_reservations', 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('reserved_at');
            }
            if (! Schema::hasColumn('budget_reservations', 'consumed_at')) {
                $table->timestamp('consumed_at')->nullable()->after('released_at');
            }
            if (! Schema::hasColumn('budget_reservations', 'programme_id')) {
                $table->foreignId('programme_id')->nullable()->after('travel_request_id')->constrained('programmes')->nullOnDelete();
            }
        });

        // Unique indexes (nullable-safe in Postgres)
        Schema::table('budget_reservations', function (Blueprint $table) {
            $table->index(['tenant_id', 'budget_line_id', 'status']);
            $table->index(['commitment_chain_id']);
            $table->index(['source_type', 'source_id']);
        });

        if (! $this->hasIndex('budget_reservations', 'budget_reservations_tenant_id_source_key_unique')) {
            Schema::table('budget_reservations', function (Blueprint $table) {
                $table->unique(['tenant_id', 'source_key'], 'budget_reservations_tenant_id_source_key_unique');
            });
        }

        Schema::create('budget_commitment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_reservation_id')->constrained('budget_reservations')->cascadeOnDelete();
            $table->string('type', 40);
            $table->decimal('amount', 15, 2);
            $table->decimal('balance_after', 15, 2);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['budget_reservation_id', 'type']);
        });

        Schema::create('budget_actual_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('budget_line_id')->constrained('budget_lines')->cascadeOnDelete();
            $table->foreignId('financial_year_id')->nullable()->constrained('financial_years')->nullOnDelete();
            $table->string('accounting_reference');
            $table->date('transaction_date');
            $table->date('posting_date')->nullable();
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('NAD');
            $table->decimal('base_currency_amount', 15, 2)->nullable();
            $table->decimal('fx_rate', 18, 8)->nullable();
            $table->string('vendor_payee')->nullable();
            $table->text('description')->nullable();
            $table->string('source_module', 40)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('import_batch', 80)->nullable();
            $table->string('reconciliation_status', 40)->default('unmatched');
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'budget_line_id']);
            $table->index(['accounting_reference']);
            $table->unique(['tenant_id', 'accounting_reference', 'budget_line_id'], 'budget_actuals_tenant_ref_line_unique');
        });

        if (Schema::hasTable('programme_budget_lines') && ! Schema::hasColumn('programme_budget_lines', 'org_budget_line_id')) {
            Schema::table('programme_budget_lines', function (Blueprint $table) {
                $table->foreignId('org_budget_line_id')->nullable()->after('account_code')
                    ->constrained('budget_lines')->nullOnDelete();
            });
        }

        // Backfill commitment amounts / chain for existing reservations
        DB::table('budget_reservations')->orderBy('id')->chunkById(200, function ($rows) {
            foreach ($rows as $row) {
                $updates = [];
                if (empty($row->commitment_chain_id)) {
                    $updates['commitment_chain_id'] = (string) Str::uuid();
                }
                if ($row->original_amount === null) {
                    $updates['original_amount'] = $row->reserved_amount;
                }
                if ($row->current_amount === null) {
                    $updates['current_amount'] = $row->released_at ? 0 : $row->reserved_amount;
                }
                if (empty($row->status) || $row->status === 'reserved') {
                    $updates['status'] = $row->released_at ? 'released' : 'confirmed';
                }
                if (empty($row->reserved_at)) {
                    $updates['reserved_at'] = $row->created_at;
                }
                if (empty($row->source_key)) {
                    if (! empty($row->procurement_request_id)) {
                        $updates['source_type'] = 'procurement';
                        $updates['source_id'] = $row->procurement_request_id;
                        $updates['source_key'] = 'PROCUREMENT:'.$row->procurement_request_id;
                    } elseif (! empty($row->travel_request_id)) {
                        $updates['source_type'] = 'travel';
                        $updates['source_id'] = $row->travel_request_id;
                        $updates['source_key'] = 'TRAVEL:'.$row->travel_request_id;
                    } else {
                        $updates['source_type'] = 'manual';
                        $updates['source_id'] = $row->id;
                        $updates['source_key'] = 'LEGACY:'.$row->id;
                    }
                }
                if ($updates !== []) {
                    DB::table('budget_reservations')->where('id', $row->id)->update($updates);
                }
            }
        });

        DB::table('budget_lines')->whereNull('original_allocation')->update([
            'original_allocation' => DB::raw('amount_allocated'),
        ]);

        $this->grantIfPossible([
            'financial_years',
            'funding_sources',
            'budget_commitment_transactions',
            'budget_actual_transactions',
        ]);
    }

    public function down(): void
    {
        if (Schema::hasTable('programme_budget_lines') && Schema::hasColumn('programme_budget_lines', 'org_budget_line_id')) {
            Schema::table('programme_budget_lines', function (Blueprint $table) {
                $table->dropConstrainedForeignId('org_budget_line_id');
            });
        }

        Schema::dropIfExists('budget_actual_transactions');
        Schema::dropIfExists('budget_commitment_transactions');

        Schema::table('budget_reservations', function (Blueprint $table) {
            foreach ([
                'programme_id', 'consumed_at', 'confirmed_at', 'reserved_at', 'status',
                'current_amount', 'original_amount', 'idempotency_key', 'source_key',
                'source_id', 'source_type', 'budget_line_id', 'parent_commitment_id', 'commitment_chain_id',
            ] as $col) {
                if (Schema::hasColumn('budget_reservations', $col)) {
                    try {
                        if (in_array($col, ['programme_id', 'budget_line_id', 'parent_commitment_id'], true)) {
                            $table->dropConstrainedForeignId($col);
                        } else {
                            $table->dropColumn($col);
                        }
                    } catch (\Throwable) {
                        // ignore drop order issues in down()
                    }
                }
            }
        });

        Schema::table('budget_lines', function (Blueprint $table) {
            foreach ([
                'parent_line_id', 'gl_account_code', 'is_active', 'revised_allocation',
                'original_allocation', 'department_id', 'programme_id', 'funding_source_id', 'name', 'code',
            ] as $col) {
                if (Schema::hasColumn('budget_lines', $col)) {
                    try {
                        if (in_array($col, ['parent_line_id', 'department_id', 'programme_id', 'funding_source_id'], true)) {
                            $table->dropConstrainedForeignId($col);
                        } else {
                            $table->dropColumn($col);
                        }
                    } catch (\Throwable) {
                        // ignore
                    }
                }
            }
        });

        Schema::table('budgets', function (Blueprint $table) {
            if (Schema::hasColumn('budgets', 'financial_year_id')) {
                $table->dropConstrainedForeignId('financial_year_id');
            }
            if (Schema::hasColumn('budgets', 'status')) {
                $table->dropColumn('status');
            }
        });

        Schema::dropIfExists('funding_sources');
        Schema::dropIfExists('financial_years');
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $rows = DB::select(
            'SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
            [$table, $indexName]
        );

        return $rows !== [];
    }

    private function grantIfPossible(array $tables): void
    {
        foreach ($tables as $table) {
            try {
                DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO app_user");
                DB::statement("GRANT USAGE, SELECT ON SEQUENCE {$table}_id_seq TO app_user");
            } catch (\Throwable) {
                // app_user may not exist in local/test
            }
        }
    }
};
