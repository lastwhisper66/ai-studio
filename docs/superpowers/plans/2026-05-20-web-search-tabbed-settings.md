# Web Search Tabbed Settings & Global Default Provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Web Search settings section into a `ProviderSection`-style two-column layout (static tab list on the left + detail pane on the right), and decouple "the provider the chat actually uses at runtime" from "the tab I'm editing in settings" by introducing a new `webSearch.defaultProvider` setting key.

**Architecture:** One boot-time SQLite migration copies the legacy `webSearch.provider` value into the new `webSearch.defaultProvider` key. Main-process `loadWebSearchSettings()` and renderer `MessageInput.webSearchAvailable` both switch to read the new key (with fallback to the legacy key, then `'tavily'`). The 360-line monolithic `WebSearchSection.tsx` is split into a `web-search/` folder of small focused components. `SettingsPage.tsx` special-cases the section out of the generic `ScrollArea` branch because it now owns an internal scroll.

**Tech Stack:** Electron 39, React 19, Zustand 5, better-sqlite3, Tailwind v4, Shadcn/UI. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-20-web-search-tabbed-settings-design.md`

**Testing note:** The repo has no unit-test framework. "Verify" steps in this plan use `npm run typecheck`, `npm run lint`, and explicit manual UI checks via `npm run dev`. Each task ends with a commit so progress is bisectable.

---

## File Structure

**New files:**

- `src/main/migrate/003-web-search-default-provider.ts` — copies `webSearch.provider` → `webSearch.defaultProvider` on first boot
- `src/renderer/src/components/settings/web-search/WebSearchSection.tsx` — two-column shell, owns active-tab state
- `src/renderer/src/components/settings/web-search/WebSearchTabList.tsx` — left tab list, pure presentational
- `src/renderer/src/components/settings/web-search/WebSearchHeader.tsx` — top bar: default-provider select + set-default button
- `src/renderer/src/components/settings/web-search/WebSearchCommonParams.tsx` — maxResults / timeout / rewriteQuery
- `src/renderer/src/components/settings/web-search/useWebSearchTestConnection.ts` — shared test-connection hook
- `src/renderer/src/components/settings/web-search/providers/TavilyForm.tsx`
- `src/renderer/src/components/settings/web-search/providers/BraveForm.tsx`
- `src/renderer/src/components/settings/web-search/providers/SearxngForm.tsx`
- `src/renderer/src/components/settings/web-search/providers/ExaForm.tsx`

**Modified files:**

- `src/main/migrate/index.ts` — register migration 003
- `src/main/web-search/index.ts` — `loadWebSearchSettings()` reads `defaultProvider` with fallback
- `src/renderer/src/components/chat/MessageInput.tsx` — `webSearchAvailable` reads `defaultProvider` with fallback
- `src/renderer/src/components/settings/SettingsPage.tsx` — import path + special-case routing
- `src/renderer/src/i18n/locales/zh-CN.json` — add 7 new strings
- `src/renderer/src/i18n/locales/en.json` — add 7 new strings

**Deleted files:**

- `src/renderer/src/components/settings/WebSearchSection.tsx` — superseded by `web-search/WebSearchSection.tsx`

---

## Task 1: Migration 003 — backfill `webSearch.defaultProvider`

**Goal:** Add a boot-time migration that copies the legacy `webSearch.provider` value into the new `webSearch.defaultProvider` key so existing users transparently keep their previously-selected provider. The migration is registered but not yet read by any code path — that wiring happens in Task 2.

**Files:**

- Create: `src/main/migrate/003-web-search-default-provider.ts`
- Modify: `src/main/migrate/index.ts`

- [ ] **Step 1: Create migration file**

Path: `src/main/migrate/003-web-search-default-provider.ts`

```ts
import type Database from 'better-sqlite3'

/**
 * Decouple "the provider the chat uses at runtime" from "the tab currently
 * selected in the settings page". Introduce a new key
 * `webSearch.defaultProvider` for the former; `webSearch.provider` is
 * repurposed as a pure UI preference (which tab is open).
 *
 * For users that already had a provider chosen, copy that value into the new
 * key so search behaviour does not change after upgrade.
 */
export const migration003WebSearchDefaultProvider = {
  version: 3,
  name: 'web-search-default-provider',
  up(db: Database.Database): void {
    const get = (key: string): string | undefined =>
      (
        db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
          | { value: string }
          | undefined
      )?.value

    const set = (key: string, value: string): void => {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(key, value)
    }

    const existingDefault = get('webSearch.defaultProvider')
    if (existingDefault) return // already set, nothing to do

    const legacy = get('webSearch.provider')
    if (legacy) {
      set('webSearch.defaultProvider', legacy)
    }
  },
}
```

- [ ] **Step 2: Register migration in `src/main/migrate/index.ts`**

Modify `src/main/migrate/index.ts`. Find these two lines (around lines 12–13):

```ts
import { migration001MessagesSources } from './001-messages-sources'
import { migration002SplitUtilityModel } from './002-split-utility-model'
```

Add a third import line directly below them:

```ts
import { migration003WebSearchDefaultProvider } from './003-web-search-default-provider'
```

Find the `MIGRATIONS` array (around line 21):

```ts
const MIGRATIONS: Migration[] = [migration001MessagesSources, migration002SplitUtilityModel]
```

Replace it with:

```ts
const MIGRATIONS: Migration[] = [
  migration001MessagesSources,
  migration002SplitUtilityModel,
  migration003WebSearchDefaultProvider,
]
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Watch for "Cannot find module" on the new import — that means the file path is wrong.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Smoke-test the migration runs once**

