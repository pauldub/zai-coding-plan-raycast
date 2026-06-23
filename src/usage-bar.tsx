import { Color, Icon, MenuBarExtra, open } from "@raycast/api";
import { useEffect, useState } from "react";
import { fetchPlanUsage, getApiKey, PlanUsage, toolLabel } from "./api";
import { colorFor, emojiFor, formatCountdown, severity } from "./format";

const REFRESH_MS = 5 * 60 * 1000;
const USAGE_URL = "https://z.ai/manage-apikey/coding-plan/personal/usage";

export default function Command() {
  const apiKey = getApiKey();
  const [data, setData] = useState<PlanUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setData(await fetchPlanUsage(apiKey));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const loading = !data && !error;
  const windows = data?.windows ?? [];
  const worst =
    windows.length > 0
      ? windows.reduce((a, b) => (b.percentage > a.percentage ? b : a))
      : undefined;
  const sev = worst ? severity(worst.percentage) : "green";

  const title = error
    ? "⚠︎"
    : worst
      ? `${emojiFor[sev]} ${worst.percentage}%`
      : "";
  const tooltip = data
    ? `GLM Coding Plan · ${data.level} — ${data.windows.map((w) => `${w.label} ${w.percentage}%`).join(" · ")}`
    : (error ?? "Loading…");

  return (
    <MenuBarExtra title={title} tooltip={tooltip} isLoading={loading}>
      {data ? (
        <>
          <MenuBarExtra.Section title={`GLM Coding Plan · ${data.level}`}>
            <MenuBarExtra.Item
              title="Open Usage Statistics"
              icon={Icon.Globe}
              onAction={() => open(USAGE_URL)}
            />
            <MenuBarExtra.Item
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={load}
            />
          </MenuBarExtra.Section>

          {data.windows.map((w) => {
            const s = severity(w.percentage);
            return (
              <MenuBarExtra.Section
                key={w.kind}
                title={`${w.label} · ${w.period}`}
              >
                <MenuBarExtra.Item
                  title={w.label}
                  subtitle={`${w.percentage}%`}
                  icon={{ source: Icon.Circle, tintColor: colorFor[s] }}
                />
                <MenuBarExtra.Item title={formatCountdown(w.nextResetTime)} />
                {w.kind === "mcp" && w.used != null && w.total != null ? (
                  <MenuBarExtra.Item title={`${w.used} / ${w.total} used`} />
                ) : null}
                {w.kind === "mcp"
                  ? (w.toolBreakdown ?? []).map((t) => (
                      <MenuBarExtra.Item
                        key={t.modelCode}
                        title={`   ${toolLabel(t.modelCode)}`}
                        subtitle={`${t.usage}`}
                      />
                    ))
                  : null}
              </MenuBarExtra.Section>
            );
          })}
        </>
      ) : error ? (
        <MenuBarExtra.Item
          title={`Error: ${error}`}
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
        />
      ) : (
        <MenuBarExtra.Item title="Loading…" />
      )}
    </MenuBarExtra>
  );
}
