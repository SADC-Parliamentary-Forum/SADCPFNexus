<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->string('invoice_number', 64)->nullable()->after('notes');
            $table->string('invoice_path')->nullable()->after('invoice_number');
            $table->date('purchase_date')->nullable()->after('invoice_path');
            $table->decimal('purchase_value', 12, 2)->nullable()->after('purchase_date');
            $table->unsignedInteger('useful_life_years')->nullable()->after('purchase_value');
            $table->decimal('salvage_value', 12, 2)->nullable()->after('useful_life_years');
            $table->string('depreciation_method', 32)->nullable()->after('salvage_value');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn([
                'invoice_number',
                'invoice_path',
                'purchase_date',
                'purchase_value',
                'useful_life_years',
                'salvage_value',
                'depreciation_method',
            ]);
        });
    }
};
