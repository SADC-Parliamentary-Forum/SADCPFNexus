<?php

namespace Tests\Feature\Travel;

use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use App\Modules\Travel\Contracts\GdsProviderInterface;
use App\Modules\Travel\Services\GdsProviderFactory;
use App\Modules\Travel\Services\NullGdsProvider;
use Tests\TestCase;

class TravelGdsAdapterTest extends TestCase
{
    public function test_default_gds_driver_is_null_and_disabled(): void
    {
        config(['travel.gds_driver' => 'null', 'travel.gds_http_url' => null]);

        $provider = app(GdsProviderFactory::class)->make();
        $this->assertInstanceOf(NullGdsProvider::class, $provider);
        $this->assertFalse($provider->isEnabled());
        $this->assertNull($provider->fetchItinerary('ABC123'));
    }

    public function test_parser_still_handles_local_structured_text_without_gds(): void
    {
        config(['travel.gds_driver' => 'null']);

        /** @var AirlineItineraryParserInterface $parser */
        $parser = app(AirlineItineraryParserInterface::class);
        $legs = $parser->parse("Flight BA123 WDH-JNB 2026-08-10\n");
        $this->assertNotEmpty($legs);
        $this->assertSame('WDH', $legs[0]['from_location'] ?? null);
    }

    public function test_unknown_gds_driver_fails_closed(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        app(GdsProviderFactory::class)->make('paid_marketplace');
    }

    public function test_gds_interface_is_bound(): void
    {
        $this->assertInstanceOf(GdsProviderInterface::class, app(GdsProviderInterface::class));
    }
}
