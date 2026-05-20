# Web Search Settings — Tabbed Layout & Global Default Provider

**Date:** 2026-05-20
**Scope:** Renderer settings page (Web Search section) + one SQLite migration + a small renderer wiring change in `MessageInput`. No changes to the main-process search pipeline beyond which settings key it reads.

## Problem

Today `WebSearchSection.tsx` shows a single provider at a time via a `<Select>`. Switching the dropdown both (a) changes which credential form is visible **and** (b) changes which provider the chat pipeline actually uses. This conflates "what am I editing right now" with "what should the app use at runtime", and there is nowhere obvious to pick the runtime provider when several are configured.

We want:

1. The provider forms shown as **tabs** in a left column inside the Web Search section, mirroring the visual pattern of `ProviderSection` (list-on-left + detail-on-right).
2. A single, app-wide **default provider** chosen from the populated providers, with the selector living **at the top of the detail pane** in the Web Search section. No per-conversation or per-assistant selection.

## Non-Goals

- No per-conversation / per-assistant provider selection. The Globe button in `MessageInput` stays a simple on/off toggle for the current conversation.
- No quick-switch popover in the chat input.
- No dynamic provider list with enable/disable + drag-reorder — the four providers (Tavily, Brave, SearXNG, Exa) stay hard-coded.
- No per-provider override of `maxResults` / `timeout` / `rewriteQuery`. Those stay global.

## Design

### Settings Key Model

| Key                          | Semantics                                                                                                   | Read by                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `webSearch.defaultProvider`  | **NEW.** The provider used at runtime. Value is one of: `tavily`, `brave`, `searxng`, `exa`.                | `loadWebSearchSettings()`, `MessageInput` |
| `webSearch.provider`         | Repurposed. The tab currently selected in the settings page. Pure UI preference, no runtime effect anymore. | `WebSearchSection` only                   |
| `webSearch.enabled`          | Unchanged. Global feature gate.                                                                             | (existing)                                |
| `webSearch.tavilyApiKey` etc | Unchanged.                                                                                                  | (existing)                                |
| `webSearch.maxResults`       | Unchanged. Global.                                                                                          | (existing)                                |
| `webSearch.timeoutMs`        | Unchanged. Global.                                                                                          | (existing)                                |
| `webSearch.rewriteQuery`     | Unchanged. Global.                                                                                          | (existing)                                |

This split is the load-bearing decision: it lets the settings page change tabs freely without affecting what chat actually uses, and it lets future features (e.g. a quick-switch popover) be added without re-untangling the keys.

### Migration (`003-rename-web-search-provider.ts`)

One idempotent boot-time migration:

```ts
// pseudocode — runs once on app start
const defaultProvider = db.get("SELECT value FROM settings WHERE key='webSearch.defaultProvider'")
if (!defaultProvider) {
  const oldProvider = db.get("SELECT value FROM settings WHERE key='webSearch.provider'")
  if (oldProvider) {
    db.run(
      "INSERT INTO settings(key, value) VALUES('webSearch.defaultProvider', ?)",
      oldProvider.value,
    )
  }
}
```

Goal: existing users transparently keep their previously-selected provider as the new "default provider". The `webSearch.provider` row is left untouched and is reinterpreted as "settings tab selection".

Follow the convention in `CLAUDE.md` for migrations:

- New file `src/main/migrate/003-rename-web-search-provider.ts` exporting `{ version: 3, name: 'rename-web-search-provider', up(db) {...} }`.
- Push it to `MIGRATIONS` in `src/main/migrate/index.ts` (append at the end).
- Do not put idempotency / transaction code in `up()` — the framework guarantees both.

### Main-process change

In `src/main/web-search/index.ts`:

```diff
 export function loadWebSearchSettings(): WebSearchSettings {
   return {
-    provider: (getSetting('webSearch.provider') as WebSearchProviderType) || 'tavily',
+    provider:
+      (getSetting('webSearch.defaultProvider') as WebSearchProviderType) ||
+      (getSetting('webSearch.provider') as WebSearchProviderType) ||
+      'tavily',
     ...
   }
 }
```

The fallback chain (`defaultProvider` → legacy `provider` → `'tavily'`) is belt-and-suspenders: if the migration somehow didn't run, the old key is still honored, so search never silently breaks.

### Settings page layout

`WebSearchSection` becomes a two-column layout inside the existing scrollable settings pane.

