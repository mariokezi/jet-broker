# Demo run sheet

Before the call: log in, open **Settings**, click **Reset demo data**. Make sure the header shows **Demo data**. Confirm `ANTHROPIC_API_KEY` is set on the deployment so parsing and drafting show "Claude" instead of "Rules engine".

## 1. Dashboard (1 min)
"This is the broker's morning." Point at the **Today** list, the headline numbers, the next departure card, the pipeline stages and the route map. Everything else runs on its own.

## 2. New inquiry, live (3 min)
**New Inquiry** > click the **Hot: NY to Aspen** sample (or paste an email Vic gives you) > **Qualify and estimate**.
Show: extracted fields, lead score with reasons, market estimate by aircraft category. Then try the **Cold** sample to show a low-intent lead getting flagged.

## 3. RFQ and quotes streaming in (2 min)
Back on the Aspen lead, **Save and send RFQ to operators**. Quotes arrive over ~20 seconds, each parsed and ranked with a value score.

## 4. Proposal (2 min)
**Auto pick best 3** > set markup > **Draft with AI** > **Send proposal** > **Client view**. Show the branded client page and click **Reserve this aircraft**.

## 5. Email parsing (1 min)
**Quotes** > Teterboro to Palm Beach. Nine operator emails, including PDF attachments and a portal link flagged for review, all normalized into one table. Click a row to show the original email.

## 6. Empty Legs network (2 min)
**Empty Legs** in the nav. Brokers and operators post repositioning flights that would otherwise fly back empty. Show the Florida filter, then the green **Matches for your clients** box: the app spotted that a Fort Lauderdale to Teterboro leg fits Marcus Delgado's trip at about half the charter price. Open it, message the operator ("what's your best price?"), then **Claim this leg for a client**. The operator confirms and it lands in the schedule.

## 7. Schedule (1 min)
The bookings you just made appear with margin and the ops checklist. On any upcoming booking, click **Post empty return** to list the flight home on the network; another broker replies within seconds.

## 8. Seat shares: sell part of a jet (2 min)
**Empty Legs** > **Seat shares** tab > the Teterboro to Palm Beach Challenger. The cabin map shows zones (forward club, conference, divan) with sold and open seats, prices per seat and per whole zone, and seat revenue against the whole plane price. Click **Sell seats**, add a name, sell. Then **Open the passenger booking page** to show what a passenger sees, and reserve a seat there. A "Seat sold online" alert pops up.

## 9. Live flight tracking (1 min)
Reset demo data about 5 minutes before the call. Sophia Martinez is in the air HPN to MIA and lands about 15 minutes after the reset; Victoria Lane departs TEB about 8 minutes after it. The dashboard **Live flights** card shows progress, and alerts pop up at wheels up and landing. The client gets an automatic text and the trip channel logs it. **Schedule** > click the flight for the tracking timeline.

## 10. Messages and clients (2 min)
**Messages**: the ops room, a channel for each trip, and one thread per client with Email or Text replies. Message Richard Hale; he answers. **Clients** > a client for lifetime spend, trips (including shared flight seats), preferences and recent messages.

## 11. Operator portal: the live network (3 min, the wow moment)
Click **Live network view** in the sidebar. The broker workspace is on the left and the operator portal is on the right. On the right, sign in as `mike@jetexcellence.example` (Jet Excellence) with the operator password (default `fly2026`).
1. Right side: show **Fleet** (their jets, rates, availability) and **Calendar** (booked trips, maintenance blocks). Click an open day to block an aircraft.
2. Left side: **New Inquiry** > Hot sample > **Save and send RFQ**. Within a second the right side pops a "New RFQ" alert.
3. Right side: **Requests** > open it. The left side now shows "Jet Excellence is looking at it". The portal has already picked a free aircraft and priced it from their own hourly rate. Click **Send quote**.
4. Left side: a gold "just quoted" alert, and the quote lands at the top of the board tagged **Live via Network**. No email, no parsing. Click **Book** on it.
5. Right side: "Booked" alert, "You won this trip", and the trip is on their calendar.
6. Bonus: on the right, **Empty Legs** > **Post return**. The left side gets the leg instantly. Claim Jet Excellence's Boston to Teterboro leg on the left; it waits until the operator clicks **Accept and book** on the right.

## 12. Live inbox (optional)
Toggle **Live inbox** only if Outlook is connected to an inbox you're comfortable showing.

Note: in demo mode, RFQ responses from operators not on the portal and the other brokers on the Empty Legs network are simulated (the pages say so). Jet Excellence and Premier Private Jets answer through the operator portal for real. Everything else, parsing, scoring, estimates, drafting, is the real pipeline.
