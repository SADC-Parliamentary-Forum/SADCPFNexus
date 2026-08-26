/** Previous calendar month — payroll is usually issued after month-end. */
export function defaultPayPeriodValue(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parsePeriodValue(value: string): { month: number; year: number } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

export function formatPayPeriod(month: number, year: number): string {
  const names = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[month] ?? month} ${year}`;
}

export function isPayslipZip(filename: string): boolean {
  return /\.zip$/i.test(filename);
}

export function isPayslipDocument(filename: string): boolean {
  return /\.(pdf|xlsx|xls)$/i.test(filename);
}
