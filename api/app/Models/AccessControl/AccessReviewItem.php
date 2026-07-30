<?php

namespace App\Models\AccessControl;

/**
 * Thin alias over People & Authority access_review_items (do not create a parallel table).
 */
class AccessReviewItem extends \App\Models\PeopleAuthority\AccessReviewItem
{
    public function roleNameFromSnapshot(): ?string
    {
        $snap = $this->subject_snapshot;
        if (is_array($snap) && isset($snap['role'])) {
            return (string) $snap['role'];
        }

        return null;
    }
}
