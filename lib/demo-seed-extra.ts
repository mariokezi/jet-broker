import { format } from "date-fns";
import { utcDatePlus } from "./demo-clock";
import { generateTripId } from "./trip-id";
import { createSeatShare, type SeatShare } from "./seats";
import { blockMinutes } from "./tracking";
import { clientChannelId, TEAM_CHANNEL, TEAMMATE, tripChannelId, type ChatMessage } from "./messaging";
import type { ClientProfile } from "./clients";
import type { EmptyLeg, LegParty } from "./empty-legs";
import type { Booking, BookingChecklistItem } from "./types";

export interface AppAlert {
  id: string;
  at: string;
  kind: "departed" | "landed" | "seat" | "message";
  text: string;
  href: string;
  seen: boolean;
}

function withSales(anchorMs: number, share: SeatShare, sales: [number, number, boolean, string, string | null, number][]): SeatShare {
  // [zone index, seats, whole zone, name, email, hours ago]
  return {
    ...share,
    sales: sales.map(([zi, seats, whole, name, email, hoursAgo], i) => {
      const z = share.zones[zi];
      return {
        id: `SS-${i + 1}-${z.id}`,
        zoneId: z.id,
        seats,
        wholeZone: whole,
        name,
        email,
        phone: null,
        amount: whole ? z.zonePrice : z.pricePerSeat * seats,
        at: new Date(anchorMs - hoursAgo * 3_600_000).toISOString(),
        source: i % 2 ? "Online" : "Broker",
      };
    }),
  };
}

/** NY to Florida legs sold by the seat, one mine and one from the network. */
export function seedSeatLegs(anchorMs: number, me: LegParty): EmptyLeg[] {
  const at = (h: number) => new Date(anchorMs - h * 3_600_000).toISOString();
  const mine: EmptyLeg = {
    id: "EL-3110",
    postedAt: at(20),
    postedBy: me,
    isMine: true,
    origin: "KTEB",
    destination: "KPBI",
    earliest: utcDatePlus(anchorMs, 3),
    latest: utcDatePlus(anchorMs, 3),
    aircraft: "Challenger 350",
    category: "Super Midsize Jet",
    seats: 9,
    tailNumber: "N350JX",
    askingPrice: 16800,
    notes: "Positioning to Palm Beach for a pickup. Selling by zone or by seat. Friday 9am from Teterboro.",
    status: "Open",
    claim: null,
    sourceBookingId: null,
    seatShare: null,
  };
  mine.seatShare = withSales(anchorMs, createSeatShare(mine.category, mine.seats, mine.askingPrice), [
    [0, 2, false, "Olivia Bennett", "olivia@bennettfamily.com", 16],
    [2, 3, true, "Laura Chen", "laura.chen@chencap.com", 9],
    [0, 1, false, "Marco Rossi", "marco@rossidesign.co", 2],
  ]);

  const network: EmptyLeg = {
    id: "EL-3111",
    postedAt: at(11),
    postedBy: { name: "Dana Whitfield", company: "Premier Private Jets", kind: "Operator" },
    isMine: false,
    origin: "KHPN",
    destination: "KFLL",
    earliest: utcDatePlus(anchorMs, 5),
    latest: utcDatePlus(anchorMs, 5),
    aircraft: "Gulfstream G450",
    category: "Heavy Jet",
    seats: 14,
    tailNumber: "N450PP",
    askingPrice: 24500,
    notes: "Heavy jet heading south for the season. Zones available separately, conference table seats four.",
    status: "Open",
    claim: null,
    sourceBookingId: null,
    seatShare: null,
  };
  network.seatShare = withSales(anchorMs, createSeatShare(network.category, network.seats, network.askingPrice), [
    [0, 4, true, "Harrington party", null, 7],
    [3, 2, false, "Nina Patel", null, 3],
  ]);
  return [mine, network];
}

function localBooking(
  id: string,
  departMs: number,
  b: Omit<Booking, "id" | "tripId" | "date" | "departureTime" | "createdAt" | "checklist" | "tracking">,
  checklist: BookingChecklistItem[],
  departedAt: string | null
): Booking {
  const d = new Date(departMs);
  const date = format(d, "yyyy-MM-dd");
  return {
    ...b,
    id,
    date,
    departureTime: format(d, "HH:mm"),
    tripId: generateTripId(b.origin, b.destination, date),
    createdAt: new Date(departMs - 4 * 86_400_000).toISOString(),
    checklist,
    tracking: { departedAt, landedAt: null, notifyClient: true },
  };
}

/**
 * Two flights timed from the moment of reset: one already airborne that lands about 15 minutes
 * later, and one that departs about 8 minutes later. Both fire live alerts during a demo.
 */
export function seedLiveBookings(anchorMs: number, allDone: BookingChecklistItem[]): Booking[] {
  const inAir = { origin: "KHPN", destination: "KMIA", aircraft: "Citation X" };
  const block = blockMinutes(inAir);
  const inAirDepart = anchorMs - (block - 15) * 60_000;
  return [
    localBooking(
      "BK-1190",
      inAirDepart,
      { ...inAir, inquiryId: null, clientName: "Sophia Martinez", pax: 5, operator: "Jet Excellence", tailNumber: "N750JX", operatorPrice: 27400, clientPrice: 31500 },
      allDone,
      new Date(inAirDepart).toISOString()
    ),
    localBooking(
      "BK-1191",
      anchorMs + 8 * 60_000,
      { origin: "KTEB", destination: "KPBI", aircraft: "Challenger 350", inquiryId: null, clientName: "Victoria Lane", pax: 6, operator: "Premier Private Jets", tailNumber: "N355PP", operatorPrice: 29800, clientPrice: 34200 },
      allDone.map((c) => (c.key === "itinerary" ? { ...c, done: false } : c)),
      null
    ),
  ];
}

