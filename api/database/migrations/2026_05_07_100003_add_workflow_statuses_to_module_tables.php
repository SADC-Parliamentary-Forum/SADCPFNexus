<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add returned_for_correction, resubmitted, and withdrawn status values
 * to all workflow-enabled module tables.
 *
 * All status columns are plain strings (not DB enums), so no ALTER TYPE is needed.
 * This migration adds no-op comments to document the expanded value set.
 */
return new class extends Migration
{
    public function up(): void
    {
        // imprest_requests needs a returned_for_correction path; add liquidated as alias already in code
        // All tables already use string columns — nothing to ALTER.
        // This migration serves as documentation and a checkpoint; no DDL required.
    }

    public function down(): void
    {
        // Nothing to reverse.
    }
};