Run: `npm run dev`. With dev tools open in the main window, run in the renderer console:

```js
await window.api.getSetting('webSearch.defaultProvider')
```

Expected: returns the same value as `webSearch.provider` for an existing install that had a provider chosen, or `null` for a fresh install (no auto-default). Then close the app and re-launch — the migration must NOT run again (check the terminal logs for `[migrate] applied 3-web-search-default-provider` — it should appear at most once across both launches).

- [ ] **Step 6: Commit**

```bash
git add src/main/migrate/003-web-search-default-provider.ts src/main/migrate/index.ts
git commit -m "feat(web-search): migration 003 backfill defaultProvider"
```

---

## Task 2: Main-process — `loadWebSearchSettings()` reads `defaultProvider`

**Goal:** Switch the chat-pipeline entry point to read the new key, with a fallback chain so search keeps working even if the migration somehow did not run.

**Files:**

- Modify: `src/main/web-search/index.ts:23-36`

- [ ] **Step 1: Update `loadWebSearchSettings()`**

Modify `src/main/web-search/index.ts`. Find the current function (lines 23–36):

```ts
export function loadWebSearchSettings(): WebSearchSettings {
  return {
    provider: (getSetting('webSearch.provider') as WebSearchProviderType) || 'tavily',
    tavilyApiKey: getSetting('webSearch.tavilyApiKey') ?? '',
    braveApiKey: getSetting('webSearch.braveApiKey') ?? '',
    exaApiKey: getSetting('webSearch.exaApiKey') ?? '',
    searxngUrl: getSetting('webSearch.searxngUrl') ?? '',
    searxngUsername: getSetting('webSearch.searxngUsername') ?? '',
    searxngApiKey: getSetting('webSearch.searxngApiKey') ?? '',
    maxResults: parseInt(getSetting('webSearch.maxResults') ?? '5', 10) || 5,
    rewriteQuery: (getSetting('webSearch.rewriteQuery') ?? 'true') === 'true',
    timeoutMs: parseInt(getSetting('webSearch.timeoutMs') ?? '15000', 10) || 15000,
  }
}
```

Replace it with:

```ts
export function loadWebSearchSettings(): WebSearchSettings {
  const runtimeProvider =
    (getSetting('webSearch.defaultProvider') as WebSearchProviderType) ||
    (getSetting('webSearch.provider') as WebSearchProviderType) ||
    'tavily'
  return {
    provider: runtimeProvider,
    tavilyApiKey: getSetting('webSearch.tavilyApiKey') ?? '',
    braveApiKey: getSetting('webSearch.braveApiKey') ?? '',
    exaApiKey: getSetting('webSearch.exaApiKey') ?? '',
    searxngUrl: getSetting('webSearch.searxngUrl') ?? '',
    searxngUsername: getSetting('webSearch.searxngUsername') ?? '',
    searxngApiKey: getSetting('webSearch.searxngApiKey') ?? '',
    maxResults: parseInt(getSetting('webSearch.maxResults') ?? '5', 10) || 5,
    rewriteQuery: (getSetting('webSearch.rewriteQuery') ?? 'true') === 'true',
    timeoutMs: parseInt(getSetting('webSearch.timeoutMs') ?? '15000', 10) || 15000,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/web-search/index.ts
git commit -m "feat(web-search): loadWebSearchSettings reads defaultProvider"
```

---

## Task 3: i18n — add new strings

**Goal:** Add the seven new translation keys used by the new settings UI to both locale files. Do this before building the UI so each component task can reference real keys.

**Files:**

- Modify: `src/renderer/src/i18n/locales/zh-CN.json:755-771`
- Modify: `src/renderer/src/i18n/locales/en.json:755-771`

- [ ] **Step 1: Edit zh-CN.json**

Modify `src/renderer/src/i18n/locales/zh-CN.json`. Find the `webSearch` object that starts at line 755:

```json
    "webSearch": {
      "title": "网络搜索",
      "description": "聊天时一键开启网络搜索,将搜索结果作为上下文交给模型,并在回复中显示引用来源。",
      "provider": "搜索服务商",
      "apiKey": "API Key",
      "searxngUrl": "SearXNG 实例 URL",
      "username": "用户名(可选)",
      "password": "密码(可选)",
      "test": "测试连接",
      "testing": "测试中...",
      "testOk": "连接成功,返回 {{count}} 条结果",
      "testFailed": "连接失败",
      "maxResults": "返回结果数 (1-20)",
      "timeoutSec": "超时秒数 (3-60)",
      "rewriteQuery": "启用查询改写",
      "rewriteQueryHint": "使用轻量模型把多轮对话上下文合并为单条搜索词,失败时自动用原文。"
    },
```

