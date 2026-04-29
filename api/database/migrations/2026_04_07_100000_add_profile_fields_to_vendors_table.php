<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->string('contact_name')->nullable()->after('name');
            $table->string('website')->nullable()->after('contact_phone');
            $table->string('tax_number', 100)->nullable()->after('registration_number');
            $table->string('country', 100)->nullable()->after('address');
            $table->string('category', 100)->nullable()->after('country');
            $table->string('payment_terms', 50)->nullable()->after('category');
            $table->string('bank_name')->nullable()->after('payment_terms');
            $table->string('bank_account', 100)->nullable()->after('bank_name');
            $table->string('bank_branch')->nullable()->after('bank_account');
            $table->boolean('is_sme')->default(false)->after('is_active');
            $table->text('notes')->nullable()->after('is_sme');
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn([
                'contact_name', 'website', 'tax_number', 'country', 'category',
                'payment_terms', 'bank_name', 'bank_account', 'bank_branch',
                'is_sme', 'notes',
            ]);
        });
    }
};
