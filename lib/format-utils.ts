import { getIATA } from "./airport-lookup";
import type { ParsedQuote } from "./types";

export function formatPriceRange(quotes: ParsedQuote[]): string {
  const prices = quotes
    .map((q) => q.price)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);

  if (prices.length === 0) return "N/A";
  if (prices.length === 1) return formatPrice(prices[0]);

  return `${formatPrice(prices[0])} – ${formatPrice(prices[prices.length - 1])}`;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    const k = Math.round(price / 1000);
    return `$${k}k`;
  }
  return `$${price.toLocaleString()}`;
}

export function getIATACode(icao: string): string {
  return getIATA(icao);
}
