<?php

namespace Database\Seeders;

use App\Models\CalendarEntry;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class CalendarSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) {
            return;
        }

        $this->seedNamibianPublicHolidays($tenant->id);
        $this->seedSouthAfricaPublicHolidays($tenant->id);
        $this->seedZimbabwePublicHolidays($tenant->id);
        $this->seedUnDays($tenant->id);
    }

    /** Namibian public holidays (reference for SADC region). */
    private function seedNamibianPublicHolidays(int $tenantId): void
    {
        $holidays = [
            // 2024
            ['2024-01-01', 'New Year\'s Day'],
            ['2024-03-21', 'Independence Day'],
            ['2024-03-29', 'Good Friday'],
            ['2024-04-01', 'Easter Monday'],
            ['2024-05-01', 'Workers\' Day'],
            ['2024-05-04', 'Cassinga Day'],
            ['2024-05-09', 'Ascension Day'],
            ['2024-05-25', 'Africa Day'],
            ['2024-08-26', 'Heroes\' Day'],
            ['2024-12-10', 'Day of the Namibian Women and International Human Rights Day'],
            ['2024-12-25', 'Christmas Day'],
            ['2024-12-26', 'Family Day'],
            // 2025
            ['2025-01-01', 'New Year\'s Day'],
            ['2025-03-01', 'Burial of Sam Nujoma'],
            ['2025-03-21', 'Independence Day'],
            ['2025-04-18', 'Good Friday'],
            ['2025-04-21', 'Easter Monday'],
            ['2025-05-01', 'Workers\' Day'],
            ['2025-05-04', 'Cassinga Day'],
            ['2025-05-05', 'Cassinga Day observed'],
            ['2025-05-25', 'Africa Day'],
            ['2025-05-26', 'Africa Day observed'],
            ['2025-05-28', 'Genocide Remembrance Day'],
            ['2025-05-29', 'Ascension Day'],
            ['2025-08-26', 'Heroes\' Day'],
            ['2025-11-26', 'Local Election Day'],
            ['2025-12-10', 'Day of the Namibian Women and International Human Rights Day'],
            ['2025-12-25', 'Christmas Day'],
            ['2025-12-26', 'Family Day'],
            // 2026
            ['2026-01-01', 'New Year\'s Day'],
            ['2026-03-21', 'Independence Day'],
            ['2026-04-03', 'Good Friday'],
            ['2026-04-06', 'Easter Monday'],
            ['2026-05-01', 'Workers\' Day'],
            ['2026-05-04', 'Cassinga Day'],
            ['2026-05-14', 'Ascension Day'],
            ['2026-05-25', 'Africa Day'],
            ['2026-08-26', 'Heroes\' Day'],
            ['2026-12-10', 'Day of the Namibian Women and International Human Rights Day'],
            ['2026-12-25', 'Christmas Day'],
            ['2026-12-26', 'Family Day'],
            // 2027
            ['2027-01-01', 'New Year\'s Day'],
            ['2027-03-21', 'Independence Day'],
            ['2027-03-26', 'Good Friday'],
            ['2027-03-29', 'Easter Monday'],
            ['2027-05-01', 'Workers\' Day'],
            ['2027-05-04', 'Cassinga Day'],
            ['2027-05-06', 'Ascension Day'],
            ['2027-05-25', 'Africa Day'],
            ['2027-08-26', 'Heroes\' Day'],
            ['2027-12-10', 'Day of the Namibian Women and International Human Rights Day'],
            ['2027-12-25', 'Christmas Day'],
            ['2027-12-26', 'Family Day'],
            // 2028
            ['2028-01-01', 'New Year\'s Day'],
            ['2028-03-21', 'Independence Day'],
            ['2028-04-14', 'Good Friday'],
            ['2028-04-17', 'Easter Monday'],
            ['2028-05-01', 'Workers\' Day'],
            ['2028-05-04', 'Cassinga Day'],
            ['2028-05-25', 'Africa Day'],
            ['2028-08-26', 'Heroes\' Day'],
            ['2028-12-10', 'Day of the Namibian Women and International Human Rights Day'],
            ['2028-12-25', 'Christmas Day'],
            ['2028-12-26', 'Family Day'],
        ];

        foreach ($holidays as $h) {
            CalendarEntry::firstOrCreate(
                [
                    'tenant_id'    => $tenantId,
                    'type'          => CalendarEntry::TYPE_SADC_HOLIDAY,
                    'country_code'  => 'NA',
                    'date'          => $h[0],
                ],
                [
                    'title'       => $h[1],
                    'description' => 'Namibian public holiday',
                    'is_alert'   => false,
                ]
            );
        }
    }

    /** South Africa public holidays (SADC region). */
    private function seedSouthAfricaPublicHolidays(int $tenantId): void
    {
        $holidays = [
            ['2024-01-01', 'New Year\'s Day'],
            ['2024-03-21', 'Human Rights Day'],
            ['2024-03-29', 'Good Friday'],
            ['2024-04-01', 'Family Day (Easter Monday)'],
            ['2024-04-27', 'Freedom Day'],
            ['2024-05-01', 'Workers\' Day'],
            ['2024-06-16', 'Youth Day'],
            ['2024-08-09', 'Women\'s Day'],
            ['2024-09-24', 'Heritage Day'],
            ['2024-12-16', 'Day of Reconciliation'],
            ['2024-12-25', 'Christmas Day'],
            ['2024-12-26', 'Day of Goodwill'],
            ['2025-01-01', 'New Year\'s Day'],
            ['2025-03-21', 'Human Rights Day'],
            ['2025-04-18', 'Good Friday'],
            ['2025-04-21', 'Family Day (Easter Monday)'],
            ['2025-04-27', 'Freedom Day'],
            ['2025-05-01', 'Workers\' Day'],
            ['2025-06-16', 'Youth Day'],
            ['2025-08-09', 'Women\'s Day'],
            ['2025-09-24', 'Heritage Day'],
            ['2025-12-16', 'Day of Reconciliation'],
            ['2025-12-25', 'Christmas Day'],
            ['2025-12-26', 'Day of Goodwill'],
            ['2026-01-01', 'New Year\'s Day'],
            ['2026-03-21', 'Human Rights Day'],
            ['2026-04-03', 'Good Friday'],
            ['2026-04-06', 'Family Day (Easter Monday)'],
            ['2026-04-27', 'Freedom Day'],
            ['2026-05-01', 'Workers\' Day'],
            ['2026-06-16', 'Youth Day'],
            ['2026-08-09', 'Women\'s Day'],
            ['2026-09-24', 'Heritage Day'],
            ['2026-12-16', 'Day of Reconciliation'],
            ['2026-12-25', 'Christmas Day'],
            ['2026-12-26', 'Day of Goodwill'],
            ['2027-01-01', 'New Year\'s Day'],
            ['2027-03-21', 'Human Rights Day'],
            ['2027-03-26', 'Good Friday'],
            ['2027-03-29', 'Family Day (Easter Monday)'],
            ['2027-04-27', 'Freedom Day'],
            ['2027-05-01', 'Workers\' Day'],
            ['2027-06-16', 'Youth Day'],
            ['2027-08-09', 'Women\'s Day'],
            ['2027-09-24', 'Heritage Day'],
            ['2027-12-16', 'Day of Reconciliation'],
            ['2027-12-25', 'Christmas Day'],
            ['2027-12-26', 'Day of Goodwill'],
        ];

        foreach ($holidays as $h) {
            CalendarEntry::firstOrCreate(
                [
                    'tenant_id'     => $tenantId,
                    'type'          => CalendarEntry::TYPE_SADC_HOLIDAY,
                    'country_code'  => 'ZA',
                    'date'          => $h[0],
                ],
                [
                    'title'       => $h[1],
                    'description' => 'South African public holiday',
                    'is_alert'    => false,
                ]
            );
        }
    }

    /** Zimbabwe public holidays (SADC region). */
    private function seedZimbabwePublicHolidays(int $tenantId): void
    {
        $holidays = [
            ['2024-01-01', 'New Year\'s Day'],
            ['2024-04-18', 'Independence Day'],
            ['2024-03-29', 'Good Friday'],
            ['2024-04-01', 'Easter Monday'],
            ['2024-05-01', 'Workers\' Day'],
            ['2024-05-25', 'Africa Day'],
            ['2024-08-11', 'Heroes\' Day'],
            ['2024-08-12', 'Defence Forces Day'],
            ['2024-12-22', 'Unity Day'],
            ['2024-12-25', 'Christmas Day'],
            ['2024-12-26', 'Boxing Day'],
            ['2025-01-01', 'New Year\'s Day'],
            ['2025-04-18', 'Independence Day (Good Friday)'],
            ['2025-04-21', 'Easter Monday'],
            ['2025-05-01', 'Workers\' Day'],
            ['2025-05-25', 'Africa Day'],
            ['2025-08-11', 'Heroes\' Day'],
            ['2025-08-12', 'Defence Forces Day'],
            ['2025-12-22', 'Unity Day'],
            ['2025-12-25', 'Christmas Day'],
            ['2025-12-26', 'Boxing Day'],
            ['2026-01-01', 'New Year\'s Day'],
            ['2026-04-18', 'Independence Day'],
            ['2026-04-03', 'Good Friday'],
            ['2026-04-06', 'Easter Monday'],
            ['2026-05-01', 'Workers\' Day'],
            ['2026-05-25', 'Africa Day'],
            ['2026-08-11', 'Heroes\' Day'],
            ['2026-08-12', 'Defence Forces Day'],
            ['2026-12-22', 'Unity Day'],
            ['2026-12-25', 'Christmas Day'],
            ['2026-12-26', 'Boxing Day'],
            ['2027-01-01', 'New Year\'s Day'],
            ['2027-04-18', 'Independence Day'],
            ['2027-03-26', 'Good Friday'],
            ['2027-03-29', 'Easter Monday'],
            ['2027-05-01', 'Workers\' Day'],
            ['2027-05-25', 'Africa Day'],
            ['2027-08-11', 'Heroes\' Day'],
            ['2027-08-12', 'Defence Forces Day'],
            ['2027-12-22', 'Unity Day'],
            ['2027-12-25', 'Christmas Day'],
            ['2027-12-26', 'Boxing Day'],
        ];

        foreach ($holidays as $h) {
            CalendarEntry::firstOrCreate(
                [
                    'tenant_id'     => $tenantId,
                    'type'          => CalendarEntry::TYPE_SADC_HOLIDAY,
                    'country_code'  => 'ZW',
                    'date'          => $h[0],
                ],
                [
                    'title'       => $h[1],
                    'description' => 'Zimbabwe public holiday',
                    'is_alert'    => false,
                ]
            );
        }
    }

    /** UN International Days (with alerts). Seeded for current year + 3 years. */
    private function seedUnDays(int $tenantId): void
    {
        $unDays = [
            ['01-04', 'World Braille Day'],
            ['01-24', 'International Day of Education'],
            ['01-27', 'International Day of Commemoration in Memory of the Victims of the Holocaust'],
            ['02-04', 'International Day of Human Fraternity'],
            ['02-11', 'International Day of Women and Girls in Science'],
            ['02-13', 'World Radio Day'],
            ['02-21', 'International Mother Language Day'],
            ['03-03', 'World Wildlife Day'],
            ['03-08', 'International Women\'s Day'],
            ['03-20', 'International Day of Happiness'],
            ['03-21', 'International Day for the Elimination of Racial Discrimination'],
            ['03-22', 'World Water Day'],
            ['04-07', 'World Health Day'],
            ['05-03', 'World Press Freedom Day'],
            ['05-08', 'Time of Remembrance and Reconciliation for Those Who Lost Their Lives in the Second World War'],
            ['05-15', 'International Day of Families'],
            ['05-17', 'World Telecommunication and Information Society Day'],
            ['05-21', 'World Day for Cultural Diversity for Dialogue and Development'],
            ['05-22', 'International Day for Biological Diversity'],
            ['06-05', 'World Environment Day'],
            ['06-12', 'World Day Against Child Labour'],
            ['06-20', 'World Refugee Day'],
            ['07-11', 'World Population Day'],
            ['07-18', 'Nelson Mandela International Day'],
            ['08-09', 'International Day of the World\'s Indigenous Peoples'],
            ['08-12', 'International Youth Day'],
            ['09-08', 'International Literacy Day'],
            ['09-15', 'International Day of Democracy'],
            ['09-21', 'International Day of Peace'],
            ['10-01', 'International Day of Older Persons'],
            ['10-05', 'World Teachers\' Day'],
            ['10-10', 'World Mental Health Day'],
            ['10-16', 'World Food Day'],
            ['10-17', 'International Day for the Eradication of Poverty'],
            ['10-24', 'United Nations Day'],
            ['11-16', 'International Day for Tolerance'],
            ['11-20', 'World Children\'s Day'],
            ['11-25', 'International Day for the Elimination of Violence against Women'],
            ['12-01', 'World AIDS Day'],
            ['12-03', 'International Day of Persons with Disabilities'],
            ['12-05', 'International Volunteer Day'],
            ['12-09', 'International Anti-Corruption Day'],
            ['12-10', 'Human Rights Day'],
        ];

        $year = (int) date('Y');
        foreach ([$year, $year + 1, $year + 2, $year + 3] as $y) {
            foreach ($unDays as $d) {
                $date = "{$y}-{$d[0]}";
                CalendarEntry::firstOrCreate(
                    [
                        'tenant_id'   => $tenantId,
                        'type'        => CalendarEntry::TYPE_UN_DAY,
                        'country_code'=> null,
                        'date'        => $date,
                    ],
                    [
                        'title'       => $d[1],
                        'description' => 'UN International Day',
                        'is_alert'    => true,
                    ]
                );
            }
        }
    }
}
