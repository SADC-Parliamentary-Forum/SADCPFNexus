export type TravelLegDraft = {
  from_location: string;
  to_location: string;
  travel_date: string;
  transport_mode: string;
  days_count: number;
  flight_name: string;
  flight_number: string;
};

export function emptyTravelLeg(): TravelLegDraft {
  return {
    from_location: "",
    to_location: "",
    travel_date: "",
    transport_mode: "flight",
    days_count: 1,
    flight_name: "",
    flight_number: "",
  };
}

/**
 * Prefill the next itinerary leg from the last completed hop so staff
 * only enter the onward destination.
 * Flight name/number stay blank — each hop is a different flight.
 */
export function nextTravelLeg(previous?: TravelLegDraft | null): TravelLegDraft {
  if (!previous) return emptyTravelLeg();
  return {
    from_location: previous.to_location.trim(),
    to_location: "",
    travel_date: previous.travel_date,
    transport_mode: previous.transport_mode || "flight",
    days_count: 1,
    flight_name: "",
    flight_number: "",
  };
}
