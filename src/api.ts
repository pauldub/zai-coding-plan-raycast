import { getPreferenceValues } from "@raycast/api";

const ZAI_BASE = "https://api.z.ai/api";

// ---- Raw response types ----------------------------------------------------

export interface UsageDetail {
  modelCode: string;
  usage: number;
}

export interface RawLimit {
  type: "TIME_LIMIT" | "TOKENS_LIMIT";
  unit: number;
  number?: number;
  percentage: number;
  nextResetTime: number; // epoch ms
  // Present only on TIME_LIMIT (MCP):
  usage?: number; // cap
  currentValue?: number; // used
  remaining?: number;
  usageDetails?: UsageDetail[];
}

export interface RawQuotaResponse {
  code: number;
  msg: string;
  success: boolean;
  data?: {
    level: string;
    limits: RawLimit[];
  };
}

// ---- Errors ----------------------------------------------------------------

export class ZaiApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "ZaiApiError";
    this.code = code;
  }
}

// ---- Fetch -----------------------------------------------------------------

export async function fetchQuota(
  apiKey: string,
  signal?: AbortSignal,
): Promise<RawQuotaResponse> {
  let res: Response;
  try {
    res = await fetch(`${ZAI_BASE}/monitor/usage/quota/limit`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal,
    });
  } catch (e) {
    throw new ZaiApiError(
      0,
      e instanceof Error ? e.message : "Network request failed",
    );
  }

  let json: RawQuotaResponse;
  try {
    json = (await res.json()) as RawQuotaResponse;
  } catch {
    throw new ZaiApiError(
      res.status || 0,
      `Unexpected response (HTTP ${res.status})`,
    );
  }

  if (!res.ok || !json.success || json.code !== 200 || !json.data) {
    const code = json.code ?? res.status ?? 0;
    const msg = json.msg || `Request failed (HTTP ${res.status})`;
    throw new ZaiApiError(code, msg);
  }
  return json;
}

// ---- Normalized domain model ----------------------------------------------

export type WindowKind = "five-hour" | "weekly" | "mcp";

export interface QuotaWindow {
  kind: WindowKind;
  label: string;
  period: string;
  percentage: number; // 0-100
  used?: number; // MCP only
  total?: number; // MCP only
  remaining?: number; // MCP only
  nextResetTime: number; // epoch ms
  toolBreakdown?: UsageDetail[]; // MCP only
}

export interface PlanUsage {
  level: string;
  windows: QuotaWindow[];
  fetchedAt: number;
}

const TOOL_LABELS: Record<string, string> = {
  "search-prime": "Web Search",
  "web-reader": "Web Reader",
  zread: "Zread",
};

export function toolLabel(code: string): string {
  return TOOL_LABELS[code] ?? code;
}

const LABELS: Record<WindowKind, string> = {
  "five-hour": "5-Hour Window",
  weekly: "Weekly Window",
  mcp: "MCP Tools",
};

const PERIODS: Record<WindowKind, string> = {
  "five-hour": "rolling 5h",
  weekly: "rolling 7d",
  mcp: "monthly",
};

function classify(limit: RawLimit): WindowKind {
  if (limit.type === "TIME_LIMIT") return "mcp";
  if (limit.unit === 3) return "five-hour";
  if (limit.unit === 6) return "weekly";
  // Defensive fallback: infer from reset proximity.
  const hoursUntilReset = (limit.nextResetTime - Date.now()) / 3_600_000;
  return hoursUntilReset < 12 ? "five-hour" : "weekly";
}

export function normalize(raw: RawQuotaResponse): PlanUsage {
  const windows: QuotaWindow[] = (raw.data?.limits ?? []).map((l) => {
    const kind = classify(l);
    return {
      kind,
      label: LABELS[kind],
      period: PERIODS[kind],
      percentage: l.percentage,
      used: l.currentValue,
      total: l.usage,
      remaining: l.remaining,
      nextResetTime: l.nextResetTime,
      toolBreakdown: l.usageDetails,
    };
  });

  const order: WindowKind[] = ["five-hour", "weekly", "mcp"];
  windows.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  return {
    level: raw.data?.level ?? "unknown",
    windows,
    fetchedAt: Date.now(),
  };
}

export async function fetchPlanUsage(
  apiKey: string,
  signal?: AbortSignal,
): Promise<PlanUsage> {
  return normalize(await fetchQuota(apiKey, signal));
}

// ---- Preferences -----------------------------------------------------------

interface Preferences {
  apiKey: string;
}

export function getApiKey(): string {
  return getPreferenceValues<Preferences>().apiKey.trim();
}

// ---- Friendly error text ---------------------------------------------------

export function friendlyError(err: unknown): string {
  if (err instanceof ZaiApiError) {
    if (err.code === 1001)
      return "API key rejected. Open preferences to update it.";
    if (err.code === 401)
      return "Authentication failed. Check your z.ai API key.";
    return `${err.message} (code ${err.code})`;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}
