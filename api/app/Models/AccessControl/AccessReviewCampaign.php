<?php

namespace App\Models\AccessControl;

/**
 * @deprecated Prefer PeopleAuthority\AccessReviewCampaign — kept as alias for Access Control MVP.
 */
class AccessReviewCampaign extends \App\Models\PeopleAuthority\AccessReviewCampaign
{
    public function items()
    {
        return $this->hasMany(AccessReviewItem::class, 'campaign_id');
    }
}
