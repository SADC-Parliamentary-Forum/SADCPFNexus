<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\TravelItinerary;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TravelItineraryParseService
{
    public function __construct(
        private readonly AirlineItineraryParserInterface $parser,
    ) {}

    /**
     * @return array{parseable: bool, legs: array<int, array<string, mixed>>, message: string|null}
     */
    public function preview(string $rawText): array
    {
        $legs = $this->parser->parse($rawText);
        if ($legs === []) {
            return [
                'parseable' => false,
                'legs' => [],
                'message' => 'Could not extract itinerary legs from the pasted text. You can enter legs manually.',
            ];
        }

        return [
            'parseable' => true,
            'legs' => $legs,
            'message' => null,
        ];
    }

    public function apply(TravelRequest $travel, string $rawText, User $user): TravelRequest
    {
        $this->assertCanEditItinerary($travel, $user);

        $preview = $this->preview($rawText);
        if (! $preview['parseable']) {
            throw ValidationException::withMessages([
                'raw_text' => $preview['message'] ?? 'Unparseable itinerary.',
            ]);
        }

        $newVersion = ((int) $travel->itinerary_version) + 1;

        DB::transaction(function () use ($travel, $preview, $rawText, $newVersion, $user) {
            $old = $travel->itineraries()->get()->toArray();
            $travel->itineraries()->delete();

            foreach ($preview['legs'] as $leg) {
                TravelItinerary::create([
                    'travel_request_id' => $travel->id,
                    'from_location' => $leg['from_location'],
                    'to_location' => $leg['to_location'],
                    'travel_date' => $leg['travel_date'],
                    'transport_mode' => $leg['transport_mode'] ?? 'flight',
                    'days_count' => $leg['days_count'] ?? 1,
                    'day_type' => $leg['day_type'] ?? 'official',
                    'flight_number' => $leg['flight_number'] ?? null,
                    'carrier' => $leg['carrier'] ?? null,
                    'departure_at' => $leg['departure_at'] ?? null,
                    'arrival_at' => $leg['arrival_at'] ?? null,
                    'parse_source' => $leg['parse_source'] ?? 'paste',
                    'itinerary_version' => $newVersion,
                    'dsa_rate' => 0,
                    'calculated_dsa' => 0,
                ]);
            }

            $travel->update([
                'itinerary_version' => $newVersion,
                'itinerary_raw_source' => $rawText,
            ]);

            AuditLog::record('travel.itinerary_applied', [
                'auditable_type' => TravelRequest::class,
                'auditable_id' => $travel->id,
                'old_values' => ['legs' => $old, 'itinerary_version' => $newVersion - 1],
                'new_values' => [
                    'itinerary_version' => $newVersion,
                    'leg_count' => count($preview['legs']),
                    'applied_by' => $user->id,
                ],
            ]);
        });

        return $travel->fresh(['itineraries']);
    }

    private function assertCanEditItinerary(TravelRequest $travel, User $user): void
    {
        if ($user->isSystemAdmin()) {
            return;
        }
        if ((int) $travel->requester_id === (int) $user->id) {
            return;
        }
        if ($user->can('travel.admin') || $user->can('travel.admin-review') || $user->hasRole('Administration Officer')) {
            return;
        }

        abort(403, 'Not authorised to update itinerary.');
    }
}
