import "server-only";
import { cookies } from "next/headers";
import { getStoredRefreshToken } from "./auth";
import { DATA_MODE_COOKIE, DEMO_ANCHOR_COOKIE } from "./demo-clock";

export type DataMode = "demo" | "live";

export interface DataContext {
  mode: DataMode;
  anchorMs: number;
  outlookLinked: boolean;
}

/**
 * Demo mode serves the built-in demo inbox. Live mode reads Outlook.
 * Defaults to live when an Outlook account is linked, demo otherwise;
 * the header toggle stores an explicit choice in a cookie.
 */
export async function getDataContext(): Promise<DataContext> {
  const store = await cookies();
  let outlookLinked = false;
  try {
    outlookLinked = (await getStoredRefreshToken()) !== null;
  } catch {
    outlookLinked = false;
  }
  const chosen = store.get(DATA_MODE_COOKIE)?.value;
  const mode: DataMode = chosen === "demo" || chosen === "live" ? chosen : outlookLinked ? "live" : "demo";
  const anchorRaw = Number(store.get(DEMO_ANCHOR_COOKIE)?.value);
  const anchorMs = Number.isFinite(anchorRaw) && anchorRaw > 0 ? anchorRaw : Date.now();
  return { mode, anchorMs, outlookLinked };
}