export function seedMessages(anchorMs: number, broker: string): ChatMessage[] {
  const at = (h: number) => new Date(anchorMs - h * 3_600_000).toISOString();
  const m = (id: string, channelId: string, h: number, author: string, role: ChatMessage["role"], text: string, via: ChatMessage["via"] = "app"): ChatMessage => ({ id, channelId, at: at(h), author, role, text, via });
  return [
    m("M1", TEAM_CHANNEL, 3.2, TEAMMATE, "team", "Morning. Two flights out today: Sophia Martinez HPN to MIA and Victoria Lane TEB to PBI. Both fully confirmed."),
    m("M2", TEAM_CHANNEL, 3.0, broker, "me", "Great. Can you keep an eye on the Teterboro seat share? 3 seats left in the forward club."),
    m("M3", TEAM_CHANNEL, 2.8, TEAMMATE, "team", "Will do. Posted it on the network and sent it to our Florida list."),
    m("M4", tripChannelId("BK-1191"), 20, TEAMMATE, "team", "Crew confirmed for N355PP: Capt. Reyes and FO Lindqvist. Catering ordered, Carbone to go."),
    m("M5", tripChannelId("BK-1191"), 19, "Premier Private Jets", "operator", "Aircraft is on the ground at TEB, fueled and ready. FBO is Signature."),
    m("M6", tripChannelId("BK-1191"), 1, broker, "me", "Client arriving 15 minutes early, please have the car pull right up to the aircraft."),
    m("M7", tripChannelId("BK-1190"), 26, TEAMMATE, "team", "Wire received for BK-1190. Checklist complete."),
    m("M8", clientChannelId("victoria-lane"), 22, "Victoria Lane", "client", "Hi Mario, can we add one more passenger? My sister is joining.", "text"),
    m("M9", clientChannelId("victoria-lane"), 21.5, broker, "me", "Absolutely, the Challenger seats 9. I've updated the manifest to 6.", "text"),
    m("M10", clientChannelId("victoria-lane"), 21, "Victoria Lane", "client", "You're the best. See you Friday.", "text"),
    m("M11", clientChannelId("richard-hale"), 26, broker, "me", "Richard, three options for Sunday's Teterboro to Palm Beach are ready. Proposal link attached.", "email"),
    m("M12", clientChannelId("richard-hale"), 2, "Richard Hale", "client", "Thanks Mario. Leaning toward the Citation X. Is there wifi on that one?", "email"),
    m("M13", clientChannelId("sophia-martinez"), 3, broker, "me", "Good morning Sophia, your car is outside and the crew is ready at Westchester.", "text"),
    m("M14", clientChannelId("sophia-martinez"), 2.9, "Sophia Martinez", "client", "On our way, 10 minutes out.", "text"),
    m("M15", clientChannelId("jordan-ellis"), 0.3, "Jordan Ellis", "client", "Just sent the Cabo request. Our dog Max is 40 lbs, is that ok in the cabin?", "email"),
  ];
}

export function seedClientProfiles(anchorMs: number): ClientProfile[] {
  const since = (days: number) => utcDatePlus(anchorMs, -days);
  const p = (id: string, name: string, company: string | null, email: string | null, phone: string | null, home: string | null, tier: ClientProfile["tier"], preferences: string[], notes: string | null, days: number): ClientProfile => ({
    id, name, company, email, phone, homeAirport: home, tier, preferences, notes, since: since(days),
  });
  return [
    p("richard-hale", "Richard Hale", "Hale Capital Partners", "rhale@halecapital.com", "212-555-0107", "KTEB", "VIP", ["Super midsize or larger", "Morning departures", "Wall Street Journal on board"], "Flies TEB to PBI most weekends November through April.", 410),
    p("laura-chen", "Laura Chen", "Chen Capital", "laura.chen@chencap.com", "248-555-0151", "KPTK", "VIP", ["Phenom 300 or larger", "Still water and fruit plate", "SUV at arrival"], "Travels with two kids. Booked the divan zone on the Palm Beach seat share.", 290),
    p("grant-whitaker", "Grant Whitaker", "Whitaker Ventures", "grant@whitakerv.com", "949-555-0188", "KSNA", "VIP", ["Heavy jets only", "Travels with 2 dogs", "Late afternoon departures"], null, 520),
    p("sophia-martinez", "Sophia Martinez", "Martinez Hospitality", "sophia@martinezhg.com", "914-555-0122", "KHPN", "VIP", ["Citation X preferred", "Text updates, no calls"], "Wants a text at wheels up and on landing.", 180),
    p("victoria-lane", "Victoria Lane", null, "victoria.lane@gmail.com", "201-555-0175", "KTEB", "Regular", ["Italian catering", "Car to the aircraft"], null, 95),
    p("ben-carter", "Ben Carter", "Carter Energy", "ben@carterenergy.com", "214-555-0166", "KDAL", "Regular", ["Challenger 350", "Golf bags"], null, 140),
    p("hannah-brooks", "Hannah Brooks", null, "hannah.brooks@me.com", "617-555-0143", "KBOS", "Regular", ["Light jets fine for short hops"], null, 60),
    p("jordan-ellis", "Jordan Ellis", "Ellis Ventures", null, null, "KAUS", "New", ["Pet on board (40 lb dog)", "Wifi"], "First trip. Family of 8 to Cabo.", 0),
  ];
}
