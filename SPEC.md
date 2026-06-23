# Z.ai Coding Plan Usage — Raycast Extension (SPEC)

Track your **GLM Coding Plan** subscription usage from Raycast: 5-hour and weekly
prompt windows, MCP tools, plan tier, and reset countdowns — plus an always-on
menu-bar indicator.

> **Status:** Tier 1 (API-key only). See [Scope](#scope).

---

## Background — how the GLM Coding Plan quota works

The GLM Coding Plan (Lite / Pro / Max) gates usage with **two prompt windows** and
a **separate MCP budget**:

| Window | Resets | Plan allowance (approx.) |
|---|---|---|
| **5-hour** (rolling) | 5h after consumption | Lite ~80 / Pro ~400 / Max ~1600 prompts |
| **Weekly** (rolling 7d) | every 7 days | Lite ~400 / Pro ~2000 / Max ~8000 prompts |
| **MCP tools** (monthly) | billing cycle | search + reader + zread: Lite 100 / Pro 1000 / Max 4000 |

Quota **costs more during peak hours**: 14:00–18:00 **UTC+8** (Beijing) =
06:00–10:00 UTC. GLM-5.2 / GLM-5-Turbo count **3×** in peak, 2× off-peak
(currently a promo makes off-peak 1×). The API already returns the *effective*
post-multiplier percentage, so the extension never needs to compute cost.

---

## Scope

### In scope — Tier 1 (API key only)
- One credential: the user's **z.ai API key**.
- Live quota from `GET /api/monitor/usage/quota/limit`.
- Two commands: **Show Usage** (List) + **Usage Bar** (menu-bar).
- Plan tier, 3 quota windows (% used + reset countdown), MCP per-tool breakdown.
- Peak/off-peak informational badge (computed locally from UTC time).
- Manual refresh + auto-refresh (menu bar every 5 min).

### Out of scope — Tier 2 (JWT, future)
Reverse-engineered analytics endpoints require the **web-session JWT** (the coding
API key returns `code:401`). Deferred until a refresh story exists:
- `GET /api/monitor/usage/model-usage` — per-model token series (hourly).
- `GET /api/monitor/usage/tool-usage` — per-MCP-tool usage series.
- `GET /api/monitor/usage/model-performance-day` — decode speed + success rate.

---

## API Contract (Tier 1)

### Endpoint
```
GET https://api.z.ai/api/monitor/usage/quota/limit
```

### Auth
```
Authorization: Bearer <ZAI_API_KEY>
Accept: application/json
```
The coding API key (the same one used at `api/coding/paas/v4`) authorizes this
endpoint. **No cookies, no `Bigmodel-Organization` / `Bigmodel-Project` headers
required** (verified). No request params.

### Response
```jsonc
{
  "code": 200,
  "msg": "Operation successful",
  "success": true,
  "data": {
    "level": "pro",          // plan tier: "lite" | "pro" | "max"
    "limits": [
      {
        "type": "TIME_LIMIT", "unit": 5, "number": 1,
        "usage": 1000, "currentValue": 318, "remaining": 682,
        "percentage": 31, "nextResetTime": 1782722300995,
        "usageDetails": [
          { "modelCode": "search-prime", "usage": 148 },
          { "modelCode": "web-reader",  "usage": 0 },
          { "modelCode": "zread",       "usage": 0 }
        ]
      },
      {
        "type": "TOKENS_LIMIT", "unit": 3, "number": 5,
        "percentage": 5, "nextResetTime": 1782255763496
      },
      {
        "type": "TOKENS_LIMIT", "unit": 6, "number": 1,
        "percentage": 14, "nextResetTime": 1782635900998
      }
    ]
  }
}
```

### Field semantics (decoded from observed data)

| `(type, unit)` | Meaning | `nextResetTime` decoded |
|---|---|---|
| `TIME_LIMIT` / `5` | **MCP tools — monthly** | ~6d out → next billing cycle |
| `TOKENS_LIMIT` / `3` | **5-hour window** | ~4.5h out |
| `TOKENS_LIMIT` / `6` | **Weekly window** | ~5d out |

- `percentage` is present on **all** limits (post-multiplier, effective % used).
- `usage` (= cap), `currentValue` (= used), `remaining`, `usageDetails` are present
  **only on `TIME_LIMIT`** (MCP). The two prompt windows expose **percentage only**
  — no raw prompt counts. The UI reflects this: prompt windows show `% + countdown`,
  MCP shows `used / total` + per-tool.
- `nextResetTime` is **epoch milliseconds**.
- Classification is by `(type, unit)` with a fallback: if a `TOKENS_LIMIT` has an
  unknown `unit`, infer from reset proximity (<12h → 5-hour, else weekly). This
  keeps the UI alive if z.ai renumbers `unit`.

### Decoded reset-time analysis (anchor call, 2026-06-23 ~18:37 UTC)
- `TIME_LIMIT unit=5` → 2026-06-29 (monthly MCP)
- `TOKENS_LIMIT unit=3` → 2026-06-23 23:02 (5-hour)
- `TOKENS_LIMIT unit=6` → 2026-06-28 (weekly)

### Error modes (all return **HTTP 200**, app-level `code` in body)
| Body `code` | Meaning | UI message |
|---|---|---|
| `1001` | "Authentication parameter not received…" | "API key rejected. Update it in preferences." |
| `401` | "token expired or incorrect" | "Authentication failed. Check your z.ai API key." |
| other non-200 `code` / `success:false` | generic | Show `msg` verbatim with code. |

> Note: the auth-split between `quota/limit` (API key ✅) and the analytics trio
> (JWT only) was confirmed during discovery. Tier 1 stays on the API key.

---

## Data Model

Raw response → normalized domain model (see `src/api.ts`):

```ts
type WindowKind = "five-hour" | "weekly" | "mcp";

interface QuotaWindow {
  kind: WindowKind;
  label: string;        // "5-Hour Window" | "Weekly Window" | "MCP Tools"
  period: string;       // "rolling 5h" | "rolling 7d" | "monthly"
  percentage: number;   // 0–100
  used?: number;        // MCP only
  total?: number;       // MCP only
  remaining?: number;   // MCP only
  nextResetTime: number;// epoch ms
  toolBreakdown?: { modelCode: string; usage: number }[]; // MCP only
}

interface PlanUsage {
  level: string;                  // "lite" | "pro" | "max"
  windows: QuotaWindow[];         // sorted: five-hour, weekly, mcp
  fetchedAt: number;              // epoch ms (client-side)
}
```

Tool code → label: `search-prime`→"Web Search", `web-reader`→"Web Reader",
`zread`→"Zread"; unknown codes pass through.

---

## Architecture

```
src/
├── api.ts          # fetchQuota + types + normalize() + ZaiApiError
├── format.ts       # severity, color/emoji maps, countdown, progress bar
├── peak.ts         # peak-hours status (local UTC computation)
├── show-usage.tsx  # "Show Coding Plan Usage" — List command
└── usage-bar.tsx   # "Coding Plan Usage Bar" — MenuBarExtra command
```

---

## Commands

### 1. `show-usage` — Show Coding Plan Usage (`mode: view`, List)

**Sections:**
1. **Plan** — `GLM Coding Plan · <Tier>`, subtitle "Updated <time>", accessory
   `Peak`/`Off-peak` tag (tooltip = peak detail).
2. **5-Hour Window** — icon (gauge tinted by severity), subtitle = ASCII progress
   bar (`▰▰▰▱▱▱▱▱▱▱ 31%`), accessories = `[period, countdown tag]`.
3. **Weekly Window** — same shape as above.
4. **MCP Tools · monthly** — subtitle `318 / 1000 used · ▰▰▰▱ 31%`, accessories
   `[<remaining> left, countdown]`; followed by one indented sub-item per tool
   (`Web Search · 148 calls`, …).

**Actions** (`ActionPanel`, attached to every item):
- **Refresh** (`⌘R`) — re-run fetch.
- **Open Usage Statistics** — `https://z.ai/manage-apikey/coding-plan/personal/usage`
- **Open API Keys** — `https://z.ai/manage-apikey/apikey-list`

**Error state:** single red item "Couldn't load usage" with `friendlyError()` text
+ open-actions.

### 2. `usage-bar` — Coding Plan Usage Bar (`mode: menu-bar`, MenuBarExtra)

- **Title:** `🟢 31%` — the **worst** window's percentage (max across windows),
  prefixed with a severity emoji. `⚠︎` on error, blank while loading.
- **Tooltip:** `GLM Coding Plan · pro — 5-Hour 5% · Weekly 14% · MCP 31%`.
- **Auto-refresh:** every 5 minutes (`setInterval`).
- **Dropdown:** a section per window with `%`, severity-tinted circle, countdown,
  and (MCP only) `used/total` + per-tool counts. Plus a Plan section with
  **Refresh** and **Open Usage Statistics** items.

### Severity thresholds (shared)
| Used % | Severity | Color | Emoji |
|---|---|---|---|
| `< 70` | green | `Color.Green` | 🟢 |
| `70–89` | yellow | `Color.Yellow` | 🟡 |
| `≥ 90` | red | `Color.Red` | 🔴 |

---

## Preferences

| Name | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `password` | yes | z.ai API key (stored in macOS keychain by Raycast) |

Stored via Raycast keychain (`type: password`). No JWT in Tier 1.

---

## Refresh & caching

- **List command:** fetch on mount (`useAsync`), manual `⌘R` refresh. No
  persistent cache (always-fresh when opened).
- **Menu bar:** fetch on mount + every 5 min via `setInterval`. Lightweight
  enough to avoid LocalStorage caching; if the API ever gets slow we can add
  `useCachedState` with a short TTL.

---

## Edge cases & error handling
- `code:1001` / `code:401` → friendly "check your API key" message (no stack trace).
- Network failure / non-JSON → `ZaiApiError(0, "Unexpected response (HTTP …)")`.
- Empty `windows` array → render an empty list (degrades gracefully).
- Unknown `modelCode` → render the raw code.
- Unknown `unit` on `TOKENS_LIMIT` → classify by reset proximity (see Field semantics).
- `nextResetTime` in the past → countdown shows "resets soon".

---

## Peak-hours badge (informational)
Computed **locally** from the current UTC time (no API call). Peak window in UTC is
`[06:00, 10:00)` (= 14:00–18:00 UTC+8). Badge text:
- Peak: `Peak hours (3× quota cost) · ends in Nh`
- Off-peak: `Off-peak (lower cost) · peak in Nh`
This is informational only; the API's `percentage` already reflects effective cost.

---

## Build sequence
1. `package.json` (commands, preferences, deps) + `tsconfig.json`.
2. `src/api.ts` — types, `fetchQuota`, `normalize`, `ZaiApiError`.
3. `src/format.ts` + `src/peak.ts` — pure helpers.
4. `src/show-usage.tsx` — List command (plan, windows, MCP breakdown, actions).
5. `src/usage-bar.tsx` — MenuBarExtra command (worst-window indicator).
6. `npm install` → `npx tsc --noEmit` → fix.
7. `npm run build` (Raycast `ray build`) to confirm bundling.
8. Add `icon.png` (512×512) — **TODO** before publishing to the store.

---

## Risks & open questions
- **Undocumented API.** `quota/limit` is not in z.ai's public OpenAPI spec. It may
  change shape, move, or start rejecting the API key. Mitigation: defensive
  parsing, unit-fallback classification, friendly errors.
- **`unit` mapping is inferred**, not documented. The reset-proximity fallback
  covers renumbering for `TOKENS_LIMIT`.
- **Prompt windows expose percentage only** — no raw prompt counts are available
  via the API key. Counts are MCP-only by design in the UI.
- **No billing/subscription endpoint** reachable with the API key
  (`/api/billing/subscription` returns app-level 404). Plan tier comes from
  `data.level`; renewal date is **not** available in Tier 1.
- **Icon** not yet created — extension currently uses Raycast defaults.
