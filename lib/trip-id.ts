/**
 * Stable trip ID from the route key. The same trip always gets the same ID,
 * whether it came from an operator email or a client inquiry.
 */
export function generateTripId(origin: string, destination: string, date: string): string {
  const key = `${origin}|${destination}|${date}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
  return `BCF-${code}`;
}
