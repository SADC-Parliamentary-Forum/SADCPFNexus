<?php

namespace Tests\Unit\Workplan;

use App\Modules\Workplan\WorkplanMeetingTypeCatalog;
use PHPUnit\Framework\TestCase;

class WorkplanMeetingTypeCatalogTest extends TestCase
{
    public function test_catalog_includes_spreadsheet_meeting_types(): void
    {
        $names = WorkplanMeetingTypeCatalog::names();
        foreach ([
            'Review Meeting',
            'Meeting',
            'Training / Capacity Building',
            'Conference',
            'Assembly',
            'Consultation',
            'National Engagement',
            'Research',
            'Committee Meeting',
            'Roundtable',
            'Public Lecture',
            'Webinar',
            'Workshop',
            'Consultancy / Review',
            'Plenary Assembly',
            'Advocacy Mission',
            'Dialogue',
            'Review',
        ] as $name) {
            $this->assertContains($name, $names);
        }
    }

    public function test_slash_and_short_labels_resolve_to_canonical_names(): void
    {
        $this->assertSame(
            'Training / Capacity Building',
            WorkplanMeetingTypeCatalog::canonicalName('Training/Capacity Building')
        );
        $this->assertSame('Workshop', WorkplanMeetingTypeCatalog::canonicalName('workshop'));
        $this->assertSame('Plenary Session', WorkplanMeetingTypeCatalog::canonicalName('Plenary'));
        $this->assertSame('Plenary Assembly', WorkplanMeetingTypeCatalog::canonicalName('Plenary Assembly'));
        $this->assertSame('Review', WorkplanMeetingTypeCatalog::canonicalName('Review'));
        $this->assertSame('Review Meeting', WorkplanMeetingTypeCatalog::canonicalName('Review Meeting'));
        $this->assertNull(WorkplanMeetingTypeCatalog::canonicalName('Moon Summit'));
    }
}
