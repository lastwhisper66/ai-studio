# Multi-Provider Management Feature

## Context

Currently the app supports only a single provider configuration stored as flat `api.*` keys in the `settings` table. The user wants Cherry Studio-style multi-provider management: a provider list on the left with individual configuration on the right, supporting predefined service providers (OpenAI, Azure, DeepSeek, Gemini, Groq, Ollama, etc.).

## Architecture Overview

- New `providers` table in SQLite for storing multiple provider configs
- Predefined provider templates with default URLs and models (all OpenAI-compatible via `openai` npm package)
- Cherry Studio-style UI: vertical provider list + detail form in the Provider settings section
- One provider is "active" (used for chat), tracked via settings key `active.providerId`
- **No migration**: Old `api.*` provider settings are fully removed; users reconfigure from scratch

## Predefined Provider Templates

| Type         | Name              | Default Base URL                                        | Default Models                              |
| ------------ | ----------------- | ------------------------------------------------------- | ------------------------------------------- |
| `openai`     | OpenAI            | https://api.openai.com/v1                               | gpt-4o, gpt-4o-mini, o1, o3-mini            |
| `azure`      | Azure OpenAI      | _(endpoint)_                                            | gpt-4o, gpt-4o-mini                         |
| `deepseek`   | DeepSeek          | https://api.deepseek.com                                | deepseek-chat, deepseek-reasoner            |
| `gemini`     | Google Gemini     | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.0-flash, gemini-2.5-pro            |
| `groq`       | Groq              | https://api.groq.com/openai/v1                          | llama-3.3-70b-versatile, mixtral-8x7b-32768 |
| `ollama`     | Ollama            | http://localhost:11434/v1                               | llama3, qwen2.5                             |
| `silicon`    | Silicon Flow      | https://api.siliconflow.cn/v1                           | Qwen/Qwen2.5-72B-Instruct                   |
| `openrouter` | OpenRouter        | https://openrouter.ai/api/v1                            | openai/gpt-4o                               |
| `custom`     | OpenAI Compatible | _(user sets)_                                           | _(user sets)_                               |

All use the standard `openai` npm package. Azure is the only special case using `AzureOpenAI`.

---

## Implementation Steps

### Step 1: Shared Types (`src/shared/types.ts`)

Replace old `ApiProvider` with new types:

```typescript
export type ProviderType =
  | 'openai'
  | 'azure'
  | 'deepseek'
  | 'gemini'
  | 'groq'
  | 'ollama'
  | 'silicon'
  | 'openrouter'
  | 'custom'

export interface Provider {
  id: string
  type: ProviderType
  name: string
  apiKey: string
  baseUrl: string
  model: string
  // Azure-specific
  endpoint: string
  apiVersion: string
  deploymentName: string
  // State
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

Changes:

- **Remove** `ApiProvider` type entirely
- **Add** `ProviderType` and `Provider`
- **Add** `model` field to `Provider` (each provider stores its own model)
- **Update** `ApiSettings`: replace `provider: ApiProvider` → `provider: ProviderType`, remove provider-specific fields (apiKey, baseUrl, endpoint, etc.) — these now come from the active `Provider` record
- **Remove** `TestConnectionPayload` — connection testing will accept a `Provider` directly

Updated `ApiSettings` (simplified — only global model params remain):

```typescript
export interface ApiSettings {
  provider: ProviderType
  apiKey: string
  baseUrl: string
  model: string
  // Azure-specific
  endpoint: string
  apiVersion: string
  deploymentName: string
  // Global model params (still from settings table)
  temperature: number
  maxTokens: number
  systemPrompt: string
}
```

### Step 2: IPC Channels (`src/shared/ipc-channels.ts`)

Add provider CRUD channels:

```
PROVIDER_LIST, PROVIDER_GET, PROVIDER_CREATE, PROVIDER_UPDATE, PROVIDER_DELETE
```

Remove `SETTINGS_TEST_CONNECTION` — replace with `PROVIDER_TEST_CONNECTION` that accepts a `Provider`.

### Step 3: Database (`src/main/db/`)

**`database.ts`** — Add `providers` table in `createTables()`:

```sql
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  api_version TEXT NOT NULL DEFAULT '',
  deployment_name TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Note: `model` column added compared to original plan.

**`providers.ts`** (new) — CRUD operations:

- `listProviders(): Provider[]`
- `getProvider(id: string): Provider | undefined`
- `createProvider(data): Provider`
- `updateProvider(id, data): Provider | undefined`
- `deleteProvider(id): void`

