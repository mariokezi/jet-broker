interface Airport {
  icao: string;
  iata: string;
  name: string;
  aliases: string[];
}

const airports: Airport[] = [
  { icao: "KTEB", iata: "TEB", name: "Teterboro", aliases: ["teterboro"] },
  { icao: "KJFK", iata: "JFK", name: "John F. Kennedy International", aliases: ["jfk", "kennedy"] },
  { icao: "KLGA", iata: "LGA", name: "LaGuardia", aliases: ["laguardia", "la guardia"] },
  { icao: "KEWR", iata: "EWR", name: "Newark Liberty International", aliases: ["newark", "ewr"] },
  { icao: "KHPN", iata: "HPN", name: "Westchester County", aliases: ["white plains", "westchester"] },
  { icao: "KBED", iata: "BED", name: "Laurence G. Hanscom Field", aliases: ["bedford", "hanscom"] },
  { icao: "KBOS", iata: "BOS", name: "Boston Logan International", aliases: ["boston", "logan"] },
  { icao: "KPBI", iata: "PBI", name: "Palm Beach International", aliases: ["palm beach", "west palm beach"] },
  { icao: "KFLL", iata: "FLL", name: "Fort Lauderdale-Hollywood International", aliases: ["fort lauderdale", "ft lauderdale"] },
  { icao: "KMIA", iata: "MIA", name: "Miami International", aliases: ["miami"] },
  { icao: "KOPF", iata: "OPF", name: "Miami-Opa Locka Executive", aliases: ["opa-locka", "opa locka"] },
  { icao: "KFXE", iata: "FXE", name: "Fort Lauderdale Executive", aliases: ["fort lauderdale executive", "ft lauderdale executive"] },
  { icao: "KAPA", iata: "APA", name: "Centennial", aliases: ["centennial"] },
  { icao: "KASE", iata: "ASE", name: "Aspen-Pitkin County", aliases: ["aspen"] },
  { icao: "KEGE", iata: "EGE", name: "Eagle County Regional", aliases: ["eagle vail", "eagle", "vail"] },
  { icao: "KVNY", iata: "VNY", name: "Van Nuys", aliases: ["van nuys"] },
  { icao: "KSMO", iata: "SMO", name: "Santa Monica Municipal", aliases: ["santa monica"] },
  { icao: "KLAX", iata: "LAX", name: "Los Angeles International", aliases: ["los angeles", "lax"] },
  { icao: "KSFO", iata: "SFO", name: "San Francisco International", aliases: ["san francisco"] },
  { icao: "KSJC", iata: "SJC", name: "San Jose International", aliases: ["san jose"] },
  { icao: "KOAK", iata: "OAK", name: "Oakland International", aliases: ["oakland"] },
  { icao: "KORD", iata: "ORD", name: "Chicago O'Hare International", aliases: ["chicago o'hare", "o'hare"] },
  { icao: "KPWK", iata: "PWK", name: "Chicago Executive", aliases: ["chicago executive", "palwaukee"] },
  { icao: "KMDW", iata: "MDW", name: "Chicago Midway", aliases: ["midway"] },
  { icao: "KDAL", iata: "DAL", name: "Dallas Love Field", aliases: ["dallas love", "love field"] },
  { icao: "KADS", iata: "ADS", name: "Addison", aliases: ["addison"] },
  { icao: "KIAH", iata: "IAH", name: "George Bush Intercontinental", aliases: ["houston intercontinental", "bush intercontinental"] },
  { icao: "KHOU", iata: "HOU", name: "William P. Hobby", aliases: ["houston hobby", "hobby"] },
  { icao: "KDCA", iata: "DCA", name: "Ronald Reagan Washington National", aliases: ["reagan", "washington national", "dca"] },
  { icao: "KIAD", iata: "IAD", name: "Washington Dulles International", aliases: ["dulles"] },
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

  // Check ICAO (4-letter starting with K)
  if (icaoMap.has(upper)) return upper;

  // Check IATA (3-letter)
  const byIata = iataMap.get(upper);
  if (byIata) return byIata.icao;

  // Check city/alias (case-insensitive)
  const byAlias = aliasMap.get(trimmed.toLowerCase());
  if (byAlias) return byAlias.icao;

  return null;
}

export function getAirportName(icao: string): string {
  const apt = icaoMap.get(icao.toUpperCase());
  return apt ? apt.name : icao;
}

export function getIATA(icao: string): string {
  const apt = icaoMap.get(icao.toUpperCase());
  return apt ? apt.iata : icao;
}
