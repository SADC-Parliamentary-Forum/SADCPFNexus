<?php

namespace Tests\Unit\Support;

use App\Support\DateFormat;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Display-layer dates must be SADCPF-style (21 Aug 2026), never ISO dumps.
 * Does not extend Tests\TestCase — no Postgres / RefreshDatabase.
 */
class DateFormatTest extends TestCase
{
    #[DataProvider('dateOnlyProvider')]
    public function test_human_date_formats_calendar_days_without_midnight_time(mixed $value): void
    {
        $this->assertSame('21 Aug 2026', DateFormat::date($value));
        $this->assertSame('21 Aug 2026', \human_date($value));
        $this->assertStringNotContainsString('2026-08-21T', \human_date($value));
        $this->assertStringNotContainsString('000000Z', \human_date($value));
        $this->assertStringNotContainsString('00:00', \human_date($value));
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function dateOnlyProvider(): array
    {
        return [
            'Y-m-d' => ['2026-08-21'],
            'iso midnight Z' => ['2026-08-21T00:00:00.000000Z'],
            'mysql datetime midnight' => ['2026-08-21 00:00:00'],
            'carbon date' => [Carbon::parse('2026-08-21')],
        ];
    }

    public function test_human_datetime_includes_short_time_for_real_timestamps(): void
    {
        $value = '2026-08-21T10:00:00.000000Z';

        $this->assertSame('21 Aug 2026, 10:00', DateFormat::datetime($value));
        $this->assertSame('21 Aug 2026, 10:00', \human_datetime($value));
        $this->assertStringNotContainsString('2026-08-21T', \human_datetime($value));
        $this->assertStringNotContainsString('000000Z', \human_datetime($value));
    }

    public function test_display_omits_midnight_and_keeps_non_midnight_time(): void
    {
        $this->assertSame('21 Aug 2026', DateFormat::display('2026-08-21T00:00:00.000000Z'));
        $this->assertSame('21 Aug 2026, 10:00', DateFormat::display('2026-08-21T10:00:00.000000Z'));
        $this->assertSame('Ada Lovelace', DateFormat::display('Ada Lovelace'));
        $this->assertSame('TRA-2026-08-21', DateFormat::display('TRA-2026-08-21'));
    }

    public function test_empty_values_render_as_em_dash(): void
    {
        $this->assertSame('—', \human_date(null));
        $this->assertSame('—', \human_date(''));
        $this->assertSame('—', \human_datetime(null));
        $this->assertSame('—', DateFormat::display(null));
    }
}