Replace it with (adds 7 keys at the end, keeps the existing ones):

```json
    "webSearch": {
      "title": "网络搜索",
      "description": "聊天时一键开启网络搜索,将搜索结果作为上下文交给模型,并在回复中显示引用来源。",
      "provider": "搜索服务商",
      "apiKey": "API Key",
      "searxngUrl": "SearXNG 实例 URL",
      "username": "用户名(可选)",
      "password": "密码(可选)",
      "test": "测试连接",
      "testing": "测试中...",
      "testOk": "连接成功,返回 {{count}} 条结果",
      "testFailed": "连接失败",
      "maxResults": "返回结果数 (1-20)",
      "timeoutSec": "超时秒数 (3-60)",
      "rewriteQuery": "启用查询改写",
      "rewriteQueryHint": "使用轻量模型把多轮对话上下文合并为单条搜索词,失败时自动用原文。",
      "defaultProvider": "默认供应商",
      "setAsDefault": "设为默认",
      "isCurrentDefault": "当前默认",
      "notConfiguredHint": "未配置 API Key,无法设为默认",
      "commonParams": "常规参数",
      "configured": "已配置",
      "notConfigured": "未配置"
    },
```

- [ ] **Step 2: Edit en.json**

Modify `src/renderer/src/i18n/locales/en.json`. Find the `webSearch` object that starts at line 755 and replace it with:

```json
    "webSearch": {
      "title": "Web Search",
      "description": "Toggle web search per chat. Search results are injected as context, and the assistant cites sources in its reply.",
      "provider": "Search provider",
      "apiKey": "API Key",
      "searxngUrl": "SearXNG instance URL",
      "username": "Username (optional)",
      "password": "Password (optional)",
      "test": "Test connection",
      "testing": "Testing...",
      "testOk": "Connected, {{count}} results returned",
      "testFailed": "Connection failed",
      "maxResults": "Results per search (1-20)",
      "timeoutSec": "Timeout seconds (3-60)",
      "rewriteQuery": "Rewrite query",
      "rewriteQueryHint": "Use a lightweight model to collapse multi-turn context into one search query. Falls back to the raw text if it fails.",
      "defaultProvider": "Default provider",
      "setAsDefault": "Set as default",
      "isCurrentDefault": "Current default",
      "notConfiguredHint": "Fill in the API key first",
      "commonParams": "Common parameters",
      "configured": "Configured",
      "notConfigured": "Not configured"
    },
```

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/renderer/src/i18n/locales/zh-CN.json','utf8')); JSON.parse(require('fs').readFileSync('src/renderer/src/i18n/locales/en.json','utf8')); console.log('OK')"`
Expected: prints `OK`. Any syntax error will throw with line/column info.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/en.json
git commit -m "feat(web-search): i18n strings for tabbed settings UI"
```

---

## Task 4: Shared test-connection hook

**Goal:** Extract the test-connection logic out of the current monolithic `WebSearchSection.tsx` into a hook each provider form can reuse. The hook owns the busy/ok/err state machine and constructs the right `WebSearchTestPayload` for the given provider type.

**Files:**

- Create: `src/renderer/src/components/settings/web-search/useWebSearchTestConnection.ts`

- [ ] **Step 1: Create the hook file**

Path: `src/renderer/src/components/settings/web-search/useWebSearchTestConnection.ts`

```ts
import { useState } from 'react'
import type { WebSearchProviderType, WebSearchTestPayload } from '@shared/types'

export type TestState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; count: number }
  | { kind: 'err'; message: string }

export interface TestCredentials {
  apiKey?: string
  searxngUrl?: string
  searxngAuthUser?: string
  searxngAuthPass?: string
}

