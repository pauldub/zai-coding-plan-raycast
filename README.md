# Z.ai Coding Plan Usage

A Raycast extension to track your **GLM Coding Plan** (Lite / Pro / Max) subscription
usage directly from the z.ai API:

- **5-hour** and **weekly** prompt windows — `% used` + reset countdown
- **MCP tools** (monthly) — `used / total` + per-tool breakdown (Web Search, Web Reader, Zread)
- **Plan tier** and an informational **peak/off-peak** badge (peak = 14:00–18:00 UTC+8, 3× quota cost)
- An always-on **menu-bar indicator** showing your most-constrained window

## Setup

1. Get your z.ai API key: **z.ai → Profile → API Keys** → create a key.
2. Open the extension in Raycast. You'll be prompted for your **Z.ai API Key**.
3. Paste it (stored in the macOS keychain via Raycast).

## Commands

- **Show Coding Plan Usage** — full dashboard (List view) with one section per
  quota window, plus MCP per-tool breakdown. `⌘R` to refresh.
- **Coding Plan Usage Bar** — menu-bar indicator: `🟢 31%` reflects the worst
  window's usage. Auto-refreshes every 5 min. Dropdown shows all windows.

## Severity colors

| Used % | Color |
| --- | --- |
| `< 70` | 🟢 green |
| `70–89` | 🟡 yellow |
| `≥ 90` | 🔴 red |

## How it works

Calls the undocumented but API-key-accessible endpoint
`GET https://api.z.ai/api/monitor/usage/quota/limit` (the same one the z.ai
dashboard's Usage Statistics page uses).

**Limitations (Tier 1):**
- Prompt windows expose **percentage only** (no raw prompt counts) — that's all
  the API returns to the API key. MCP shows full `used / total`.
- Plan **renewal date** is not available via the API key.

See [`SPEC.md`](./SPEC.md) for the full spec, API contract, and the Tier 2
roadmap (per-model / per-tool time-series analytics, which require the web JWT).

## Develop

```bash
npm install
npm run build   # typecheck + bundle via `ray build`
npm run dev     # hot-reload inside Raycast
```

## License

MIT
