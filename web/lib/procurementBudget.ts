const ACTIVE_CONFIRMATION_STATUSES = new Set([
  "proposed",
  "reserved",
  "confirmed",
  "partially_utilised",
]);

export type BudgetConfirmationReservation = {
  released_at?: string | null;
  status?: string | null;
};

export type BudgetConfirmationRequest = {
  budget_confirmed?: boolean | number;
  budgetReservations?: BudgetConfirmationReservation[];
};

export function reservationIsActiveConfirmation(reservation: BudgetConfirmationReservation): boolean {
  if (reservation.released_at) return false;
  if (reservation.status == null || reservation.status === "") return true;
  return ACTIVE_CONFIRMATION_STATUSES.has(reservation.status);
}

export function isBudgetConfirmed(req: BudgetConfirmationRequest): boolean {
  if (req.budget_confirmed === true || req.budget_confirmed === 1) return true;
  if (req.budgetReservations?.some(reservationIsActiveConfirmation)) return true;
  return false;
}
