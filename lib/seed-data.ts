import "server-only";
import type { RawEmail } from "./types";
import { createTextPdfBase64 } from "./pdf-writer";
import { demoTripDates } from "./demo-clock";

/**
 * Demo inbox: realistic operator quote emails for three upcoming trips.
 * Dates are generated relative to the demo anchor so the data never goes
 * stale. PDF attachments are rendered at runtime and flow through the same
 * extraction pipeline as live Outlook attachments.
 */
export function loadSeedEmails(anchorMs: number = Date.now()): RawEmail[] {
  const { A, B, C } = demoTripDates(anchorMs);
  // The newest email lands ~25 minutes before the anchor; others keep their original spacing
  const LATEST = Date.parse("2026-05-06T12:30:00Z");
  const recv = (iso: string) =>
    new Date(anchorMs - (LATEST - Date.parse(iso)) - 25 * 60_000).toISOString();

  // Text rendered into the PDF attachments
  const pdfQuoteTexts: Record<string, string> = {
  "AEM_Quote_TEB-PBI.pdf": `AEM AVIATION
Charter Quote

Route: KTEB to KPBI
Date: ${A.long}

Aircraft: Citation M2
Tail: N210AE
YOM: 2017
Max passengers: 6
Total time: 890 hrs
Interior/Exterior refurb: 2024/2023

Price: $21,750

All prices include fuel, crew, and FET.
Contact: info@aemaviation.example`,

  "AEM_Quote_VNY-ASE.pdf": `AEM AVIATION
Charter Quote

Route: KVNY to KASE
Date: ${B.long}

Aircraft: Hawker 800XP
Tail: N808AE
YOM: 2003
Max passengers: 8
Total time: 3,450 hrs
Interior/Exterior refurb: 2021/2020

Price: $31,600

All prices include fuel, crew, and FET.
Contact: info@aemaviation.example`,
};

  const seedEmails: RawEmail[] = [
  // ============================================================
  // TRIP 1: KTEB → KPBI, ${A.iso} (~9 quotes)
  // ============================================================
  {
    id: "email-001",
    subject: `Quote: KTEB-KPBI ${A.mdyy}`,
    from: "mike@jetexcellence.example",
    fromName: "Mike Rodriguez",
    receivedAt: recv("2026-05-04T10:23:00Z"),
    bodyType: "text",
    body: `Hi,

Thanks for the inquiry. We can offer the following for your KTEB-KPBI trip on ${A.mdyy}:

Aircraft: Citation X
Tail: N445AC
YOM: 1997
Max passengers: 8
Total time: 1,254 hrs
Interior/Exterior refurb: 2022/2022

Price: $16,175 all-in (incl. fuel surcharge, FET, and crew)

Let me know if you'd like to move forward.

Best,
Mike Rodriguez
Jet Excellence
mike@jetexcellence.example`,
    attachments: [],
  },
  {
    id: "email-002",
    subject: `RE: Teterboro to Palm Beach trip ${A.mmddyyyy}`,
    from: "ops@flightlevelservices.example",
    fromName: "Sarah Chen",
    receivedAt: recv("2026-05-04T11:05:00Z"),
    bodyType: "html",
    body: `<div style="font-family: Arial, sans-serif;">
<p>Good morning,</p>
<p>We have availability for your <strong>Teterboro to Palm Beach</strong> charter on ${A.long}.</p>
<table style="border-collapse: collapse; margin: 16px 0;">
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Aircraft</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;">Hawker 800XP</td></tr>
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Registration</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;">N882JE</td></tr>
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Year</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;">2001</td></tr>
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Passengers</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;">8</td></tr>
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Total Time</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;">3,892 hrs</td></tr>
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Refurb (I/E)</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;">2019/2020</td></tr>
<tr><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>Price</strong></td><td style="padding: 4px 12px; border: 1px solid #ddd;"><strong>$22,500</strong></td></tr>
</table>
<p>Best regards,<br/>Sarah Chen<br/>Flight Level Services</p>
</div>`,
    attachments: [],
  },
  {
    id: "email-003",
    subject: `Charter quote for TEB > PBI on ${A.monthDay}`,
    from: "dispatch@trinitypj.example",
    fromName: "James Webb",
    receivedAt: recv("2026-05-04T12:30:00Z"),
    bodyType: "text",
    body: `Hello,

Please see our quote for your upcoming charter:

Route: TEB > PBI
Date: ${A.long}
Aircraft: Learjet 60
Tail: N17FL
YOM: 2004
Max passengers: 7
Total time: 2,780 hrs
Interior/Exterior refurb: 2021/2019

Price: $19,200 (all inclusive)

We look forward to your response.

James Webb
Trinity Private Jet Charter
dispatch@trinitypj.example`,
    attachments: [],
  },
  {
    id: "email-004",
    subject: `Quote: KTEB-KPBI ${A.mdyy}`,
    from: "quotes@atijet.example",
    fromName: "ATI Jet Operations",
    receivedAt: recv("2026-05-04T13:15:00Z"),
    bodyType: "text",
    body: `Good afternoon,

ATI Jet Executive Charter is pleased to offer the following aircraft:

Aircraft: Citation CJ3
Tail: N901AT
YOM: 2008
Max passengers: 6
Total time: 1,890 hrs
Interior/Exterior refurb: 2023/2022

Price: USD 17,450

Thank you for considering ATI Jet.

Best,
ATI Jet Executive Charter
quotes@atijet.example`,
    attachments: [],
  },
  {
    id: "email-005",
    subject: `RE: Teterboro to Palm Beach ${A.mmddyyyy}`,
    from: "charter@premierPrivateJets.example",
    fromName: "David Kim",
    receivedAt: recv("2026-05-04T14:00:00Z"),
    bodyType: "text",
    body: `Hi there,

We have the following available for your KTEB-KPBI trip:

Aircraft: Phenom 300
Tail: N567PP
YOM: 2015
Max passengers: 8
Total time: 987 hrs
Interior/Exterior refurb: 2024/2024

Price: $26,800

This is our newest light jet — exceptional condition.

Regards,
David Kim
Premier Private Jets`,
    attachments: [],
  },
  {
    id: "email-006",
    subject: `Quote: KTEB-KPBI ${A.mdyy}`,
    from: "ops@merlin1.example",
    fromName: "MERLIN1 Ops",
    receivedAt: recv("2026-05-04T15:20:00Z"),
    bodyType: "text",
    body: `Thank you for your request.

Aircraft: Challenger 350
Tail: N350ML
YOM: 2018
Max passengers: 10
Total time: 645 hrs
Interior/Exterior refurb: -/-

Price: $38,200

Crew and FBO fees included.

MERLIN1
ops@merlin1.example`,
    attachments: [],
  },
  {
    id: "email-007",
    subject: `Quote for TEB > PBI ${A.long}`,
    from: "alex@centuryaviation.example",
    fromName: "Alex Tran",
    receivedAt: recv("2026-05-04T16:10:00Z"),
    bodyType: "text",
    body: `Hi,

Century Aviation can offer the following:

Aircraft: Citation VII
Tail: N707CA
YOM: 1994
Max passengers: 9
Total time: 5,120 hrs
Interior/Exterior refurb: 2018/2017

Price: $18,900

Please let us know.

Alex Tran
Century Aviation`,
    attachments: [],
  },
  {
    id: "email-008",
    subject: `RE: KTEB-KPBI ${A.mdyy}`,
    from: "info@aemaviation.example",
    fromName: "AEM Aviation",
    receivedAt: recv("2026-05-04T17:45:00Z"),
    bodyType: "text",
    body: `We have a PDF quote attached for your Teterboro to Palm Beach trip on ${A.monthDay}.

Please review the attached document for full details.

AEM Aviation
info@aemaviation.example`,
    attachments: [
      {
        filename: "AEM_Quote_TEB-PBI.pdf",
        contentType: "application/pdf",
        url: "",
      },
    ],
  },
  {
    id: "email-009",
    subject: `Quote: KTEB-KPBI ${A.mdyy}`,
    from: "bookings@royalflightclub.example",
    fromName: "Royal Flight Club",
    receivedAt: recv("2026-05-04T18:30:00Z"),
    bodyType: "text",
    body: `Hello,

Thank you for your inquiry. Please view our full quote and availability in our portal:

See our portal: https://example-operator.com/quote/abc123

For any questions, contact us directly.

Royal Flight Club
bookings@royalflightclub.example`,
    attachments: [],
  },

  // ============================================================
  // TRIP 2: KVNY → KASE, ${B.iso} (~6 quotes)
  // ============================================================
  {
    id: "email-010",
    subject: `Aircraft availability — KVNY/KASE ${B.iso}`,
    from: "ops@flightlevelservices.example",
    fromName: "Sarah Chen",
    receivedAt: recv("2026-05-05T09:00:00Z"),
    bodyType: "text",
    body: `Hi,

For your Van Nuys to Aspen charter on ${B.monthDay}:

Aircraft: Citation M2
Tail: N202FL
YOM: 2016
Max passengers: 6
Total time: 1,100 hrs
Interior/Exterior refurb: 2024/2023

Price: $22,350

Best,
Sarah Chen
Flight Level Services`,
    attachments: [],
  },
  {
    id: "email-011",
    subject: `RE: Van Nuys to Aspen ${B.mmddyyyy}`,
    from: "dispatch@trinitypj.example",
    fromName: "James Webb",
    receivedAt: recv("2026-05-05T10:30:00Z"),
    bodyType: "html",
    body: `<div>
<p>Hello,</p>
<p>Trinity Private Jet Charter has the following for your <b>KVNY to KASE</b> trip:</p>
<ul>
<li><strong>Aircraft:</strong> Pilatus PC-12/47E</li>
<li><strong>Tail:</strong> N412TP</li>
<li><strong>YOM:</strong> 2019</li>
<li><strong>Passengers:</strong> 6</li>
<li><strong>Total hours:</strong> 820 hrs</li>
<li><strong>Refurb (I/E):</strong> 2024/2024</li>
<li><strong>Price:</strong> $24,600</li>
</ul>
<p>Regards,<br>James Webb<br>Trinity Private Jet Charter</p>
</div>`,
    attachments: [],
  },
  {
    id: "email-012",
    subject: `Quote: KVNY-KASE ${B.mdyy}`,
    from: "quotes@atijet.example",
    fromName: "ATI Jet Operations",
    receivedAt: recv("2026-05-05T11:45:00Z"),
    bodyType: "text",
    body: `Good morning,

For the VNY-ASE trip on ${B.md}:

Aircraft: Learjet 60
Tail: N660AT
YOM: 2002
Max passengers: 7
Total time: 4,230 hrs
Interior/Exterior refurb: 2020/-

Price: $28,500

ATI Jet Executive Charter`,
    attachments: [],
  },
  {
    id: "email-013",
    subject: `Aircraft availability — KVNY/KASE ${B.iso}`,
    from: "charter@premierPrivateJets.example",
    fromName: "David Kim",
    receivedAt: recv("2026-05-05T13:00:00Z"),
    bodyType: "text",
    body: `Hi,

Premier Private Jets availability for Van Nuys to Aspen:

Aircraft: Challenger 350
Tail: N350PP
YOM: 2020
Max passengers: 10
Total time: 410 hrs
Interior/Exterior refurb: 2024/2024

Price: $45,200

David Kim
Premier Private Jets`,
    attachments: [],
  },
  {
    id: "email-014",
    subject: `KVNY/KASE ${B.iso} quote`,
    from: "alex@centuryaviation.example",
    fromName: "Alex Tran",
    receivedAt: recv("2026-05-05T14:30:00Z"),
    bodyType: "text",
    body: `Hello,

Century Aviation offers:

Aircraft: Citation CJ3
Tail: N303CA
YOM: 2010
Max passengers: 6
Total time: 2,450 hrs

Price: $25,100

Note: Refurb details available upon request.

Alex Tran
Century Aviation`,
    attachments: [],
  },
  {
    id: "email-015",
    subject: `Quote: KVNY-KASE ${B.mdyy}`,
    from: "info@aemaviation.example",
    fromName: "AEM Aviation",
    receivedAt: recv("2026-05-05T16:00:00Z"),
    bodyType: "text",
    body: `Attached is our PDF quote for the Van Nuys to Aspen trip.

AEM Aviation`,
    attachments: [
      {
        filename: "AEM_Quote_VNY-ASE.pdf",
        contentType: "application/pdf",
        url: "",
      },
    ],
  },

  // ============================================================
  // TRIP 3: KOPF → KTEB, ${C.iso} (~5 quotes)
  // ============================================================
  {
    id: "email-016",
    subject: `Trip request: Opa-Locka to Teterboro ${C.md}`,
    from: "mike@jetexcellence.example",
    fromName: "Mike Rodriguez",
    receivedAt: recv("2026-05-06T08:00:00Z"),
    bodyType: "text",
    body: `Hi,

Jet Excellence can offer the following for your OPF-TEB trip on ${C.md}:

Aircraft: Hawker 800XP
Tail: N800JE
YOM: 1999
Max passengers: 8
Total time: 4,567 hrs
Interior/Exterior refurb: 2021/2020

Price: $21,400

Best,
Mike Rodriguez
Jet Excellence`,
    attachments: [],
  },
  {
    id: "email-017",
    subject: `Charter quote — Opa-Locka to Teterboro on ${C.md}`,
    from: "ops@flightlevelservices.example",
    fromName: "Sarah Chen",
    receivedAt: recv("2026-05-06T09:30:00Z"),
    bodyType: "html",
    body: `<div style="font-family: Helvetica, sans-serif;">
<h3>Charter Quote</h3>
<p><strong>Route:</strong> KOPF → KTEB<br>
<strong>Date:</strong> ${C.long}</p>
<p><strong>Aircraft:</strong> Citation X<br>
<strong>Tail:</strong> N123XJ<br>
<strong>YOM:</strong> 2000<br>
<strong>Max passengers:</strong> 8<br>
<strong>Total time:</strong> 2,345 hrs<br>
<strong>Refurb (I/E):</strong> 2023/2022<br>
<strong>Price:</strong> $19,800</p>
<p>Thank you,<br>Sarah Chen<br>Flight Level Services</p>
</div>`,
    attachments: [],
  },
  {
    id: "email-018",
    subject: `RE: Opa-Locka to Teterboro ${C.mdyy}`,
    from: "dispatch@trinitypj.example",
    fromName: "James Webb",
    receivedAt: recv("2026-05-06T10:15:00Z"),
    bodyType: "text",
    body: `Hello,

Trinity Private Jet Charter — quote for OPF to TEB on ${C.md}:

Aircraft: Phenom 300
Tail: N300TJ
YOM: 2017
Max passengers: 8
Total time: 1,560 hrs
Interior/Exterior refurb: 2024/2023

Price: $27,600

James Webb
Trinity Private Jet Charter`,
    attachments: [],
  },
  {
    id: "email-019",
    subject: `KOPF-KTEB ${C.mdyy}`,
    from: "ops@merlin1.example",
    fromName: "MERLIN1 Ops",
    receivedAt: recv("2026-05-06T11:00:00Z"),
    bodyType: "text",
    body: `Quote for OPF-TEB, ${C.monthDay}:

Aircraft: Citation VII
Tail: N707ML
YOM: 1993
Max passengers: 9
Total time: 6,200 hrs
Interior/Exterior refurb: 2016/2015

Price: $19,100

MERLIN1`,
    attachments: [],
  },
  {
    id: "email-020",
    subject: `Charter quote — Opa-Locka to Teterboro on ${C.md}`,
    from: "bookings@royalflightclub.example",
    fromName: "Royal Flight Club",
    receivedAt: recv("2026-05-06T12:30:00Z"),
    bodyType: "text",
    body: `Hi,

Royal Flight Club offers:

Aircraft: Learjet 60
Tail: N606RF
YOM: 2005
Max passengers: 7
Total time: 3,100 hrs
Interior/Exterior refurb: 2022/2021

Price: $33,200

Royal Flight Club`,
    attachments: [],
  },
];


  return seedEmails.map((email) => ({
    ...email,
    attachments: email.attachments.map((att) => {
      const text = pdfQuoteTexts[att.filename];
      return text
        ? { ...att, url: `data:application/pdf;base64,${createTextPdfBase64(text)}` }
        : att;
    }),
  }));
}
