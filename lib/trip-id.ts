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
  // Mix the bits so routes that differ only by a day still get different IDs
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  const code = (hash >>> 0).toString(36).toUpperCase().padStart(5, "0").slice(-5);
  return `BCF-${code}`;
}
