<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeArrivalDeparture;
use App\Modules\Programmes\Services\ProgrammeService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeArrivalDepartureController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    /**
     * Resolve what the arrival_date will be *after* this request is applied,
     * falling back to the existing row's arrival_date on a partial update that
     * doesn't touch the field. Without this, PUT-ing only departure_date would
     * silently skip the after_or_equal check (Laravel's date rules only compare
     * against other fields present in the SAME request, never existing DB state).
     */
    private function resultingArrivalDate(bool $updating, ?ProgrammeArrivalDeparture $arrivalDeparture): ?string
    {
        if (request()->has('arrival_date')) {
            return request()->input('arrival_date');
        }

        if ($updating && $arrivalDeparture) {
            return $arrivalDeparture->arrival_date?->toDateString();
        }

        return null;
    }

    private function rules(bool $updating = false, ?ProgrammeArrivalDeparture $arrivalDeparture = null): array
    {
        $required = $updating ? 'sometimes' : 'required';
        return [
            'category'                => [$required, 'string', 'max:100'],
            'arrival_date'            => ['nullable', 'date'],
            'departure_date'          => [
                'nullable', 'date',
                function (string $attribute, $value, \Closure $fail) use ($updating, $arrivalDeparture) {
                    $arrival = $this->resultingArrivalDate($updating, $arrivalDeparture);
                    if (!$arrival || !$value) {
                        return;
                    }

                    try {
                        $arrivalDate = Carbon::parse($arrival);
                        $departureDate = Carbon::parse($value);
                    } catch (\Exception) {
                        // Malformed input: defer to the sibling 'date' rule to report
                        // the format error instead of throwing here.
                        return;
                    }

                    if ($departureDate->lt($arrivalDate)) {
                        $fail('The departure date must be a date after or equal to arrival date.');
                    }
                },
            ],
            'airport'                 => ['nullable', 'string', 'max:255'],
            'flight_details'          => ['nullable', 'string'],
            'transport_required'      => ['nullable', 'boolean'],
            'accommodation_required'  => ['nullable', 'boolean'],
            'comments'                => ['nullable', 'string'],
        ];
    }

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate($this->rules());
        $row = $this->service->addArrivalDeparture($programme, $data);
        return response()->json(['message' => 'Arrival/departure row added.', 'data' => $row], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeArrivalDeparture $arrivalDeparture): JsonResponse
    {
        $data = $request->validate($this->rules(true, $arrivalDeparture));
        $row = $this->service->updateArrivalDeparture($arrivalDeparture, $data);
        return response()->json(['message' => 'Arrival/departure row updated.', 'data' => $row]);
    }

    public function destroy(Programme $programme, ProgrammeArrivalDeparture $arrivalDeparture): JsonResponse
    {
        $this->service->deleteArrivalDeparture($arrivalDeparture);
        return response()->json(['message' => 'Arrival/departure row deleted.']);
    }
}
