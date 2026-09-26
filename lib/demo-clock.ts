/**
 * Demo data is anchored to a moment in time (stored in a cookie by the
 * client) so server generated quote emails and client side demo state
 * always describe the same upcoming trips.
 */
export const DEMO_ANCHOR_COOKIE = "demo_anchor";
export const DATA_MODE_COOKIE = "data_mode";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function utcDatePlus(anchorMs: number, days: number): string {
  const d = new Date(anchorMs + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export interface DemoDate {
  iso: string; // 2026-10-05
  mmddyyyy: string; // 10/05/2026
  mdyy: string; // 10/5/26
  md: string; // 10/5
  long: string; // October 5, 2026
  monthDay: string; // October 5
}

function formats(iso: string): DemoDate {
  const [y, m, d] = iso.split("-").map(Number);
  return {
    iso,
    mmddyyyy: `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`,
    mdyy: `${m}/${d}/${String(y).slice(2)}`,
    md: `${m}/${d}`,
    long: `${MONTHS[m - 1]} ${d}, ${y}`,
    monthDay: `${MONTHS[m - 1]} ${d}`,
  };
}

/** The three email-sourced demo trips: A (TEB-PBI), B (VNY-ASE), C (OPF-TEB). */
export function demoTripDates(anchorMs: number): { A: DemoDate; B: DemoDate; C: DemoDate } {
  return {
    A: formats(utcDatePlus(anchorMs, 6)),
    B: formats(utcDatePlus(anchorMs, 9)),
    C: formats(utcDatePlus(anchorMs, 12)),
  };
}
