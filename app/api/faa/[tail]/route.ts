import { NextRequest } from "next/server";

// Static fallback data for seed N-numbers
const staticLookup: Record<string, { make: string; model: string; year: string; owner: string }> = {
  "N445AC": { make: "Cessna", model: "Citation X (750)", year: "1997", owner: "Jet Excellence LLC" },
  "N882JE": { make: "Raytheon", model: "Hawker 800XP", year: "2001", owner: "Flight Level Services Inc" },
  "N17FL": { make: "Bombardier", model: "Learjet 60", year: "2004", owner: "Trinity Aviation Corp" },
  "N901AT": { make: "Cessna", model: "Citation CJ3 (525B)", year: "2008", owner: "ATI Jet Executive Charter" },
  "N567PP": { make: "Embraer", model: "Phenom 300 (EMB-505)", year: "2015", owner: "Premier Private Jets LLC" },
  "N350ML": { make: "Bombardier", model: "Challenger 350 (BD-100)", year: "2018", owner: "MERLIN1 Aviation" },
  "N707CA": { make: "Cessna", model: "Citation VII (650)", year: "1994", owner: "Century Aviation Group" },
  "N210AE": { make: "Cessna", model: "Citation M2 (525)", year: "2017", owner: "AEM Aviation LLC" },
  "N123XJ": { make: "Cessna", model: "Citation X (750)", year: "2000", owner: "Flight Level Services Inc" },
  "N202FL": { make: "Cessna", model: "Citation M2 (525)", year: "2016", owner: "Flight Level Services Inc" },
  "N412TP": { make: "Pilatus", model: "PC-12/47E", year: "2019", owner: "Trinity Private Jet Charter" },
  "N660AT": { make: "Bombardier", model: "Learjet 60", year: "2002", owner: "ATI Jet Executive Charter" },
  "N350PP": { make: "Bombardier", model: "Challenger 350 (BD-100)", year: "2020", owner: "Premier Private Jets LLC" },
  "N303CA": { make: "Cessna", model: "Citation CJ3 (525B)", year: "2010", owner: "Century Aviation Group" },
  "N808AE": { make: "Raytheon", model: "Hawker 800XP", year: "2003", owner: "AEM Aviation LLC" },
  "N800JE": { make: "Raytheon", model: "Hawker 800XP", year: "1999", owner: "Jet Excellence LLC" },
  "N300TJ": { make: "Embraer", model: "Phenom 300 (EMB-505)", year: "2017", owner: "Trinity Private Jet Charter" },
  "N707ML": { make: "Cessna", model: "Citation VII (650)", year: "1993", owner: "MERLIN1 Aviation" },
  "N606RF": { make: "Bombardier", model: "Learjet 60", year: "2005", owner: "Royal Flight Club Inc" },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tail: string }> }
) {
  const { tail } = await params;
  const nNumber = tail.startsWith("N") ? tail : `N${tail}`;

  // Check static fallback first
  const staticData = staticLookup[nNumber];
  if (staticData) {
    return Response.json({ tailNumber: nNumber, ...staticData, source: "static" });
  }

  // Attempt live FAA lookup (best effort)
  try {
    const nNumberParam = nNumber.replace(/^N/, "");
    const res = await fetch(
      `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${nNumberParam}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      return Response.json(
        { error: "FAA registry returned an error", tailNumber: nNumber },
        { status: 502 }
      );
    }

    return Response.json({
      tailNumber: nNumber,
      registryUrl: `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${nNumberParam}`,
      source: "live",
      note: "Full parsing of FAA HTML response not implemented in demo",
    });
  } catch {
    return Response.json(
      { error: "Could not reach FAA registry", tailNumber: nNumber },
      { status: 504 }
    );
  }
}
