export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  aliases: string[];
}

const airports: Airport[] = [
  // Northeast
  { icao: "KTEB", iata: "TEB", name: "Teterboro", city: "New York", lat: 40.8501, lon: -74.0608, aliases: ["teterboro", "new york", "nyc", "manhattan"] },
  { icao: "KJFK", iata: "JFK", name: "John F. Kennedy International", city: "New York", lat: 40.6413, lon: -73.7781, aliases: ["jfk", "kennedy"] },
  { icao: "KLGA", iata: "LGA", name: "LaGuardia", city: "New York", lat: 40.7769, lon: -73.874, aliases: ["laguardia", "la guardia"] },
  { icao: "KEWR", iata: "EWR", name: "Newark Liberty International", city: "Newark", lat: 40.6895, lon: -74.1745, aliases: ["newark", "ewr"] },
  { icao: "KHPN", iata: "HPN", name: "Westchester County", city: "White Plains", lat: 41.067, lon: -73.7076, aliases: ["white plains", "westchester"] },
  { icao: "KMMU", iata: "MMU", name: "Morristown Municipal", city: "Morristown", lat: 40.7994, lon: -74.4149, aliases: ["morristown"] },
  { icao: "KBED", iata: "BED", name: "Laurence G. Hanscom Field", city: "Bedford", lat: 42.47, lon: -71.289, aliases: ["bedford", "hanscom"] },
  { icao: "KBOS", iata: "BOS", name: "Boston Logan International", city: "Boston", lat: 42.3656, lon: -71.0096, aliases: ["boston", "logan"] },
  { icao: "KACK", iata: "ACK", name: "Nantucket Memorial", city: "Nantucket", lat: 41.2531, lon: -70.0602, aliases: ["nantucket"] },
  { icao: "KMVY", iata: "MVY", name: "Martha's Vineyard", city: "Martha's Vineyard", lat: 41.3931, lon: -70.6143, aliases: ["martha's vineyard", "marthas vineyard", "the vineyard"] },
  { icao: "KFOK", iata: "FOK", name: "Francis S. Gabreski", city: "Westhampton Beach", lat: 40.8437, lon: -72.6318, aliases: ["hamptons", "westhampton", "gabreski"] },
  { icao: "KHTO", iata: "HTO", name: "East Hampton", city: "East Hampton", lat: 40.9596, lon: -72.2518, aliases: ["east hampton"] },
  { icao: "KDCA", iata: "DCA", name: "Ronald Reagan Washington National", city: "Washington", lat: 38.8512, lon: -77.0402, aliases: ["reagan", "washington national", "dca", "washington dc", "dc"] },
  { icao: "KIAD", iata: "IAD", name: "Washington Dulles International", city: "Washington", lat: 38.9531, lon: -77.4565, aliases: ["dulles"] },
  { icao: "KPHL", iata: "PHL", name: "Philadelphia International", city: "Philadelphia", lat: 39.8744, lon: -75.2424, aliases: ["philadelphia", "philly"] },
  // Southeast
  { icao: "KPBI", iata: "PBI", name: "Palm Beach International", city: "West Palm Beach", lat: 26.6832, lon: -80.0956, aliases: ["palm beach", "west palm beach"] },
  { icao: "KBCT", iata: "BCT", name: "Boca Raton", city: "Boca Raton", lat: 26.3785, lon: -80.1077, aliases: ["boca raton", "boca"] },
  { icao: "KFLL", iata: "FLL", name: "Fort Lauderdale-Hollywood International", city: "Fort Lauderdale", lat: 26.0742, lon: -80.1506, aliases: ["fort lauderdale", "ft lauderdale"] },
  { icao: "KFXE", iata: "FXE", name: "Fort Lauderdale Executive", city: "Fort Lauderdale", lat: 26.1973, lon: -80.1707, aliases: ["fort lauderdale executive", "ft lauderdale executive"] },
  { icao: "KMIA", iata: "MIA", name: "Miami International", city: "Miami", lat: 25.7959, lon: -80.287, aliases: ["miami"] },
  { icao: "KOPF", iata: "OPF", name: "Miami-Opa Locka Executive", city: "Miami", lat: 25.907, lon: -80.2784, aliases: ["opa-locka", "opa locka"] },
  { icao: "KAPF", iata: "APF", name: "Naples Municipal", city: "Naples", lat: 26.1526, lon: -81.7753, aliases: ["naples"] },
  { icao: "KTPA", iata: "TPA", name: "Tampa International", city: "Tampa", lat: 27.9755, lon: -82.5332, aliases: ["tampa"] },
  { icao: "KORL", iata: "ORL", name: "Orlando Executive", city: "Orlando", lat: 28.5455, lon: -81.3329, aliases: ["orlando"] },
  { icao: "KPDK", iata: "PDK", name: "DeKalb-Peachtree", city: "Atlanta", lat: 33.8756, lon: -84.302, aliases: ["atlanta", "peachtree", "dekalb"] },
  { icao: "KCLT", iata: "CLT", name: "Charlotte Douglas International", city: "Charlotte", lat: 35.214, lon: -80.9431, aliases: ["charlotte"] },
  { icao: "KBNA", iata: "BNA", name: "Nashville International", city: "Nashville", lat: 36.1245, lon: -86.6782, aliases: ["nashville"] },
  { icao: "KMSY", iata: "MSY", name: "Louis Armstrong New Orleans International", city: "New Orleans", lat: 29.9934, lon: -90.258, aliases: ["new orleans"] },
  // Midwest
  { icao: "KORD", iata: "ORD", name: "Chicago O'Hare International", city: "Chicago", lat: 41.9742, lon: -87.9073, aliases: ["chicago o'hare", "o'hare"] },
  { icao: "KPWK", iata: "PWK", name: "Chicago Executive", city: "Chicago", lat: 42.1142, lon: -87.9015, aliases: ["chicago executive", "palwaukee", "chicago"] },
  { icao: "KMDW", iata: "MDW", name: "Chicago Midway", city: "Chicago", lat: 41.7868, lon: -87.7522, aliases: ["midway"] },
  { icao: "KPTK", iata: "PTK", name: "Oakland County International", city: "Detroit", lat: 42.6655, lon: -83.4185, aliases: ["pontiac", "oakland county", "detroit"] },
  { icao: "KDTW", iata: "DTW", name: "Detroit Metropolitan Wayne County", city: "Detroit", lat: 42.2162, lon: -83.3554, aliases: ["detroit metro", "dtw"] },
  { icao: "KMSP", iata: "MSP", name: "Minneapolis-St. Paul International", city: "Minneapolis", lat: 44.8848, lon: -93.2223, aliases: ["minneapolis", "st paul"] },
  // Texas
  { icao: "KDAL", iata: "DAL", name: "Dallas Love Field", city: "Dallas", lat: 32.8471, lon: -96.8518, aliases: ["dallas love", "love field", "dallas"] },
  { icao: "KADS", iata: "ADS", name: "Addison", city: "Dallas", lat: 32.9686, lon: -96.8364, aliases: ["addison"] },
  { icao: "KIAH", iata: "IAH", name: "George Bush Intercontinental", city: "Houston", lat: 29.9902, lon: -95.3368, aliases: ["houston intercontinental", "bush intercontinental"] },
  { icao: "KHOU", iata: "HOU", name: "William P. Hobby", city: "Houston", lat: 29.6454, lon: -95.2789, aliases: ["houston hobby", "hobby", "houston"] },
  { icao: "KAUS", iata: "AUS", name: "Austin-Bergstrom International", city: "Austin", lat: 30.1975, lon: -97.6664, aliases: ["austin"] },
  { icao: "KSAT", iata: "SAT", name: "San Antonio International", city: "San Antonio", lat: 29.5337, lon: -98.4698, aliases: ["san antonio"] },
  // Mountain
  { icao: "KAPA", iata: "APA", name: "Centennial", city: "Denver", lat: 39.5701, lon: -104.8493, aliases: ["centennial", "denver"] },
  { icao: "KASE", iata: "ASE", name: "Aspen-Pitkin County", city: "Aspen", lat: 39.2232, lon: -106.8688, aliases: ["aspen"] },
  { icao: "KEGE", iata: "EGE", name: "Eagle County Regional", city: "Vail", lat: 39.6426, lon: -106.9177, aliases: ["eagle vail", "eagle", "vail"] },
  { icao: "KTEX", iata: "TEX", name: "Telluride Regional", city: "Telluride", lat: 37.9538, lon: -107.9085, aliases: ["telluride"] },
  { icao: "KJAC", iata: "JAC", name: "Jackson Hole", city: "Jackson", lat: 43.6073, lon: -110.7377, aliases: ["jackson hole", "jackson"] },
  { icao: "KSUN", iata: "SUN", name: "Friedman Memorial", city: "Sun Valley", lat: 43.5044, lon: -114.2962, aliases: ["sun valley", "hailey"] },
  { icao: "KBZN", iata: "BZN", name: "Bozeman Yellowstone International", city: "Bozeman", lat: 45.7775, lon: -111.1603, aliases: ["bozeman", "big sky"] },
  { icao: "KSDL", iata: "SCF", name: "Scottsdale", city: "Scottsdale", lat: 33.6229, lon: -111.9105, aliases: ["scottsdale", "phoenix"] },
  { icao: "KLAS", iata: "LAS", name: "Harry Reid International", city: "Las Vegas", lat: 36.084, lon: -115.1537, aliases: ["las vegas", "vegas"] },
  // West Coast
  { icao: "KVNY", iata: "VNY", name: "Van Nuys", city: "Los Angeles", lat: 34.2098, lon: -118.49, aliases: ["van nuys"] },
  { icao: "KSMO", iata: "SMO", name: "Santa Monica Municipal", city: "Santa Monica", lat: 34.0158, lon: -118.4513, aliases: ["santa monica"] },
  { icao: "KLAX", iata: "LAX", name: "Los Angeles International", city: "Los Angeles", lat: 33.9416, lon: -118.4085, aliases: ["los angeles", "lax", "la"] },
  { icao: "KSNA", iata: "SNA", name: "John Wayne", city: "Orange County", lat: 33.6757, lon: -117.8682, aliases: ["orange county", "john wayne", "newport beach"] },
  { icao: "KCRQ", iata: "CLD", name: "McClellan-Palomar", city: "Carlsbad", lat: 33.1283, lon: -117.28, aliases: ["carlsbad", "san diego"] },
  { icao: "KTRM", iata: "TRM", name: "Jacqueline Cochran Regional", city: "Palm Springs", lat: 33.6267, lon: -116.1597, aliases: ["palm springs", "thermal", "coachella"] },
  { icao: "KSFO", iata: "SFO", name: "San Francisco International", city: "San Francisco", lat: 37.6213, lon: -122.379, aliases: ["san francisco", "sf"] },
  { icao: "KSJC", iata: "SJC", name: "San Jose International", city: "San Jose", lat: 37.3639, lon: -121.9289, aliases: ["san jose"] },
  { icao: "KOAK", iata: "OAK", name: "Oakland International", city: "Oakland", lat: 37.7126, lon: -122.2197, aliases: ["oakland"] },
  { icao: "KBFI", iata: "BFI", name: "Boeing Field", city: "Seattle", lat: 47.53, lon: -122.3019, aliases: ["seattle", "boeing field"] },
  // Caribbean / Mexico
  { icao: "MYNN", iata: "NAS", name: "Lynden Pindling International", city: "Nassau", lat: 25.039, lon: -77.4662, aliases: ["nassau", "bahamas"] },
  { icao: "TIST", iata: "STT", name: "Cyril E. King", city: "St. Thomas", lat: 18.3373, lon: -64.9734, aliases: ["st thomas", "st. thomas"] },
  { icao: "TFFJ", iata: "SBH", name: "Gustaf III", city: "St. Barths", lat: 17.9044, lon: -62.8436, aliases: ["st barths", "st. barths", "st barts", "st barth"] },
  { icao: "MMSD", iata: "SJD", name: "Los Cabos International", city: "Cabo San Lucas", lat: 23.1518, lon: -109.7211, aliases: ["cabo", "los cabos", "cabo san lucas"] },
  { icao: "MMUN", iata: "CUN", name: "Cancun International", city: "Cancun", lat: 21.0365, lon: -86.8771, aliases: ["cancun"] },
];

