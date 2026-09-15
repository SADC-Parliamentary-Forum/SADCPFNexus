<?php

namespace App\Modules\Workplan;

/**
 * Canonical workplan meeting types plus CSV aliases.
 *
 * Includes the original seeded governance types and the labels used on
 * the SADC PF annual workplan spreadsheet (Plenary Assembly, Training /
 * Capacity Building, Committee Meeting, and so on).
 */
final class WorkplanMeetingTypeCatalog
{
    /**
     * Short CSV labels that are not themselves catalog names.
     *
     * @var array<string, string>
     */
    private const SHORT_ALIASES = [
        'plenary' => 'Plenary Session',
        'exco' => 'Executive Committee',
        'executive' => 'Executive Committee',
        'finance' => 'Finance Sub-Committee',
        'sc' => 'Standing Committee',
        'standing' => 'Standing Committee',
        'management' => 'Management Meeting',
        'departmental' => 'Departmental Meeting',
        'stakeholder' => 'Stakeholder Engagement',
        'procurement' => 'Procurement Evaluation',
        'board' => 'Board Meeting',
        'training' => 'Training / Capacity Building',
        'capacity building' => 'Training / Capacity Building',
        'committee' => 'Committee Meeting',
        'consultancy' => 'Consultancy / Review',
        'advocacy' => 'Advocacy Mission',
    ];

    /**
     * @return list<array{name: string, description: string, sort_order: int}>
     */
    public static function definitions(): array
    {
        return [
            ['name' => 'Plenary Session', 'description' => 'Full plenary assembly of all member parliaments.', 'sort_order' => 1],
            ['name' => 'Plenary Assembly', 'description' => 'Plenary assembly of the SADC Parliamentary Forum.', 'sort_order' => 2],
            ['name' => 'Assembly', 'description' => 'General assembly sitting.', 'sort_order' => 3],
            ['name' => 'Executive Committee', 'description' => 'ExCo governance and oversight meetings.', 'sort_order' => 4],
            ['name' => 'Finance Sub-Committee', 'description' => 'Budget review and financial oversight sessions.', 'sort_order' => 5],
            ['name' => 'Standing Committee', 'description' => 'Thematic standing committee sittings.', 'sort_order' => 6],
            ['name' => 'Committee Meeting', 'description' => 'Committee meeting of a standing or ad-hoc committee.', 'sort_order' => 7],
            ['name' => 'Management Meeting', 'description' => 'Internal management coordination meeting.', 'sort_order' => 8],
            ['name' => 'Departmental Meeting', 'description' => 'Intra-department coordination and planning.', 'sort_order' => 9],
            ['name' => 'Meeting', 'description' => 'General workplan meeting.', 'sort_order' => 10],
            ['name' => 'Review Meeting', 'description' => 'Structured review of programmes or performance.', 'sort_order' => 11],
            ['name' => 'Review', 'description' => 'Review activity that is not a full meeting.', 'sort_order' => 12],
            ['name' => 'Consultancy / Review', 'description' => 'Consultancy or external review engagement.', 'sort_order' => 13],
            ['name' => 'Consultation', 'description' => 'Consultation with members, partners, or stakeholders.', 'sort_order' => 14],
            ['name' => 'Stakeholder Engagement', 'description' => 'External stakeholder and partner engagement sessions.', 'sort_order' => 15],
            ['name' => 'National Engagement', 'description' => 'Engagement with a national parliament or in-country partners.', 'sort_order' => 16],
            ['name' => 'Training / Capacity Building', 'description' => 'Training and capacity-building activity.', 'sort_order' => 17],
            ['name' => 'Capacity Building Workshop', 'description' => 'Training and capacity development workshop.', 'sort_order' => 18],
            ['name' => 'Workshop', 'description' => 'Workshop or facilitated working session.', 'sort_order' => 19],
            ['name' => 'Conference', 'description' => 'Conference or large convened gathering.', 'sort_order' => 20],
            ['name' => 'Roundtable', 'description' => 'Roundtable discussion.', 'sort_order' => 21],
            ['name' => 'Dialogue', 'description' => 'Policy or parliamentary dialogue.', 'sort_order' => 22],
            ['name' => 'Public Lecture', 'description' => 'Public lecture or keynote session.', 'sort_order' => 23],
            ['name' => 'Webinar', 'description' => 'Online seminar or briefing.', 'sort_order' => 24],
            ['name' => 'Research', 'description' => 'Research activity or research meeting.', 'sort_order' => 25],
            ['name' => 'Advocacy Mission', 'description' => 'Advocacy or outreach mission.', 'sort_order' => 26],
            ['name' => 'Procurement Evaluation', 'description' => 'Bid evaluation and procurement committee meetings.', 'sort_order' => 27],
            ['name' => 'Board Meeting', 'description' => 'Governance board and advisory committee sessions.', 'sort_order' => 28],
        ];
    }

    /**
     * @return list<string>
     */
    public static function names(): array
    {
        return array_column(self::definitions(), 'name');
    }

    /**
     * @return array{name: string, description: string, sort_order: int}|null
     */
    public static function definitionByName(string $name): ?array
    {
        $canonical = self::canonicalName($name) ?? $name;
        foreach (self::definitions() as $definition) {
            if (strcasecmp($definition['name'], $canonical) === 0) {
                return $definition;
            }
        }

        return null;
    }

    public static function canonicalName(string $name): ?string
    {
        foreach (self::keysFor($name) as $key) {
            if (isset(self::aliasMap()[$key])) {
                return self::aliasMap()[$key];
            }
        }

        return null;
    }

    public static function isOfficial(string $name): bool
    {
        return self::canonicalName($name) !== null;
    }

    /**
     * @return list<string>
     */
    public static function keysFor(string $name): array
    {
        $base = mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', str_replace("\u{00A0}", ' ', $name))));
        if ($base === '') {
            return [];
        }

        $compactSlash = (string) preg_replace('/\s*\/\s*/u', '/', $base);
        $spacedSlash = (string) preg_replace('/\s*\/\s*/u', ' / ', $base);
        $underscore = str_replace([' ', '-', '/'], '_', $compactSlash);

        return array_values(array_unique(array_filter([
            $base,
            $compactSlash,
            $spacedSlash,
            $underscore,
        ], fn (string $key) => $key !== '')));
    }

    /**
     * @return array<string, string>
     */
    public static function aliasMap(): array
    {
        static $map = null;
        if (is_array($map)) {
            return $map;
        }

        $map = [];
        foreach (self::names() as $canonical) {
            foreach (self::keysFor($canonical) as $key) {
                $map[$key] = $canonical;
            }
        }
        foreach (self::SHORT_ALIASES as $key => $canonical) {
            foreach (self::keysFor($key) as $aliasKey) {
                $map[$aliasKey] = $canonical;
            }
        }

        return $map;
    }
}
