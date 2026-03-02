<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('vendors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('registration_number')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('address')->nullable();
            $table->boolean('is_approved')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('procurement_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference_number')->unique();
            $table->string('title');
            $table->text('description');
            $table->string('category'); // goods, services, works
            $table->decimal('estimated_value', 12, 2);
            $table->string('currency', 3)->default('USD');
            $table->string('procurement_method')->default('quotation'); // quotation, tender, direct
            $table->string('status')->default('draft'); // draft, submitted, approved, rejected, awarded
            $table->string('budget_line')->nullable();
            $table->text('justification')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->date('required_by_date')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('procurement_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->integer('quantity')->default(1);
            $table->string('unit')->default('unit');
            $table->decimal('estimated_unit_price', 10, 2)->default(0);
            $table->decimal('total_price', 10, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('procurement_quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vendor_id')->nullable()->constrained()->nullOnDelete();
            $table->string('vendor_name'); // fallback if vendor not in system
            $table->decimal('quoted_amount', 12, 2);
            $table->string('currency', 3)->default('USD');
            $table->boolean('is_recommended')->default(false);
            $table->text('notes')->nullable();
            $table->date('quote_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('procurement_quotes');
        Schema::dropIfExists('procurement_items');
        Schema::dropIfExists('procurement_requests');
        Schema::dropIfExists('vendors');
    }
};
