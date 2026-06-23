import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { fetchPlanUsage, friendlyError, getApiKey, toolLabel } from "./api";
import {
  colorFor,
  formatCountdown,
  formatTimestamp,
  progressBar,
  severity,
} from "./format";
import { getPeakStatus } from "./peak";

const USAGE_URL = "https://z.ai/manage-apikey/coding-plan/personal/usage";
const APIKEY_URL = "https://z.ai/manage-apikey/apikey-list";

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function actions(revalidate: (() => void) | undefined) {
  return (
    <ActionPanel>
      {revalidate ? (
        <Action
          icon={Icon.ArrowClockwise}
          title="Refresh"
          onAction={revalidate}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
        />
      ) : null}
      <Action.OpenInBrowser title="Open Usage Statistics" url={USAGE_URL} />
      <Action.OpenInBrowser title="Open API Keys" url={APIKEY_URL} />
    </ActionPanel>
  );
}

export default function Command() {
  const apiKey = getApiKey();
  const { data, error, isLoading, revalidate } = usePromise(() =>
    fetchPlanUsage(apiKey),
  );
  const peak = getPeakStatus();

  if (error) {
    return (
      <List>
        <List.Section title="Error">
          <List.Item
            icon={{ source: Icon.Warning, tintColor: Color.Red }}
            title="Couldn't load usage"
            subtitle={friendlyError(error)}
            actions={actions(undefined)}
          />
        </List.Section>
      </List>
    );
  }

  const mcp = data?.windows.find((w) => w.kind === "mcp");
  const promptWindows = data?.windows.filter((w) => w.kind !== "mcp") ?? [];

  return (
    <List isLoading={isLoading}>
      {data ? (
        <>
          <List.Section title="Plan">
            <List.Item
              icon={{ source: Icon.Star, tintColor: Color.Purple }}
              title={`GLM Coding Plan · ${titleCase(data.level)}`}
              subtitle={`Updated ${formatTimestamp(data.fetchedAt)}`}
              accessories={[
                {
                  tag: {
                    value: peak.isPeak ? "Peak" : "Off-peak",
                    color: peak.isPeak ? Color.Orange : Color.Green,
                  },
                  tooltip: peak.label,
                },
              ]}
              actions={actions(revalidate)}
            />
          </List.Section>

          {promptWindows.map((w) => {
            const sev = severity(w.percentage);
            return (
              <List.Section key={w.kind} title={w.label}>
                <List.Item
                  icon={{ source: Icon.Gauge, tintColor: colorFor[sev] }}
                  title={w.label}
                  subtitle={progressBar(w.percentage)}
                  accessories={[
                    { text: w.period },
                    {
                      tag: {
                        value: formatCountdown(w.nextResetTime),
                        color: colorFor[sev],
                      },
                    },
                  ]}
                  actions={actions(revalidate)}
                />
              </List.Section>
            );
          })}

          {mcp ? (
            <List.Section title="MCP Tools · monthly">
              <List.Item
                icon={{
                  source: Icon.Gauge,
                  tintColor: colorFor[severity(mcp.percentage)],
                }}
                title="MCP Tools"
                subtitle={
                  mcp.used != null && mcp.total != null
                    ? `${mcp.used} / ${mcp.total} used · ${progressBar(mcp.percentage, 8)}`
                    : progressBar(mcp.percentage)
                }
                accessories={[
                  ...(mcp.remaining != null
                    ? [{ text: `${mcp.remaining} left` }]
                    : []),
                  {
                    tag: {
                      value: formatCountdown(mcp.nextResetTime),
                      color: colorFor[severity(mcp.percentage)],
                    },
                  },
                ]}
                actions={actions(revalidate)}
              />
              {(mcp.toolBreakdown ?? []).map((t) => (
                <List.Item
                  key={t.modelCode}
                  icon={{ source: Icon.Dot, tintColor: Color.SecondaryText }}
                  title={`   ${toolLabel(t.modelCode)}`}
                  subtitle={`${t.usage} call${t.usage === 1 ? "" : "s"}`}
                  actions={actions(revalidate)}
                />
              ))}
            </List.Section>
          ) : null}
        </>
      ) : null}
    </List>
  );
}
