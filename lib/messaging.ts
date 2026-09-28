import type { Booking } from "./types";
import { getIATA } from "./airport-lookup";

export type ChatRole = "me" | "team" | "operator" | "client" | "system";
export type ChatVia = "email" | "text" | "app";

export interface ChatMessage {
  id: string;
  channelId: string;
  at: string; // may be in the future: simulated replies appear when the clock passes it
  author: string;
  role: ChatRole;
  text: string;
  via: ChatVia;
}

export interface Channel {
  id: string;
  kind: "team" | "trip" | "client";
  name: string;
  subtitle: string;
  bookingId?: string;
  clientId?: string;
}

export const TEAM_CHANNEL = "team-ops";
export const TEAMMATE = "Dana Price";

export const tripChannelId = (bookingId: string) => `trip-${bookingId}`;
export const clientChannelId = (clientId: string) => `client-${clientId}`;

export function tripChannel(b: Booking): Channel {
  return {
    id: tripChannelId(b.id),
    kind: "trip",
    name: `${getIATA(b.origin)} to ${getIATA(b.destination)} · ${b.clientName}`,
    subtitle: `${b.id} · ${b.operator}`,
    bookingId: b.id,
  };
}

/** Demo only: a client's reply chosen by what was asked. */
export function simulatedClientReply(firstName: string, text: string): string {
  const t = text.toLowerCase();
  if (/price|quote|cost|\$/.test(t)) return `Thanks, that works for us. Send over the agreement and I'll sign today.`;
  if (/wheels up|departed|landed|on the ground|arriv/.test(t)) return `Perfect, thank you for the update!`;
  if (/catering|food|drink|champagne/.test(t)) return `Light breakfast please, and sparkling water. No nuts, my son is allergic.`;
  if (/car|pickup|ground|transport/.test(t)) return `Yes please, an SUV for 4 with room for bags.`;
  if (/call|meet|zoom|chat/.test(t)) return `Tomorrow at 10am works. Call my cell.`;
  if (/seat|share|empty leg/.test(t)) return `Interesting. Hold 2 seats for us and send me the details.`;
  return `Got it, thanks. I'll check with my family and get back to you shortly. ${firstName}`;
}

/** Demo only: what the ops teammate says back in a trip channel. */
export function simulatedTeamReply(text: string): string {
  const t = text.toLowerCase();
  if (/catering/.test(t)) return "On it. Ordering from the FBO's usual caterer and I'll send the menu for approval.";
  if (/car|ground|pickup/.test(t)) return "Booking a black SUV for arrival. I'll drop the driver's details here.";
  if (/crew|tail|pilot/.test(t)) return "Operator confirmed the crew this morning. Trip sheet is in the booking.";
  if (/wire|payment|invoice/.test(t)) return "Wire hasn't landed yet. I'll chase the client's office at 2pm.";
  return "Got it, I'll take care of it and update the checklist.";
}

/** Messages from others that arrived after the channel was last read. */
export function unreadIn(messages: ChatMessage[], readAt: Record<string, string>, now: number, channelId?: string): number {
  const nowIso = new Date(now).toISOString();
  return messages.filter(
    (m) => m.role !== "me" && m.role !== "system" && m.at <= nowIso && (!channelId || m.channelId === channelId) && m.at > (readAt[m.channelId] ?? "")
  ).length;
}
