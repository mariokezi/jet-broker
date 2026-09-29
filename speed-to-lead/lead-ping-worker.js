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