export function useWebSearchTestConnection(provider: WebSearchProviderType): {
  state: TestState
  run: (creds: TestCredentials) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<TestState>({ kind: 'idle' })

  const run = async (creds: TestCredentials): Promise<void> => {
    setState({ kind: 'busy' })
    const payload: WebSearchTestPayload = {
      provider,
      apiKey: creds.apiKey,
      searxngUrl: creds.searxngUrl,
      searxngAuthUser: creds.searxngAuthUser,
      searxngAuthPass: creds.searxngAuthPass,
    }
    const result = await window.api.testWebSearchConnection(payload)
    if (result.success && result.data) {
      setState({ kind: 'ok', count: result.data.resultCount })
    } else {
      setState({
        kind: 'err',
        message: result.error?.message ?? result.error?.code ?? 'unknown',
      })
    }
  }

  const reset = (): void => setState({ kind: 'idle' })

  return { state, run, reset }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `WebSearchTestPayload` or `WebSearchProviderType` cannot be resolved, the `@shared/types` path alias is misconfigured — abort and check.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/web-search/useWebSearchTestConnection.ts
git commit -m "feat(web-search): extract useWebSearchTestConnection hook"
```

---

## Task 5: Provider forms (Tavily, Brave, Exa, SearXNG)

**Goal:** One file per provider, each handling its own credential input(s), test button, status display, and docs link. All four use the hook from Task 4. No shared state — they each read directly from `useSettingsStore` like the rest of the app.

**Files:**

- Create: `src/renderer/src/components/settings/web-search/providers/TavilyForm.tsx`
- Create: `src/renderer/src/components/settings/web-search/providers/BraveForm.tsx`
- Create: `src/renderer/src/components/settings/web-search/providers/ExaForm.tsx`
- Create: `src/renderer/src/components/settings/web-search/providers/SearxngForm.tsx`

- [ ] **Step 1: Create TavilyForm**

Path: `src/renderer/src/components/settings/web-search/providers/TavilyForm.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebSearchTestConnection } from '../useWebSearchTestConnection'

