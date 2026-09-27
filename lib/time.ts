/** "9am", "2:30 pm", "afternoon" -> "HH:MM" for a time input. Defaults to 09:00. */
export function normalizeTime(t: string | null): string {
  if (!t) return "09:00";
  const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return /afternoon/i.test(t) ? "14:00" : /evening/i.test(t) ? "18:00" : "09:00";
  let h = parseInt(m[1]);
  if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
  if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}
