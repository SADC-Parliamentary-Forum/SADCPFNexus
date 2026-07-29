<?php

namespace App\Modules\Correspondence\Services;

use App\Models\Correspondence;
use App\Models\User;
use Illuminate\Support\Str;

class CorrespondenceArchiveImportService
{
    /**
     * Light multilingual archive import from structured rows.
     *
     * @param  array<int, array{reference?: string, subject?: string, language?: string, language_tags?: array, body?: string}>  $rows
     * @return array{imported: int, items: array}
     */
    public function importRows(array $rows, User $user): array
    {
        $items = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $subject = trim((string) ($row['subject'] ?? 'Archive import'));
            $language = strtolower((string) ($row['language'] ?? 'en'));
            if (! in_array($language, ['en', 'fr', 'pt'], true)) {
                $language = 'en';
            }
            $tags = $row['language_tags'] ?? [$language];
            if (! is_array($tags)) {
                $tags = [$language];
            }

            $corr = Correspondence::create([
                'tenant_id' => $user->tenant_id,
                'reference_number' => $row['reference'] ?? ('ARC-'.strtoupper(Str::random(8))),
                'title' => Str::limit($subject, 240),
                'subject' => Str::limit($subject, 240),
                'body' => $row['body'] ?? null,
                'language' => $language,
                'language_tags' => array_values($tags),
                'type' => 'external',
                'direction' => 'incoming',
                'status' => 'draft',
                'confidentiality' => 'general_official',
                'created_by' => $user->id,
                'registered_by' => $user->id,
                'registered_at' => now(),
            ]);

            $items[] = [
                'id' => $corr->id,
                'reference_number' => $corr->reference_number,
                'language' => $corr->language,
                'language_tags' => $corr->language_tags,
            ];
        }

        return ['imported' => count($items), 'items' => $items];
    }
}
