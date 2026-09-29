# Speed to Lead: HELOC alert to your phone

When a visitor starts a HELOC application, GTM pings a Cloudflare Worker. The Worker sends an ntfy alert to your phone. Tap it and your Figure dashboard opens.

```
helocStarted fires → GTM pings your Worker (no personal info)
→ Worker sends alert to ntfy → your phone buzzes → tap → Figure opens
```

The Worker keeps your ntfy channel name as a secret, so it never appears in your site's code, and it only accepts pings from your site.

## Step 1: Phone app (2 min)

1. Install **ntfy** (iOS or Android) and allow notifications.
2. Make up a hard to guess channel name, like `mario-leads-8x72kq`.
3. Tap **+** in the app and subscribe to that name.

## Step 2: Create the Worker (5 min)

1. Sign up free at cloudflare.com and open the dashboard.
2. Go to **Workers & Pages → Create → Start with Hello World**.
3. Name it `lead-ping` and click **Deploy**.
4. Click **Edit code**, delete everything, and paste the Worker code below.
5. Click **Deploy**.

```js
// Cloudflare Worker: turns a GTM "helocStarted" ping into an ntfy phone alert.
// Settings (Worker → Settings → Variables and Secrets):
//   NTFY_TOPIC      Secret  your private ntfy channel name
//   FIGURE_LINK     Text    Figure dashboard link opened when you tap the alert
//   ALLOWED_ORIGIN  Text    site address(es), comma separated, e.g.
//                           https://yoursite.com,https://www.yoursite.com

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || "")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, "").toLowerCase())
      .filter(Boolean);
    const origin = getOrigin(request);
    const originOk = origin && allowed.includes(origin);

    const cors = originOk
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {};

    if (request.method === "GET") {
      return new Response("Lead ping worker is running.", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: originOk ? 204 : 403,
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (!originOk) {
      console.log(`Blocked ping from origin: ${origin || "(none)"}`);
      return new Response("Forbidden", { status: 403 });
    }

    if (!env.NTFY_TOPIC) {
      console.log("NTFY_TOPIC is not set");
      return new Response("Not configured", { status: 500 });
    }

    const headers = {
      Title: "New HELOC lead started",
      Priority: "high",
      Tags: "moneybag",
    };
    if (env.FIGURE_LINK) headers.Click = env.FIGURE_LINK;

    const res = await fetch(
      `https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`,
      {
        method: "POST",
        headers,
        body: "Someone just started a HELOC application. Tap to open Figure.",
      },
    );

    if (!res.ok) {
      console.log(`ntfy error ${res.status}: ${await res.text()}`);
      return new Response("Notify failed", { status: 502, headers: cors });
    }

    return new Response(null, { status: 204, headers: cors });
  },
};

// Browsers send Origin on POST; fall back to Referer just in case.
function getOrigin(request) {
  const raw = request.headers.get("Origin") || request.headers.get("Referer");
  if (!raw || raw === "null") return "";
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return "";
  }
}
```

## Step 3: Add the Worker's settings (3 min)

In the Worker, go to **Settings → Variables and Secrets → Add**:

| Name | Type | Value |
| --- | --- | --- |
| `NTFY_TOPIC` | Secret | your channel name |
| `FIGURE_LINK` | Text | your Figure dashboard link |
| `ALLOWED_ORIGIN` | Text | your site address with nothing after it, like `https://www.yoursite.com`. If your site works with and without www, list both with a comma between them. |

Save, then copy the Worker address from the top of the page (like `https://lead-ping.yourname.workers.dev`).

## Step 4: Test the Worker (1 min)

Open the Worker address in your browser. You should see **Lead ping worker is running.** Your phone won't buzz yet, because opening the page isn't a ping.

## Step 5: GTM trigger (2 min)

Skip this if the trigger already exists.

1. Go to **Triggers → New → Custom Event**.
2. Event name: `helocStarted`.
3. Choose **All Custom Events**, then save.

## Step 6: GTM tag (2 min)

1. Go to **Tags → New → Custom HTML**, name it **Lead Ping**, and paste this with your Worker address:

   ```html
   <script>
   navigator.sendBeacon('https://lead-ping.yourname.workers.dev', 'ping');
   </script>
   ```

2. Set the trigger to **helocStarted** and save.

## Step 7: Meta Pixel (optional)

1. Set the Meta Pixel **Lead** tag's trigger to **helocStarted**.
2. Don't add any lead details to it.
3. If the pixel code is also pasted directly in your site, remove that copy so leads don't count twice.

## Step 8: Test and go live (3 min)

1. In GTM, click **Preview** and create a test account with fake info. Your phone should buzz, and tapping it should open Figure.
2. No buzz? Open the Worker's **Logs** tab in Cloudflare.
   * **403** and "Blocked ping from origin": `ALLOWED_ORIGIN` doesn't match your site address. The log shows the exact address to use.
   * **500** "NTFY_TOPIC is not set": add the secret from Step 3.
   * **502** "ntfy error": check the channel name.
3. Click **Submit → Publish**, then do one live test.

## Notes

* Everything stays on free plans. Cloudflare allows 100,000 requests a day at no cost.
* The origin check stops other websites from pinging you, but someone with technical skill could still fake a ping. If you ever get junk alerts, add a Cloudflare rate limit rule on the Worker, or change the channel name.
* No personal info leaves your site. The ping body is just the word `ping`.