**SettingsPage.tsx routing decision:** the Web Search section now owns its own internal layout (like `ProviderSection`, `ModelManagementSection`, `DataSection`), so it should move out of the generic `ScrollArea` branch into its own conditional. Concretely:

```diff
-{activeSection === 'data' ? (
-  <DataSection />
-) : (
+{activeSection === 'data' ? (
+  <DataSection />
+) : activeSection === 'web-search' ? (
+  <WebSearchSection />
+) : (
   <ScrollArea className="flex-1">
     <div className="p-6">
       ...
-      {activeSection === 'web-search' && <WebSearchSection />}
       ...
     </div>
   </ScrollArea>
 )}
```

`WebSearchSection` itself manages its own scroll for the detail pane.

#### Detail pane structure

```
┌─ WebSearchTabList ──┐  ┌─ Detail pane (ScrollArea) ───────────────────┐
│ ● Tavily            │  │ Header block                                  │
│ ○ Brave Search      │  │  ┌─────────────────────────────────────────┐ │
│ ○ SearXNG           │  │  │ Default provider: [Tavily ▼]  [Set default]│ │
│ ○ Exa               │  │  │ (or "Current default" pill if same)        │ │
└─────────────────────┘  │  └─────────────────────────────────────────┘ │
                          │ Common parameters block                       │
                          │  ┌─────────────────────────────────────────┐ │
                          │  │ Max results [_5_]                        │ │
                          │  │ Timeout (s) [_15_]                       │ │
                          │  │ Rewrite query [ Switch ]                 │ │
                          │  └─────────────────────────────────────────┘ │
                          │ <Separator>                                   │
                          │ Provider-specific form (per active tab)       │
                          │  ┌─────────────────────────────────────────┐ │
                          │  │ Tavily                                   │ │
                          │  │ API Key [••••••••••]                     │ │
                          │  │ [Test connection]                        │ │
                          │  │ tavily.com →                             │ │
                          │  └─────────────────────────────────────────┘ │
                          └────────────────────────────────────────────────┘
```

