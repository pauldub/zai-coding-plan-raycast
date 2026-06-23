import { Color } from "@raycast/api";

export type Severity = "green" | "yellow" | "red";

export function severity(pct: number): Severity {
  if (pct >= 90) return "red";
  if (pct >= 70) return "yellow";
  return "green";
}

export const colorFor: Record<Severity, Color> = {
  green: Color.Green,
  yellow: Color.Yellow,
  red: Color.Red,
};

export const emojiFor: Record<Severity, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

export function formatCountdown(
  targetMs: number,
  now: number = Date.now(),
): string {
  const diff = targetMs - now;
  if (diff <= 0) return "resets soon";
  const totalMin = Math.floor(diff / 60_000);
  if (totalMin < 60) return `resets in ${totalMin}m`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hr < 24) return min ? `resets in ${hr}h ${min}m` : `resets in ${hr}h`;
  const d = Math.floor(hr / 24);
  const h = hr % 24;
  return h ? `resets in ${d}d ${h}h` : `resets in ${d}d`;
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function progressBar(pct: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return (
    "▰".repeat(filled) + "▱".repeat(width - filled) + ` ${Math.round(clamped)}%`
  );
}
