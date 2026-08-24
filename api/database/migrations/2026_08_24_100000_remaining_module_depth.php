<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('tenders') && ! Schema::hasColumn('tenders', 'newspaper_checklist')) {
            Schema::table('tenders', function (Blueprint $table) {
                $table->json('newspaper_checklist')->nullable();
            });
        }

        if (! Schema::hasTable('stock_event_packs')) {
            Schema::create('stock_event_packs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->string('name');
                $table->string('event_type', 64)->default('general');
                $table->text('notes')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->index(['tenant_id', 'event_type']);
            });
        }

        if (! Schema::hasTable('stock_event_pack_lines')) {
            Schema::create('stock_event_pack_lines', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('stock_event_pack_id');
                $table->unsignedBigInteger('stock_item_id');
                $table->unsignedInteger('quantity');
                $table->string('notes', 1000)->nullable();
                $table->timestamps();
                $table->index('stock_event_pack_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_event_pack_lines');
        Schema::dropIfExists('stock_event_packs');
        if (Schema::hasTable('tenders') && Schema::hasColumn('tenders', 'newspaper_checklist')) {
            Schema::table('tenders', function (Blueprint $table) {
                $table->dropColumn('newspaper_checklist');
            });
        }
    }
};
