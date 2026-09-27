# Demo run sheet

Before the call: log in, open **Settings**, click **Reset demo data**. Make sure the header shows **Demo data**. Confirm `ANTHROPIC_API_KEY` is set on the deployment so parsing and drafting show "Claude" instead of "Rules engine".

## 1. Dashboard (1 min)
"This is the broker's morning." Point at **Needs your attention**, the pipeline, upcoming flights, and **Hours saved**. Everything else runs on its own.

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

## 8. Live inbox (optional)
Toggle **Live inbox** only if Outlook is connected to an inbox you're comfortable showing.

Note: in demo mode, operator RFQ responses and the other brokers on the Empty Legs network are simulated (the pages say so). Everything else, parsing, scoring, estimates, drafting, is the real pipeline.
