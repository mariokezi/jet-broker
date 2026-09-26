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

## 6. Schedule (1 min)
The booking you just made appears with margin and the ops checklist.

## 7. Live inbox (optional)
Toggle **Live inbox** only if Outlook is connected to an inbox you're comfortable showing.

Note: in demo mode, operator RFQ responses are simulated (the page says so). Everything else, parsing, scoring, estimates, drafting, is the real pipeline.