API keys encrypted using existing `safeStorage` logic from `settings.ts`.

**`index.ts`** — Export new providers module.

### Step 4: IPC Handlers (`src/main/ipc/provider-handlers.ts`)

New file `provider-handlers.ts` with handlers for:

- 5 CRUD channels (list, get, create, update, delete)
- `PROVIDER_TEST_CONNECTION` — accepts Provider data, builds client, tests with minimal streaming request

Register in `src/main/ipc/index.ts`.

### Step 5: Preload Bridge (`src/preload/index.ts`)

Add provider API methods:

- `listProviders`, `getProvider`, `createProvider`, `updateProvider`, `deleteProvider`
- `testProviderConnection(provider: Provider)` — replaces old `testConnection`

Remove old `testConnection` method.

Update `index.d.ts` types.

### Step 6: Provider Templates (`src/renderer/src/components/settings/provider-templates.ts`)

New file defining predefined provider templates with:

- type, name, color (brand color hex), default baseUrl, default models
- A helper `getTemplateByType(type)` function

### Step 7: Provider Store (`src/renderer/src/stores/providerStore.ts`)

New Zustand store:

- State: `providers: Provider[]`, `activeProviderId: string | null`, `isLoaded: boolean`
- Actions: `loadProviders`, `addProvider`, `updateProvider`, `deleteProvider`, `setActiveProvider`
- Active provider ID stored/loaded from settings (`active.providerId`)

### Step 8: Settings UI Overhaul

**`ProviderSection.tsx`** — Replace current single-form layout with two-column layout:

- Left: `ProviderList` component (scrollable list of added providers + "Add" button)
- Right: `ProviderDetail` component (config form for selected provider)

**New components:**

1. **`ProviderList.tsx`** — Vertical list of user's providers
   - Each item: colored circle/icon + provider name + active indicator
   - Click to select, right-click context menu (delete, set as default)
   - Bottom: "+" button opens an add-provider dropdown/dialog

2. **`ProviderDetail.tsx`** — Config form for the selected provider
   - Name field (editable)
   - API Key (with show/hide toggle — reuse existing pattern)
   - Base URL (pre-filled from template, editable)
   - Azure-specific fields (conditional: endpoint, apiVersion, deploymentName)
   - Model field (text input for now)
   - Enabled toggle
   - Test Connection button (uses new `testProviderConnection`)
   - Save / Delete buttons

3. **`AddProviderDialog.tsx`** — Dialog/dropdown listing available predefined templates
   - Shows template icon + name
   - Clicking creates a new provider from that template

**Keep as-is:**

- `ModelSection.tsx` — temperature, maxTokens, systemPrompt remain global settings
- `GeneralSection.tsx`, `DisplaySection.tsx` — unchanged

### Step 9: AI Client Integration (`src/main/ai/index.ts`)

Rewrite `loadApiSettings()`:

1. Read `active.providerId` from settings
2. Load that provider from `providers` table
3. Build `ApiSettings` from provider fields (type, apiKey, baseUrl, model, endpoint, apiVersion, deploymentName) + global settings (temperature, maxTokens, systemPrompt)
4. If no active provider exists, throw a descriptive error

Update `createAIClient()`: map `ProviderType` → client creation:

- `azure` → `AzureOpenAI`
- Everything else → `OpenAI` with `baseURL` from provider

### Step 10: Cleanup Old Provider Code

Remove all old single-provider logic that is no longer used:

**Delete files:**

- `src/renderer/src/components/settings/ProviderSettings.tsx` — replaced by `ProviderDetail.tsx`

**Clean up `src/renderer/src/components/settings/types.ts`:**

- Remove provider-related fields from `SettingsFormState` (provider, apiKey, baseUrl, endpoint, apiVersion, deploymentName, model)
- Keep only global model params: temperature, maxTokens, systemPrompt

**Clean up `src/renderer/src/components/settings/formUtils.ts`:**

- Remove `providerKeys()` function (no longer needed)
- Update `DEFAULT_FORM` to only have global model params
- Update `formStateFromSettings()` to only map global model settings

**Clean up `src/main/ipc/settings-handlers.ts`:**

- Remove `SETTINGS_TEST_CONNECTION` handler (replaced by `PROVIDER_TEST_CONNECTION` in provider-handlers)

**Clean up `src/renderer/src/components/settings/ConnectionTest.tsx`:**

- Update to accept a `Provider` prop instead of reading from form state
- Call `testProviderConnection(provider)` instead of old `testConnection(payload)`