export function TavilyForm(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const apiKey = settings['webSearch.tavilyApiKey'] ?? ''
  const { state, run } = useWebSearchTestConnection('tavily')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('settings.webSearch.apiKey')}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => void saveSettings({ 'webSearch.tavilyApiKey': e.target.value })}
          placeholder="tvly-..."
        />
        <p className="text-xs text-muted-foreground">
          <a
            href="https://tavily.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline">
            tavily.com
          </a>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void run({ apiKey })}
          disabled={state.kind === 'busy' || apiKey.length === 0}>
          {state.kind === 'busy' ? t('settings.webSearch.testing') : t('settings.webSearch.test')}
        </Button>
        {state.kind === 'ok' && (
          <span className="text-sm text-green-600">
            {t('settings.webSearch.testOk', { count: state.count })}
          </span>
        )}
        {state.kind === 'err' && (
          <span className="text-sm text-destructive">
            {t('settings.webSearch.testFailed')}: {state.message}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create BraveForm**

Path: `src/renderer/src/components/settings/web-search/providers/BraveForm.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebSearchTestConnection } from '../useWebSearchTestConnection'

export function BraveForm(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const apiKey = settings['webSearch.braveApiKey'] ?? ''
  const { state, run } = useWebSearchTestConnection('brave')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('settings.webSearch.apiKey')}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => void saveSettings({ 'webSearch.braveApiKey': e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <a
            href="https://brave.com/search/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline">
            brave.com/search/api
          </a>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void run({ apiKey })}
          disabled={state.kind === 'busy' || apiKey.length === 0}>
          {state.kind === 'busy' ? t('settings.webSearch.testing') : t('settings.webSearch.test')}
        </Button>
        {state.kind === 'ok' && (
          <span className="text-sm text-green-600">
            {t('settings.webSearch.testOk', { count: state.count })}
          </span>
        )}
        {state.kind === 'err' && (
          <span className="text-sm text-destructive">
            {t('settings.webSearch.testFailed')}: {state.message}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ExaForm**

Path: `src/renderer/src/components/settings/web-search/providers/ExaForm.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebSearchTestConnection } from '../useWebSearchTestConnection'

export function ExaForm(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const apiKey = settings['webSearch.exaApiKey'] ?? ''
  const { state, run } = useWebSearchTestConnection('exa')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('settings.webSearch.apiKey')}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => void saveSettings({ 'webSearch.exaApiKey': e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <a
            href="https://exa.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline">
            exa.ai
          </a>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void run({ apiKey })}
          disabled={state.kind === 'busy' || apiKey.length === 0}>
          {state.kind === 'busy' ? t('settings.webSearch.testing') : t('settings.webSearch.test')}
        </Button>
        {state.kind === 'ok' && (
          <span className="text-sm text-green-600">
            {t('settings.webSearch.testOk', { count: state.count })}
          </span>
        )}
        {state.kind === 'err' && (
          <span className="text-sm text-destructive">
            {t('settings.webSearch.testFailed')}: {state.message}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create SearxngForm**

Path: `src/renderer/src/components/settings/web-search/providers/SearxngForm.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebSearchTestConnection } from '../useWebSearchTestConnection'

export function SearxngForm(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const url = settings['webSearch.searxngUrl'] ?? ''
  const user = settings['webSearch.searxngUsername'] ?? ''
  const pw = settings['webSearch.searxngApiKey'] ?? ''
  const { state, run } = useWebSearchTestConnection('searxng')

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('settings.webSearch.searxngUrl')}</Label>
        <Input
          value={url}
          onChange={(e) => void saveSettings({ 'webSearch.searxngUrl': e.target.value })}
          placeholder="https://searxng.example.com"
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.username')}</Label>
        <Input
          value={user}
          onChange={(e) => void saveSettings({ 'webSearch.searxngUsername': e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.password')}</Label>
        <Input
          type="password"
          value={pw}
          onChange={(e) => void saveSettings({ 'webSearch.searxngApiKey': e.target.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void run({ searxngUrl: url, searxngAuthUser: user, searxngAuthPass: pw })}
          disabled={state.kind === 'busy' || url.length === 0}>
          {state.kind === 'busy' ? t('settings.webSearch.testing') : t('settings.webSearch.test')}
        </Button>
        {state.kind === 'ok' && (
          <span className="text-sm text-green-600">
            {t('settings.webSearch.testOk', { count: state.count })}
          </span>
        )}
        {state.kind === 'err' && (
          <span className="text-sm text-destructive">
            {t('settings.webSearch.testFailed')}: {state.message}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. The forms aren't used yet, but the types must resolve.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/settings/web-search/providers/
git commit -m "feat(web-search): per-provider credential forms"
```

---

## Task 6: Common-params block

**Goal:** Lift maxResults / timeoutSec / rewriteQuery into a standalone component. All three keys keep their existing semantics and storage; only the rendering moves.

**Files:**

- Create: `src/renderer/src/components/settings/web-search/WebSearchCommonParams.tsx`

- [ ] **Step 1: Create the component**

Path: `src/renderer/src/components/settings/web-search/WebSearchCommonParams.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function WebSearchCommonParams(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const maxResults = parseInt(settings['webSearch.maxResults'] ?? '5', 10) || 5
  const timeoutSec = Math.round(
    (parseInt(settings['webSearch.timeoutMs'] ?? '15000', 10) || 15000) / 1000,
  )
  const rewriteQuery = (settings['webSearch.rewriteQuery'] ?? 'true') === 'true'

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{t('settings.webSearch.commonParams')}</h3>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.maxResults')}</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={maxResults}
          onChange={(e) => {
            const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5))
            void saveSettings({ 'webSearch.maxResults': String(v) })
          }}
          className="w-24"
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.timeoutSec')}</Label>
        <Input
          type="number"
          min={3}
          max={60}
          value={timeoutSec}
          onChange={(e) => {
            const v = Math.max(3, Math.min(60, parseInt(e.target.value, 10) || 15))
            void saveSettings({ 'webSearch.timeoutMs': String(v * 1000) })
          }}
          className="w-24"
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{t('settings.webSearch.rewriteQuery')}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('settings.webSearch.rewriteQueryHint')}
          </p>
        </div>
        <Switch
          checked={rewriteQuery}
          onCheckedChange={(v) =>
            void saveSettings({ 'webSearch.rewriteQuery': v ? 'true' : 'false' })
          }
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/web-search/WebSearchCommonParams.tsx
git commit -m "feat(web-search): WebSearchCommonParams component"
```

---

## Task 7: Tab list (left column)

**Goal:** Pure presentational component listing the four providers as static tabs. Knows nothing about the store — receives `active`, `defaultProvider`, `configuredMap`, and `onChange` as props.

**Files:**

- Create: `src/renderer/src/components/settings/web-search/WebSearchTabList.tsx`

- [ ] **Step 1: Create the component**

Path: `src/renderer/src/components/settings/web-search/WebSearchTabList.tsx`

```tsx
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import type { WebSearchProviderType } from '@shared/types'

interface TabDef {
  id: WebSearchProviderType
  label: string
}

const TABS: TabDef[] = [
  { id: 'tavily', label: 'Tavily' },
  { id: 'brave', label: 'Brave Search' },
  { id: 'searxng', label: 'SearXNG' },
  { id: 'exa', label: 'Exa' },
]

interface WebSearchTabListProps {
  active: WebSearchProviderType
  defaultProvider: WebSearchProviderType
  configuredMap: Record<WebSearchProviderType, boolean>
  onChange: (id: WebSearchProviderType) => void
}

export function WebSearchTabList({
  active,
  defaultProvider,
  configuredMap,
  onChange,
}: WebSearchTabListProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <nav className="flex w-48 shrink-0 flex-col border-r p-2">
      <div className="space-y-0.5">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          const isDefault = defaultProvider === tab.id
          const isConfigured = configuredMap[tab.id]
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}>
              <span
                aria-label={
                  isConfigured
                    ? t('settings.webSearch.configured')
                    : t('settings.webSearch.notConfigured')
                }
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isConfigured ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                )}
              />
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
              {isDefault && (
                <span
                  title={t('settings.webSearch.isCurrentDefault')}
                  className="bg-primary/10 text-primary inline-flex h-4 w-4 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/web-search/WebSearchTabList.tsx
git commit -m "feat(web-search): WebSearchTabList static tab nav"
```

---

## Task 8: Header block — default-provider selector + set-default button

**Goal:** Top bar of the detail pane. Reads/writes `webSearch.defaultProvider`. Knows the currently-active tab so its right-side button can show "Current default" when they match, or "Set as default" when they don't (with the button disabled if the active tab has no credentials).

**Files:**

- Create: `src/renderer/src/components/settings/web-search/WebSearchHeader.tsx`

- [ ] **Step 1: Create the component**

Path: `src/renderer/src/components/settings/web-search/WebSearchHeader.tsx`

```tsx
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { WebSearchProviderType } from '@shared/types'

const OPTIONS: { id: WebSearchProviderType; label: string }[] = [
  { id: 'tavily', label: 'Tavily' },
  { id: 'brave', label: 'Brave Search' },
  { id: 'searxng', label: 'SearXNG' },
  { id: 'exa', label: 'Exa' },
]

interface WebSearchHeaderProps {
  activeTab: WebSearchProviderType
  defaultProvider: WebSearchProviderType
  configuredMap: Record<WebSearchProviderType, boolean>
}

export function WebSearchHeader({
  activeTab,
  defaultProvider,
  configuredMap,
}: WebSearchHeaderProps): React.JSX.Element {
  const { t } = useTranslation()
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const setDefault = (id: WebSearchProviderType): void => {
    void saveSettings({ 'webSearch.defaultProvider': id })
  }

  const isActiveTabConfigured = configuredMap[activeTab]
  const activeTabIsDefault = activeTab === defaultProvider

  return (
    <div className="border-b px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label className="text-sm shrink-0">{t('settings.webSearch.defaultProvider')}</Label>
          <Select
            value={defaultProvider}
            onValueChange={(v) => setDefault(v as WebSearchProviderType)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        configuredMap[o.id]
                          ? 'h-1.5 w-1.5 rounded-full bg-emerald-500'
                          : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/40'
                      }
                    />
                    {o.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!configuredMap[defaultProvider] && (
            <span className="text-xs text-destructive">
              {t('settings.webSearch.notConfiguredHint')}
            </span>
          )}
        </div>
        {activeTabIsDefault ? (
          <span className="text-primary bg-primary/10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs">
            <Check className="h-3 w-3" />
            {t('settings.webSearch.isCurrentDefault')}
          </span>
        ) : isActiveTabConfigured ? (
          <Button variant="outline" size="sm" onClick={() => setDefault(activeTab)}>
            {t('settings.webSearch.setAsDefault')}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" size="sm" disabled>
                  {t('settings.webSearch.setAsDefault')}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('settings.webSearch.notConfiguredHint')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If the Tooltip / Select imports fail, check `src/renderer/src/components/ui/` — these primitives are already used by other settings pages, so the imports above mirror their established patterns.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/web-search/WebSearchHeader.tsx
git commit -m "feat(web-search): WebSearchHeader default-provider selector"
```

---

## Task 9: Shell component — `web-search/WebSearchSection.tsx`

**Goal:** Wire the four building blocks together. The shell owns the "which tab is active" state, persists it via `webSearch.provider` (repurposed as UI preference), derives the `configuredMap`, and routes to the right provider form.

**Files:**

- Create: `src/renderer/src/components/settings/web-search/WebSearchSection.tsx`

- [ ] **Step 1: Create the shell**

Path: `src/renderer/src/components/settings/web-search/WebSearchSection.tsx`

```tsx
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { WebSearchProviderType } from '@shared/types'
import { WebSearchTabList } from './WebSearchTabList'
import { WebSearchHeader } from './WebSearchHeader'
import { WebSearchCommonParams } from './WebSearchCommonParams'
import { TavilyForm } from './providers/TavilyForm'
import { BraveForm } from './providers/BraveForm'
import { ExaForm } from './providers/ExaForm'
import { SearxngForm } from './providers/SearxngForm'

const VALID_PROVIDERS: WebSearchProviderType[] = ['tavily', 'brave', 'searxng', 'exa']

function normalizeProvider(raw: string | undefined): WebSearchProviderType {
  if (raw && (VALID_PROVIDERS as string[]).includes(raw)) {
    return raw as WebSearchProviderType
  }
  return 'tavily'
}

export function WebSearchSection(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const activeTab = normalizeProvider(settings['webSearch.provider'])
  const defaultProvider = normalizeProvider(
    settings['webSearch.defaultProvider'] ?? settings['webSearch.provider'],
  )

  const configuredMap: Record<WebSearchProviderType, boolean> = {
    tavily: (settings['webSearch.tavilyApiKey'] ?? '').length > 0,
    brave: (settings['webSearch.braveApiKey'] ?? '').length > 0,
    searxng: (settings['webSearch.searxngUrl'] ?? '').length > 0,
    exa: (settings['webSearch.exaApiKey'] ?? '').length > 0,
  }

  const setActiveTab = (id: WebSearchProviderType): void => {
    void saveSettings({ 'webSearch.provider': id })
  }

  return (
    <div className="flex h-full flex-1 min-w-0">
      <WebSearchTabList
        active={activeTab}
        defaultProvider={defaultProvider}
        configuredMap={configuredMap}
        onChange={setActiveTab}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <WebSearchHeader
          activeTab={activeTab}
          defaultProvider={defaultProvider}
          configuredMap={configuredMap}
        />
        <ScrollArea className="flex-1">
          <div className="max-w-2xl space-y-6 p-6">
            <header>
              <h2 className="text-lg font-semibold">{t('settings.webSearch.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('settings.webSearch.description')}
              </p>
            </header>
            <WebSearchCommonParams />
            <div className="border-t pt-6">
              {activeTab === 'tavily' && <TavilyForm />}
              {activeTab === 'brave' && <BraveForm />}
              {activeTab === 'searxng' && <SearxngForm />}
              {activeTab === 'exa' && <ExaForm />}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/web-search/WebSearchSection.tsx
git commit -m "feat(web-search): two-column WebSearchSection shell"
```

---

## Task 10: Wire shell into `SettingsPage` and delete legacy file

**Goal:** Switch `SettingsPage.tsx` to import from the new path and special-case the section so it owns its own layout (no parent `ScrollArea`, no `p-6` wrapper). Delete the now-superseded old file.

**Files:**

- Modify: `src/renderer/src/components/settings/SettingsPage.tsx:18,46-67`
- Delete: `src/renderer/src/components/settings/WebSearchSection.tsx`

- [ ] **Step 1: Update import in `SettingsPage.tsx`**

Modify `src/renderer/src/components/settings/SettingsPage.tsx`. Find line 18:

```ts
import { WebSearchSection } from './WebSearchSection'
```

Replace it with:

```ts
import { WebSearchSection } from './web-search/WebSearchSection'
```

- [ ] **Step 2: Special-case routing**

In the same file, find the routing block (lines 46–67):

```tsx
{
  activeSection === 'provider' ? (
    <ProviderSection />
  ) : activeSection === 'model-management' ? (
    <ModelManagementSection />
  ) : activeSection === 'data' ? (
    <DataSection />
  ) : (
    <ScrollArea className="flex-1">
      <div className="p-6">
        {activeSection === 'general' && <GeneralSection />}
        {activeSection === 'utility-models' && <UtilityModelsSection />}
        {activeSection === 'network' && <NetworkSection />}
        {activeSection === 'display' && <DisplaySection />}
        {activeSection === 'phrases' && <PhrasesSection />}
        {activeSection === 'keyboard-shortcuts' && <KeyboardShortcutsSection />}
        {activeSection === 'quick-assistant' && <QuickAssistantSection />}
        {activeSection === 'selection-assistant' && <SelectionAssistantSection />}
        {activeSection === 'web-search' && <WebSearchSection />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </ScrollArea>
  )
}
```

Replace it with:

```tsx
{
  activeSection === 'provider' ? (
    <ProviderSection />
  ) : activeSection === 'model-management' ? (
    <ModelManagementSection />
  ) : activeSection === 'data' ? (
    <DataSection />
  ) : activeSection === 'web-search' ? (
    <WebSearchSection />
  ) : (
    <ScrollArea className="flex-1">
      <div className="p-6">
        {activeSection === 'general' && <GeneralSection />}
        {activeSection === 'utility-models' && <UtilityModelsSection />}
        {activeSection === 'network' && <NetworkSection />}
        {activeSection === 'display' && <DisplaySection />}
        {activeSection === 'phrases' && <PhrasesSection />}
        {activeSection === 'keyboard-shortcuts' && <KeyboardShortcutsSection />}
        {activeSection === 'quick-assistant' && <QuickAssistantSection />}
        {activeSection === 'selection-assistant' && <SelectionAssistantSection />}
        {activeSection === 'about' && <AboutSection />}
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 3: Delete the old monolithic file**

```bash
git rm src/renderer/src/components/settings/WebSearchSection.tsx
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If anything else imported from the old path, the error will list it — those imports must also be updated.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors. Watch for unused imports in `SettingsPage.tsx` — if any were left over from the old structure, remove them.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/settings/SettingsPage.tsx
git commit -m "feat(web-search): wire new section, drop monolithic file"
```

---

## Task 11: Renderer wiring — `MessageInput.webSearchAvailable`

**Goal:** The Globe button's "is web search available" check must follow the runtime default, not the settings-page tab. Apply the same fallback chain as the main process.

**Files:**

- Modify: `src/renderer/src/components/chat/MessageInput.tsx:266-280`

- [ ] **Step 1: Edit `webSearchAvailable`**

Modify `src/renderer/src/components/chat/MessageInput.tsx`. Find the existing memo (lines 266–280):

```tsx
const webSearchAvailable = useMemo(() => {
  const provider = settings['webSearch.provider'] ?? 'tavily'
  switch (provider) {
    case 'tavily':
      return (settings['webSearch.tavilyApiKey'] ?? '').length > 0
    case 'brave':
      return (settings['webSearch.braveApiKey'] ?? '').length > 0
    case 'exa':
      return (settings['webSearch.exaApiKey'] ?? '').length > 0
    case 'searxng':
      return (settings['webSearch.searxngUrl'] ?? '').length > 0
    default:
      return false
  }
}, [settings])
```

Replace it with:

```tsx
const webSearchAvailable = useMemo(() => {
  const provider =
    settings['webSearch.defaultProvider'] ?? settings['webSearch.provider'] ?? 'tavily'
  switch (provider) {
    case 'tavily':
      return (settings['webSearch.tavilyApiKey'] ?? '').length > 0
    case 'brave':
      return (settings['webSearch.braveApiKey'] ?? '').length > 0
    case 'exa':
      return (settings['webSearch.exaApiKey'] ?? '').length > 0
    case 'searxng':
      return (settings['webSearch.searxngUrl'] ?? '').length > 0
    default:
      return false
  }
}, [settings])
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/chat/MessageInput.tsx
git commit -m "feat(web-search): MessageInput uses defaultProvider"
```

---

## Task 12: Manual end-to-end verification

**Goal:** Smoke-test all the behaviours that the spec calls out and that automated checks cannot cover.

**Files:** none modified.

- [ ] **Step 1: Build verification**

Run: `npm run build`
Expected: succeeds. (`build` runs `typecheck` first.)

- [ ] **Step 2: Launch dev**

Run: `npm run dev`
Expected: app starts; on first launch you should see in the terminal: `[migrate] applied 3-web-search-default-provider` (once). On subsequent launches that line must NOT appear.

- [ ] **Step 3: Existing-user migration check**

Pre-condition: you have an install where `webSearch.provider` was previously set (e.g. `'brave'`). After the migration runs, open dev tools in the main window and run:

```js
const a = await window.api.getSetting('webSearch.defaultProvider')
const b = await window.api.getSetting('webSearch.provider')
console.log({ defaultProvider: a, provider: b })
```

Expected: `defaultProvider` and `provider` hold the same value (`'brave'` in the example).

- [ ] **Step 4: Tab switching does not change runtime provider**

In the settings page, open Web Search. Click each tab in turn (Tavily / Brave / SearXNG / Exa). Watch the header pill — "Current default" should stay on whatever you had before (it appears on whichever tab equals the default). Run the dev-tools check from Step 3 after each click; `defaultProvider` must NOT change.

- [ ] **Step 5: "Set as default" updates instantly**

With a tab that has credentials and is NOT currently the default, click "Set as default". Expected:

- The right-side pill changes to "Current default" on this tab.
- The header `<Select>` value changes to match.
- The tab list updates the small `Check` chip to mark this tab as default.
- `await window.api.getSetting('webSearch.defaultProvider')` returns the new value.

- [ ] **Step 6: Unconfigured-tab "Set as default" is disabled**

Switch to a tab whose credentials are empty. The "Set as default" button must be disabled, and hovering it must show the `notConfiguredHint` tooltip. Also: in the header `<Select>`, if you pick an unconfigured provider, the red `notConfiguredHint` text appears next to the select.

- [ ] **Step 7: Globe icon follows the default, not the tab**

Open a chat. With the default set to a configured provider (e.g. Tavily), the Globe icon is enabled. Switch the settings tab to a different (unconfigured) provider — Globe must stay enabled, because availability tracks `defaultProvider`, not `provider`. Now use the header to change the default to an unconfigured provider — Globe must become disabled; clicking it should navigate to Settings → Web Search instead of toggling.

- [ ] **Step 8: Test connection works on any tab**

On any provider tab with credentials, click "Test connection". The result/error text must appear inline. The runtime default is NOT touched by this action (re-run the Step 3 check).

- [ ] **Step 9: Common params persist across tabs**

On the Tavily tab, change "Results per search" to 7. Switch to Brave. The Common parameters block still shows 7 (the params live above the per-provider form). Run `await window.api.getSetting('webSearch.maxResults')` — returns `'7'`.

- [ ] **Step 10: Fresh-install behaviour**

(Optional, only if you can wipe the dev DB.) Delete `data/ai-studio.db*` and re-launch. The migration block should be skipped (`isNewDatabase=true` path). `webSearch.defaultProvider` is `null` initially; `WebSearchSection` falls back to `'tavily'` via `normalizeProvider`. Clicking "Set as default" on any configured tab persists the value.

- [ ] **Step 11: No regressions in neighbouring sections**

Visit Provider, Model Management, Utility Models, Data, General — all should look and behave exactly as before. The change to `SettingsPage.tsx` only added a new branch; the existing branches were not edited.

- [ ] **Step 12: Format the repo**

Run: `npm run format`
Expected: prettier rewrites whitespace only. Inspect `git diff` — there should be no semantic changes.

- [ ] **Step 13: Final commit (if format produced any diff)**

```bash
git add -A
git commit -m "chore: format" # only if there is a diff; otherwise skip
```

---

## Summary

After completing all 12 tasks, the Web Search section will be a two-column layout matching the Provider section's visual pattern, with provider credentials cleanly split into per-provider files and the runtime provider decoupled from the editing-context tab. Existing users are migrated transparently; the chat-pipeline behaviour is unchanged when `defaultProvider` matches what `provider` used to be.