**Left tab list (`WebSearchTabList`)** — 4 static items, no enable/disable, no drag. Width ~12rem (`w-48`) to match the cramped feel of `ProviderList` without competing with it (it's a smaller domain). Each row shows:

- Provider name
- A subtle dot indicating credential status: filled = configured, hollow = not configured (`bg-emerald-500` / `bg-muted-foreground/40`)
- The default provider gets a small star/badge to the right (lucide `Check` inside a `bg-primary/10` chip, like the active-tab indicator pattern used elsewhere)

Selected tab uses `bg-accent text-accent-foreground` (same as `ProviderList`'s selected row).

**Header block (`WebSearchHeader`)** — one row, height ~44px, padded `px-6 py-3`, with `border-b` to separate it from the parameters block. Contents:

- Label `Default provider:`
- `<Select>` listing **all four providers**. Unconfigured providers are still selectable but show a warning text below the select if chosen (`"未配置 — 先填写 API Key"`). We do NOT silently disable them, because the user might be about to fill in the key.
- Right-aligned: a button.
  - If `defaultProvider === activeTab`: render a disabled badge "当前默认" / "Current default" (lucide `Check` icon).
  - Else: render `<Button variant="outline" size="sm">设为默认</Button>` — clicking sets `defaultProvider` to the active tab. Disabled with tooltip if active tab's credentials are empty.

**Common parameters block (`WebSearchCommonParams`)** — straight lift of the existing maxResults / timeoutSec / rewriteQuery fields, no behavior change.

**Provider form** — one of four small components (`TavilyForm`, `BraveForm`, `SearxngForm`, `ExaForm`). Each owns its API Key / URL inputs, its "Test connection" button, and its docs link. The test-connection logic is identical across forms, so it's extracted to `useWebSearchTestConnection(provider)` hook.

#### Folder layout

```
src/renderer/src/components/settings/web-search/
├── WebSearchSection.tsx           # Shell: tab list + detail pane
├── WebSearchTabList.tsx           # Static left-side tab list
├── WebSearchHeader.tsx            # Default-provider selector + set-default button
├── WebSearchCommonParams.tsx      # maxResults / timeout / rewriteQuery
├── useWebSearchTestConnection.ts  # Shared hook used by every provider form
└── providers/
    ├── TavilyForm.tsx
    ├── BraveForm.tsx
    ├── SearxngForm.tsx
    └── ExaForm.tsx
```

Delete the old `src/renderer/src/components/settings/WebSearchSection.tsx`. Update the import in `SettingsPage.tsx`:

```diff
-import { WebSearchSection } from './WebSearchSection'
+import { WebSearchSection } from './web-search/WebSearchSection'
```

### Renderer wiring — `MessageInput.tsx`

```diff
 const webSearchAvailable = useMemo(() => {
-  const provider = settings['webSearch.provider'] ?? 'tavily'
+  const provider = settings['webSearch.defaultProvider'] ?? settings['webSearch.provider'] ?? 'tavily'
   switch (provider) {
     ...
   }
 }, [settings])
```

Same fallback chain as the main process. After the migration runs once, the legacy fallback is unreachable in practice but cheap.

The Globe button's click handler doesn't change — clicking still navigates to `settings → web-search` when nothing is configured.

### i18n additions

`src/renderer/src/i18n/locales/zh-CN.json` and `en.json`:

| Key                                    | zh-CN                         | en                          |
| -------------------------------------- | ----------------------------- | --------------------------- |
| `settings.webSearch.defaultProvider`   | `默认供应商`                  | `Default provider`          |
| `settings.webSearch.setAsDefault`      | `设为默认`                    | `Set as default`            |
| `settings.webSearch.isCurrentDefault`  | `当前默认`                    | `Current default`           |
| `settings.webSearch.notConfiguredHint` | `未配置 API Key,无法设为默认` | `Fill in the API key first` |
| `settings.webSearch.commonParams`      | `常规参数`                    | `Common parameters`         |
| `settings.webSearch.configured`        | `已配置`                      | `Configured`                |
| `settings.webSearch.notConfigured`     | `未配置`                      | `Not configured`            |

The existing `settings.webSearch.provider` label is reused as the tab-list section title or removed if no longer needed.

## Component Responsibilities (one-liners)

- **`WebSearchSection`**: own the active-tab state (read/write `webSearch.provider`), render `WebSearchTabList` + scrollable detail pane.
- **`WebSearchTabList`**: pure presentational; props = `{ active, onChange, configuredMap }`. No store access.
- **`WebSearchHeader`**: read/write `webSearch.defaultProvider`; knows the active tab to show the right button state.
- **`WebSearchCommonParams`**: read/write `webSearch.maxResults` / `webSearch.timeoutMs` / `webSearch.rewriteQuery`. No knowledge of providers.
- **`providers/<Name>Form`**: read/write its own credential keys, render its test button via `useWebSearchTestConnection`.
- **`useWebSearchTestConnection(provider)`**: returns `{ state, run() }`, encapsulates the `WebSearchTestPayload` construction and the `window.api.testWebSearchConnection` call.

This makes each file small and individually testable. The "configured" status used by the tab list and the header is computed once in `WebSearchSection` from `settings` and passed down, so the badge/dot/warning text stay in sync.

## Build sequence

1. Migration `003-rename-web-search-provider.ts` + register in `migrate/index.ts`.
2. Update `loadWebSearchSettings()` to read `defaultProvider` with fallback.
3. Add i18n strings.
4. Create the new `web-search/` folder with the six components.
5. Switch `SettingsPage.tsx` to import the new shell and special-case it like `data`.
6. Delete the old `settings/WebSearchSection.tsx`.
7. Update `MessageInput.tsx`'s `webSearchAvailable` to use `defaultProvider` with fallback.
8. `npm run typecheck` and `npm run lint` clean; smoke-test in dev:
   - Existing config still works (migration path).
   - Switching tab does not switch runtime provider.
   - "Set as default" updates the header pill and the Globe state immediately.
   - Globe → click → opens Web Search section when nothing configured.

## Risks / Open Questions

- **Tab persistence on app restart**: `webSearch.provider` now persists "the tab I was on last". That's arguably nice (returns you to where you were) but if it ever drifts to a value not in the four-provider list, the tab list should default to `'tavily'`. `WebSearchSection` guards on read.
- **Test-connection while editing a non-default tab**: works fine — it uses the payload's credentials, not the runtime default. Behavior unchanged.
- **Visual weight of the new pane**: the section will look heavier than its neighbors. Acceptable because it's now structurally a peer of Provider / Model Management / Data — those are the "complex" sections, and Web Search has earned the same treatment.