**Clean up `src/renderer/src/components/chat/InputToolbar.tsx`:**

- Replace old `api.provider` / `api.baseUrl` settings reads with provider store
- Model switching now updates the active provider's model via provider store

**Clean up `src/renderer/src/components/settings/SettingsPage.tsx`:**

- Remove provider-related `formState` management
- Provider section now managed entirely by provider store, not settings form state

**Remove old settings keys usage:**

- No more reads/writes of: `api.provider`, `api.apiKey`, `api.baseUrl`, `api.endpoint`, `api.apiVersion`, `api.deploymentName`, `api.model`
- Keep: `api.temperature`, `api.maxTokens`, `api.systemPrompt`, `active.providerId`

---

## Files to Create

| File                                                         | Description                             |
| ------------------------------------------------------------ | --------------------------------------- |
| `src/main/db/providers.ts`                                   | Provider CRUD DB operations             |
| `src/main/ipc/provider-handlers.ts`                          | Provider IPC handlers + connection test |
| `src/renderer/src/stores/providerStore.ts`                   | Provider Zustand store                  |
| `src/renderer/src/components/settings/provider-templates.ts` | Predefined provider templates           |
| `src/renderer/src/components/settings/ProviderList.tsx`      | Provider list sidebar component         |
| `src/renderer/src/components/settings/ProviderDetail.tsx`    | Provider config form component          |
| `src/renderer/src/components/settings/AddProviderDialog.tsx` | Add provider dialog                     |

## Files to Modify

| File                                                       | Changes                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/shared/types.ts`                                      | Remove `ApiProvider`, `TestConnectionPayload`; add `ProviderType`, `Provider`; update `ApiSettings` |
| `src/shared/ipc-channels.ts`                               | Add `PROVIDER_*` channels; remove `SETTINGS_TEST_CONNECTION`                                        |
| `src/main/db/database.ts`                                  | Add `providers` table in `createTables()`                                                           |
| `src/main/db/index.ts`                                     | Export providers module                                                                             |
| `src/main/ipc/index.ts`                                    | Register provider handlers                                                                          |
| `src/main/ipc/settings-handlers.ts`                        | Remove `SETTINGS_TEST_CONNECTION` handler                                                           |
| `src/main/ai/index.ts`                                     | Rewrite `loadApiSettings()` to use active provider from `providers` table                           |
| `src/preload/index.ts`                                     | Add provider API methods; remove old `testConnection`                                               |
| `src/preload/index.d.ts`                                   | Update `window.api` types                                                                           |
| `src/renderer/src/components/settings/ProviderSection.tsx` | Refactor to two-column layout using provider store                                                  |
| `src/renderer/src/components/settings/types.ts`            | Remove provider fields from `SettingsFormState`                                                     |
| `src/renderer/src/components/settings/formUtils.ts`        | Remove `providerKeys()`; simplify `DEFAULT_FORM` and `formStateFromSettings()`                      |
| `src/renderer/src/components/settings/ConnectionTest.tsx`  | Accept `Provider` prop; use `testProviderConnection`                                                |
| `src/renderer/src/components/settings/index.ts`            | Update exports                                                                                      |
| `src/renderer/src/components/settings/SettingsPage.tsx`    | Remove provider form state; init provider store                                                     |
| `src/renderer/src/components/chat/InputToolbar.tsx`        | Use provider store instead of `api.*` settings                                                      |
| `src/renderer/src/App.tsx`                                 | Load providers on startup                                                                           |

## Files to Delete

| File                                                        | Reason                           |
| ----------------------------------------------------------- | -------------------------------- |
| `src/renderer/src/components/settings/ProviderSettings.tsx` | Replaced by `ProviderDetail.tsx` |

## Settings Keys

### Removed (no longer used)

- `api.provider`, `api.apiKey`, `api.baseUrl`, `api.endpoint`, `api.apiVersion`, `api.deploymentName`, `api.model`

### Kept (global model params)

- `api.temperature`, `api.maxTokens`, `api.systemPrompt`

### New

- `active.providerId` — ID of the active provider in `providers` table

## Verification

1. `npm run typecheck` — Ensure no TypeScript errors across all processes
2. `npm run dev` — Run the app and verify:
   - Settings > Provider shows the two-column layout
   - Can add providers from predefined templates
   - Can configure each provider (API key, base URL, model)
   - Can set a provider as active (default)
   - Can delete providers
   - Test Connection works per-provider
   - Chat uses the active provider's settings
   - No references to old `api.*` provider settings remain
3. `npm run lint` — No lint errors