const icaoMap = new Map<string, Airport>();
const iataMap = new Map<string, Airport>();
const aliasMap = new Map<string, Airport>();

for (const apt of airports) {
  icaoMap.set(apt.icao.toUpperCase(), apt);
  iataMap.set(apt.iata.toUpperCase(), apt);
  for (const alias of apt.aliases) {
    aliasMap.set(alias.toLowerCase(), apt);
  }
}

export function resolveToICAO(input: string): string | null {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  // Check ICAO (4-letter)
  if (icaoMap.has(upper)) return upper;

  // Check IATA (3-letter)
  const byIata = iataMap.get(upper);
  if (byIata) return byIata.icao;

  // Check city/alias (case-insensitive)
  const byAlias = aliasMap.get(trimmed.toLowerCase());
  if (byAlias) return byAlias.icao;

  return null;
}

export function getAirport(icao: string): Airport | null {
  return icaoMap.get(icao.toUpperCase()) ?? null;
}

export function listAirports(): Airport[] {
  return airports;
}

/** Aliases sorted longest first, for scanning free text ("Palm Beach" before "Palm"). */
export function airportAliases(): { alias: string; icao: string }[] {
  return [...aliasMap.entries()]
    .map(([alias, apt]) => ({ alias, icao: apt.icao }))
    .sort((a, b) => b.alias.length - a.alias.length);
}

export function getAirportName(icao: string): string {
  const apt = icaoMap.get(icao.toUpperCase());
  return apt ? apt.name : icao;
}

export function getAirportCity(icao: string): string {
  const apt = icaoMap.get(icao.toUpperCase());
  return apt ? apt.city : icao;
}

export function getIATA(icao: string): string {
  const apt = icaoMap.get(icao.toUpperCase());
  return apt ? apt.iata : icao;
}

/** Great circle distance in nautical miles, or null if either airport is unknown. */
export function distanceNm(fromIcao: string, toIcao: string): number | null {
  const a = getAirport(fromIcao);
  const b = getAirport(toIcao);
  if (!a || !b) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 3440.065 * Math.asin(Math.sqrt(h)));
}
