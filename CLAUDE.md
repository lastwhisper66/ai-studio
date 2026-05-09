# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Studio — a Windows desktop AI chat application built with Electron + React. Supports multiple LLM providers (OpenAI / Azure / Anthropic / Gemini / DeepSeek / SiliconFlow / NewAPI / OpenAI Response API), multi-conversation management, streaming responses with reasoning content, file attachments (image/text/PDF), markdown + Mermaid + KaTeX rendering, an in-app translation view, a global Quick Assistant popup, screenshot translation, a Windows-wide Selection Assistant (text selection toolbar + result bubble), and local persistent storage (SQLite WAL).

## Tech Stack

- **Runtime**: Electron 39 (desktop) + React 19 (UI)
- **Language**: TypeScript (strict mode), split typecheck (`tsconfig.node.json` for main/preload, `tsconfig.web.json` for renderer)
- **Build**: electron-vite (Vite-based; one entry per process)
- **Package Manager**: npm (with `postinstall` running `electron-rebuild` for `better-sqlite3`)
- **UI**: Shadcn/UI on `radix-ui` + Tailwind CSS v4 + Lucide icons + `tw-animate-css`
- **State Management**: Zustand 5
- **Database**: better-sqlite3 (main process, WAL mode, foreign keys on)
- **AI SDKs**: `openai` (covers OpenAI / Azure / DeepSeek / SiliconFlow / NewAPI), `@anthropic-ai/sdk` (Claude / Anthropic), `@google/genai` (Gemini)
- **Markdown**: `react-markdown` + `remark-gfm` + `remark-math` + `remark-supersub` + `rehype-raw` + `rehype-sanitize` + Shiki (syntax highlighting) + `mermaid` + `katex`
- **i18n**: `i18next` + `react-i18next` (zh-CN / en) — also used in main process for tray/dialog strings
- **Native add-ons**: `selection-hook` (Windows global text-selection hook), `node-screenshots` (screen capture)

## Architecture

Three-process Electron architecture with **multiple renderer entries served from a single bundle**:

- **Main process** (`src/main/`): Node.js. Handles AI streaming, SQLite, window/tray management, global shortcuts, native hooks (selection / screenshot), file IO, encryption. AI calls MUST stay here to keep API keys safe and avoid CORS.
- **Preload** (`src/preload/index.ts`): Secure bridge via `contextBridge.exposeInMainWorld('api', ...)`. Only typed wrappers around `ipcRenderer.invoke` / `ipcRenderer.on` are exposed. Never expose `ipcRenderer` directly.
- **Renderer** (`src/renderer/`): React app. Five separate "apps" share one HTML/JS bundle and switch by URL `?mode=`:
  - no `mode` → main `App` (chat / translate / settings)
  - `?mode=quick-assistant` → `QuickAssistantApp`
  - `?mode=screenshot` → `ScreenshotApp` (full-screen overlay for region capture)
  - `?mode=selection-toolbar` → `SelectionToolbarApp`
  - `?mode=selection-bubble` → `SelectionBubbleApp`
- **Shared** (`src/shared/`): Types, IPC channel constants, keybinding registry, error codes, language list, URL helpers, zoom helpers.

IPC flow: Renderer → Preload (contextBridge) → Main → (AI SDK / SQLite / native) → back. Request-response IPCs return `IpcResult<T> = { success: boolean, data?: T, error?: LocalizedError }`. Streaming uses event-push (`chat:stream-chunk`, `chat:stream-reasoning-chunk`, `chat:stream-end`, `chat:stream-error`, etc.).

## Project Structure

```
src/
├── main/
│   ├── index.ts                    # App entry: single-instance lock, window state, tray, global shortcuts, IPC registration
│   ├── app-state.ts                # Boot-time settings (closeToTray, autoLaunch, spell-check, quickAssistant/selection toggles)
│   ├── i18n.ts                     # Main-process i18n (tray menu, file dialogs)
│   ├── errors.ts                   # AppError class
│   ├── screenshot.ts               # Region screenshot overlay + auto-execute into Quick Assistant
│   ├── quick-assistant-window.ts   # Pre-created floating Quick Assistant window
│   ├── selection-toolbar-window.ts # Pre-created selection toolbar window (280×44, focusable: false)
│   ├── selection-bubble-window.ts  # Pre-created selection result bubble window (resizable, pinnable)
│   ├── selection-service.ts        # SelectionHook singleton: filters, anchor → DIP, search engine fallback
│   ├── ai/
│   │   ├── index.ts                #   `applySslSetting`, `createAIClient`, `generateTitle`
│   │   ├── stream-chat.ts          #   Unified entry: dispatches by `ProviderType`
│   │   ├── openai-client.ts        #   OpenAI / Azure / OpenAI-compatible client factory
│   │   ├── openai-stream.ts        #   chat.completions streaming (OpenAI-compatible)
│   │   ├── openai-response-stream.ts #  OpenAI Responses API streaming (`provider = openai-response`)
│   │   ├── gemini-stream.ts        #   `@google/genai` streaming
│   │   └── claude-stream.ts        #   `@anthropic-ai/sdk` streaming
│   ├── db/
│   │   ├── database.ts             #   init/close, WAL, schema creation, seeding
│   │   ├── index.ts                #   Re-exports every CRUD module
│   │   ├── settings.ts             #   `safeStorage`-encrypted values for keys matching `*.apiKey` / `api.apiKey`
│   │   ├── conversations.ts
│   │   ├── messages.ts
│   │   ├── attachments.ts          #   Reads/writes files under `data/attachments/`
│   │   ├── providers.ts
│   │   ├── models.ts
│   │   ├── model-definitions.ts    #   Global model capability library
│   │   ├── model-groups.ts         #   Regex-based grouping rules for remote model lists
│   │   ├── assistants.ts
│   │   ├── phrases.ts              #   Quick phrase library
│   │   ├── translation-history.ts
│   │   ├── quick-actions.ts        #   Built-in + user actions for Quick Assistant
│   │   ├── selection-actions.ts    #   Built-in + user actions for Selection Assistant
│   │   └── seeds/                  #   `providers.ts`, `actions.ts`, `assistants.ts`, `catalogs.ts`, `index.ts`
│   ├── migrate/                    # Boot-time, idempotent data migrations. `index.ts` exports `runMigrations()` (called once after `initDatabase()` in `main/index.ts`); each migration lives in its own file (e.g. `backup-settings.ts`). Add new migrations here.
│   ├── ipc/                        # 21 handler files; one per domain — see "IPC Channels" below
│   └── utils/
│       ├── paths.ts                #   `getDataDir()` (resolves to `data/` in dev, userData in prod)
│       ├── notification.ts
│       ├── strip-translate-tags.ts #   Removes `<translate_input>` echoes from model output
│       └── window-size-persist.ts  #   Debounced size persistence helper used by all popup windows
├── preload/
│   └── index.ts                    # Typed `window.api` exposure via contextBridge (no separate .d.ts)
├── renderer/src/
│   ├── main.tsx                    # `?mode=` router: App | QuickAssistantApp | ScreenshotApp | SelectionToolbarApp | SelectionBubbleApp
│   ├── App.tsx                     # Loads stores, reconciles i18n with `general.language`, wires zoom + global shortcuts
│   ├── env.d.ts
│   ├── assets/main.css             # Tailwind v4 `@theme`, oklch palette, light/dark variables
│   ├── components/
│   │   ├── chat/                   #   ChatView, MessageList, MessageBubble, MessageInput, MarkdownRenderer, CodeBlock, MathBlock, MermaidBlock, ThinkingBlock, ZoomablePreviewDialog, AssistantPickerDialog, AssistantSettingsDialog, ModelPickerDialog, SystemPromptBanner, WelcomeScreen, BlockToolbarBtn
│   │   ├── layout/                 #   AppLayout, ChatPanel, AssistantSidebar, TopicPanel, PrimaryNav, TitleBar, UserProfileDialog
│   │   ├── settings/               #   SettingsPage + 11 sections (Provider, ModelLibrary, ModelGroup, General, Network, Display, Data, Phrases, KeyboardShortcuts, QuickAssistant, SelectionAssistant) + dialogs (AddProvider, AddModel, EditModel, RemoteModel, ConnectionTest, ShortcutRecorder)
│   │   ├── translate/              #   TranslateView, TranslateSettingsDialog
│   │   ├── theme/                  #   ThemeProvider, ThemeContext, themes/{default,mint,lavender,ocean,amber,rose}
│   │   ├── quick-assistant/        #   QuickAssistantApp, ActionList, QuickAssistantResult, icons
│   │   ├── selection-toolbar/      #   SelectionToolbarApp, icons
│   │   ├── selection-bubble/       #   SelectionBubbleApp
│   │   ├── screenshot/             #   ScreenshotApp (drag-select overlay)
│   │   └── ui/                     #   Shadcn primitives + custom emoji-picker, sortable-item
│   ├── stores/                     # 10 Zustand stores: conversation, settings, provider, assistant, phrase, modelDefinition, modelGroup, quickAction, selectionAction, keybinding
│   ├── hooks/                      # useKeyboardShortcuts, useAutoScroll, useTheme, useThrottledValue, useCopyToClipboard, useElapsedTime, useFontSettings, useLocalizedError, useSeedTranslator, useUserAvatar
│   ├── i18n/
│   │   ├── index.ts                #   i18next + LanguageDetector (localStorage `ai-studio-language`)
│   │   └── locales/{en,zh-CN}.json
│   └── lib/                        # shiki.ts, inferModelGroup.ts, utils.ts (`cn`)
└── shared/
    ├── types.ts                    # Conversation, Message, Provider, Model, Assistant, ApiSettings, IpcResult, all stream payloads, Selection/Quick types
    ├── ipc-channels.ts             # `IpcChannels` constant — single source of truth
    ├── keybindings.ts              # `DEFAULT_KEYBINDINGS` registry + accelerator parser
    ├── errors.ts                   # `LocalizedError`, `ERROR_CODES`
    ├── languages.ts                # Translation language list
    ├── zoom.ts                     # `ZOOM_MIN/MAX/STEP/DEFAULT`, `clampZoom`
    ├── url.ts
    └── index.ts

data/                               # Runtime data (gitignored): ai-studio.db, window-state.json, attachments/, avatars/
```

## Database Schema

SQLite, WAL journal, foreign keys ON. Schema and seeding live in `src/main/db/database.ts`. Tables:

- **conversations** — `id` (PK), `title`, `created_at`, `updated_at`, `system_prompt`, `assistant_id`, `pinned`
- **messages** — `id` (PK), `conversation_id` (FK→conversations, CASCADE), `role` (`'user'|'assistant'|'system'|'divider'`), `content`, `reasoning_content`, `created_at`, `token_count`, `attachments` (JSON), `duration` (ms), `thinking_duration` (ms); indexed on `conversation_id` and `created_at`
- **settings** — `key` (PK), `value`. Values for keys matching `*.apiKey` (e.g. `api.apiKey`, providers' `api_key`) are encrypted with Electron `safeStorage`
- **providers** — `id` (PK), `type` (`ProviderType`), `name`, `api_key`, `base_url`, `enabled`, `is_default`, `sort_order`, `created_at`, `updated_at`
- **models** — `id` (PK), `provider_id` (FK→providers, CASCADE), `name`, `group_name`, `capabilities` (JSON `ModelCapability[]`), `enabled`, `sort_order`, `created_at`; indexed on `provider_id`
- **model_definitions** — global capability library (`id`, `name` UNIQUE, `group_name`, `capabilities`, `provider_types`); indexed on `name`
- **model_groups** — regex grouping rules for remote model fetches (`id`, `pattern` UNIQUE, `display_name`, `sort_order`); indexed on `pattern`
- **assistants** — `id` (PK), `name`, `icon`, `description`, `system_prompt`, `provider_id`, `model`, `temperature`, `max_completion_tokens`, `top_p`, `context_count`, `prompt_suggestions` (JSON string array), `is_default`, `group_name`, `sort_order`, timestamps
- **phrases** — `id`, `title`, `content`, `sort_order`, `created_at` (quick-phrase library)
- **translation_history** — `id`, `source_text`, `translated_text`, `source_lang`, `target_lang`, `created_at`
- **quick_actions** — Quick Assistant actions: `id`, `name`, `description`, `system_prompt`, `icon`, `is_builtin`, `sort_order`, `enabled`, timestamps. Built-ins seeded: answer, translate, summarize, image-translate.
- **selection_actions** — Selection Assistant actions; same shape as `quick_actions`. Built-ins seeded for translate / explain / summarize / rewrite / search.

Default providers seeded on first run (`src/main/db/seeds/providers.ts`): OpenAI, DeepSeek, OpenAI Response, Gemini, Claude, Silicon Flow, New API, Azure OpenAI.

## IPC Channels

All channel names are constants in `src/shared/ipc-channels.ts` (`IpcChannels` object). Domains:

| Domain                     | Notes                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **conversation**           | `list`, `get`, `create`, `update`, `delete`, `delete-many`                                                                                                                                                                     |
| **message**                | `list`, `list-paginated`, `create`, `update`, `delete`, `clear`, `insert-divider`                                                                                                                                              |
| **chat** (streaming)       | Request: `send-message`, `stop-generation`. Push: `stream-chunk`, `stream-reasoning-chunk`, `stream-end`, `stream-error`, `title-updated`                                                                                      |
| **translate** (streaming)  | `request`, `stop` + push `chunk`, `end`, `error`                                                                                                                                                                               |
| **translation-history**    | `list`, `create`, `clear`                                                                                                                                                                                                      |
| **provider**               | `list`, `get`, `create`, `update`, `delete`, `reorder`, `test-connection`                                                                                                                                                      |
| **model**                  | `list`, `create`, `update`, `delete`, `delete-by-provider`, `reorder`, `fetch-remote`                                                                                                                                          |
| **model-definition**       | `list`, `create`, `update`, `delete`                                                                                                                                                                                           |
| **model-group**            | `list`, `create`, `update`, `delete`                                                                                                                                                                                           |
| **assistant**              | `list`, `get`, `create`, `update`, `delete`, `reorder`                                                                                                                                                                         |
| **phrase**                 | `list`, `create`, `update`, `delete`                                                                                                                                                                                           |
| **settings**               | `get`, `set`, `set-batch`, `get-all` + push `language-changed`, `changed`                                                                                                                                                      |
| **file / attachment**      | `file:open-dialog`, `file:save`, `attachment:read`                                                                                                                                                                             |
| **window**                 | `minimize`, `maximize`, `is-maximized`, `close`, `toggle-always-on-top`, `is-always-on-top` + push `maximized-change`, `always-on-top-change`. Zoom: `set-zoom`, `get-zoom` + push `zoom-changed`                              |
| **app / clipboard / user** | `app:get-fonts`, `app:clear-chats`, `app:clear-settings`, `app:reset`, `clipboard:write-image`, `user:save-avatar`, `user:read-avatar`                                                                                         |
| **quick-action**           | CRUD: `list`, `create`, `update`, `delete`, `reorder`                                                                                                                                                                          |
| **quick-assistant**        | Streaming: `request`, `stop`, push `chunk`, `end`, `error`. Window: `close`, `ready`, `set-pinned`, push `state-changed`, `update-shortcut`, `auto-execute`, `get-pending-auto-execute`. Plus `summon-window:update-shortcut`. |
| **screenshot**             | Push `data`, `complete`, `cancel`, `update-shortcut`                                                                                                                                                                           |
| **selection-toolbar**      | `ready`, `data` (push), `action`, `close`, `resize`                                                                                                                                                                            |
| **selection-bubble**       | `ready`, `data` (push), `close`, `set-pinned`, `set-streaming`                                                                                                                                                                 |
| **selection-action**       | CRUD: `list`, `create`, `update`, `delete`, `reorder`                                                                                                                                                                          |
| **selection** (streaming)  | `request`, `stop`, push `chunk`, `end`, `error`. Toggle/runtime: `toggle`, `update-shortcut`, push `state-changed`, `refresh-filter`                                                                                           |

Streaming responses always go via event push, never request-response — abort with `chat:stop-generation` / `translate:stop` / `quick-assistant:stop` / `selection:stop` (each routes to its own `AbortController`).

## AI Provider Architecture

Single dispatch entry: `streamChat()` in `src/main/ai/stream-chat.ts`.

```ts
const OPENAI_COMPATIBLE_TYPES = new Set(['openai', 'azure', 'deepseek', 'silicon', 'newapi'])
```

Routing:

- `openai | azure | deepseek | silicon | newapi` → `streamOpenAIChat` (OpenAI `chat.completions`)
- `openai-response` → `streamOpenAIResponse` (OpenAI Responses API; needed for some `o1`/reasoning workflows)
- `gemini` → `streamGeminiChat` (`@google/genai`)
- `anthropic | claude` → `streamClaudeChat` (`@anthropic-ai/sdk`)
- unknown / legacy → falls back to `streamOpenAIChat`

Each implementation invokes the same `StreamCallbacks` interface (`onChunk(delta, isReasoning?)`, `onEnd?`). Reasoning text (`<think>`, Anthropic `thinking`, OpenAI Responses reasoning) is forwarded with `isReasoning: true`, which the chat handler emits over `chat:stream-reasoning-chunk` separately from the visible content stream.

Title generation (`generateTitle` in `src/main/ai/index.ts`) reuses the same dispatch for non-OpenAI-compatible providers; for OpenAI-compatible ones it makes a single non-streaming `chat.completions.create` for speed.

`applySslSetting()` toggles `NODE_TLS_REJECT_UNAUTHORIZED` based on the `app.skipSslVerify` setting (used for self-hosted / reverse-proxied endpoints with self-signed certs).

## OpenAI / Azure / OpenAI-Compatible Client

`createOpenAIClient(settings)` in `src/main/ai/openai-client.ts` returns a unified `OpenAI`-typed client. For `provider === 'azure'` it constructs `new AzureOpenAI({ endpoint, apiKey, apiVersion })`; otherwise `new OpenAI({ apiKey, baseURL })`. DeepSeek / Silicon Flow / NewAPI all just override `baseURL`.

## Quick Assistant

A floating popup independent of the main window. Pre-created hidden at startup (`preCreateQuickAssistantWindow`) for instant first show.

- **Renderer entry**: `?mode=quick-assistant` → `QuickAssistantApp`
- **Toggle**: global shortcut `toggle-quick-assistant` (default `Ctrl+Shift+Space`); user-customizable
- **Actions**: stored in `quick_actions` table (built-ins: answer / translate / summarize / image-translate), CRUD via `quick-action:*` IPCs
- **Streaming**: `quick-assistant:request` / `chunk` / `end` / `error` / `stop` mirrors `chat:*`
- **Pin & resize**: `quick-assistant:set-pinned`; window size persisted to `quickAssistant.windowWidth/Height` via `createWindowSizePersistor`
- **Auto-execute**: the screenshot module (`src/main/screenshot.ts`) calls `showQuickAssistantWithAutoExecute` after a region capture, embedding the captured image as a `FileData` attachment and triggering an action automatically

## Selection Assistant

Pops up a floating toolbar next to any text selection in any Windows app; clicking an action opens an AI result bubble in place. Fully independent of the chat window and Quick Assistant.

- **Native hook**: `selection-hook` npm package (prebuilt Windows binaries). `SelectionService` (`src/main/selection-service.ts`) is a singleton that owns the hook instance, applies the user-configured program exclusion list (`setGlobalFilterMode`), and translates physical-pixel coordinates to DIP via `screen.screenToDipPoint` before positioning windows. Clipboard fallback is left at the hook's default (on) so PDF readers and other non-accessible apps still work.
- **Two independent windows**: `selection-toolbar-window.ts` (280×44, `focusable: false` to avoid stealing selection focus) and `selection-bubble-window.ts` (resizable, default 420×320, min 360×240, supports pin). Both are pre-created hidden at startup and use the same opacity-transition trick as Quick Assistant to avoid Windows transparent-flash. Bounds are clamped to the nearest display's `workArea` and flip above the anchor when the bottom overflows. User-driven resizes are debounced and persisted to `selection.bubbleWidth/bubbleHeight` via the shared `createWindowSizePersistor` helper in `src/main/utils/window-size-persist.ts`.
- **Actions**: stored in the `selection_actions` SQLite table (`src/main/db/selection-actions.ts`), mirrors `quick_actions`. Built-ins: translate, explain, summarize, rewrite, search (the search action falls back to the configured search engine via `shell.openExternal`).
- **Trigger modes** (`SelectionTriggerMode`): `'selected'` (toolbar shows on selection) or `'ctrlkey'` (only when Ctrl is held during selection).
- **Settings keys** (all `selection.*`): `enabled`, `providerId`, `modelId`, `triggerMode`, `translateTargetLang`, `searchEngine`, `excludedPrograms` (JSON array), `minTextLength`, `maxTextLength`, `bubbleWidth`, `bubbleHeight`, `defaultPinned`, `clipboardFallback`.
- **Toggle surfaces**: global shortcut `toggle-selection-assistant` (default `Alt+H`), tray checkbox "启用划词助手", and the Switch in Settings → Selection Assistant. All three stay in sync via the `SELECTION_STATE_CHANGED` IPC push.
- **Runtime config refresh**: the renderer calls `window.api.refreshSelectionFilter()` after any filter-related setting changes so the native hook picks up the new list without a restart.

## Screenshot Translation

`Alt+P` (configurable) triggers `startScreenshot()`:

1. Hide the main window if visible.
2. Capture the active display via `node-screenshots` (`Monitor.all()` matched by display bounds).
3. Show a transparent full-screen overlay (`?mode=screenshot`) for region selection.
4. On confirm: re-encode the cropped region as PNG → push as a `ClipboardImagePayload` and into Quick Assistant via `showQuickAssistantWithAutoExecute({ files, actionId: 'builtin-image-translate' })`.

## Keyboard Shortcuts

Registry: `DEFAULT_KEYBINDINGS` in `src/shared/keybindings.ts`. All are user-customizable from **Settings → Keyboard Shortcuts** (persisted in `app.keybindings` / `app.keybindingsDisabled`). In-app shortcuts are dispatched in `useKeyboardShortcuts`; the four globally-scoped accelerators are registered in the main process via `globalShortcut`.

| Action ID                    | Default            | Scope        | Effect                                          |
| ---------------------------- | ------------------ | ------------ | ----------------------------------------------- |
| `new-conversation`           | `Ctrl+N`           | App (in-app) | Create a new conversation                       |
| `toggle-settings`            | `Ctrl+,`           | App (in-app) | Toggle settings ↔ chat view                     |
| `toggle-sidebar`             | `Ctrl+B`           | Window       | Toggle assistant sidebar                        |
| `toggle-topic`               | `Ctrl+Shift+B`     | Window       | Toggle topic panel                              |
| `stop-generation`            | `Escape`           | Chat         | Abort the active stream                         |
| `summon-window`              | `Alt+A`            | Global       | Show & focus the main window from anywhere      |
| `toggle-quick-assistant`     | `Ctrl+Shift+Space` | Global       | Toggle the Quick Assistant popup                |
| `screenshot-translate`       | `Alt+P`            | Global       | Start region screenshot → Quick Assistant       |
| `toggle-selection-assistant` | `Alt+H`            | Global       | Enable/disable the Selection Assistant globally |

In addition, the main window intercepts `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (and `Ctrl+Wheel`) for zoom (persisted in `display.zoomFactor`).

## Internationalization

Two locale files: `src/renderer/src/i18n/locales/{en,zh-CN}.json`. The renderer uses `i18next-browser-languagedetector` (cache key: `ai-studio-language` in localStorage). The main process has its own i18n (`src/main/i18n.ts`) for tray and dialog strings — it watches the `general.language` setting and rebuilds the tray menu through `onLanguageChange`. App boot reconciles the detected language back into `general.language` once.

## Theming

Six color themes defined in `src/renderer/src/components/theme/themes/{default,mint,lavender,ocean,amber,rose}.ts`, all using oklch with light/dark variants. `ThemeProvider` reads `display.colorTheme` and `display.themeMode` from settings and writes CSS variables on `<html>`. Default theme id: `'default'`.

## Common Commands

```bash
npm install               # Installs deps + electron-rebuild for better-sqlite3 (postinstall)
npm run dev               # electron-vite dev with HMR
npm run typecheck         # Runs typecheck:node + typecheck:web
npm run typecheck:node    # Main + preload (tsconfig.node.json)
npm run typecheck:web     # Renderer (tsconfig.web.json)
npm run lint              # ESLint with cache
npm run format            # Prettier (whole repo)
npm run build             # typecheck + electron-vite build
npm run build:win         # Build + Windows installer
npm run build:mac         # macOS build (untested in CI; primary target is Windows)
npm run build:linux       # Linux build (untested in CI)
```

`npm run build` always runs typecheck first, so a clean typecheck is required to ship.

## Code Style

- **Prettier** (`.prettierrc.yaml`): single quotes, no semicolons, 2-space indent, 100-char width, trailing commas, LF line endings
- **ESLint**: `electron-toolkit` TS config + React recommended + JSX runtime + hooks/refresh plugins. Shadcn/UI files in `components/ui/` are exempted from explicit return type and named-export rules.
- **Always run `npm run format` after substantive code changes** to keep diffs small.

## TypeScript Path Aliases

- `@renderer/*` → `src/renderer/src/*` (renderer process only)
- `@shared/*` → `src/shared/*` (available in all processes)

## Key Conventions

- **AI calls**: only in `src/main/ai/`. Never import an AI SDK from preload or renderer.
- **DB access**: only in `src/main/db/`. Renderer talks via IPC.
- **Boot-time migrations**: any one-shot, idempotent data migration (settings reshape, schema fixups, file moves) lives in `src/main/migrate/`. Add a new file per migration and register it in `src/main/migrate/index.ts` `runMigrations()`. Migrations MUST be idempotent — they run on every boot.
- **IPC plumbing**: every new channel must be declared in `src/shared/ipc-channels.ts` `IpcChannels` constant first, then wrapped in `src/preload/index.ts`, then handled in a `src/main/ipc/<domain>-handlers.ts`. Keep one file per domain.
- **Errors**: throw `AppError` (main) with an `ERROR_CODES` key; handlers wrap it into `IpcResult<T>` with a `LocalizedError` payload. The renderer renders it through `useLocalizedError` so the user sees i18n'd text.
- **Streaming**: always event-push, never `await` a chunked response over `invoke`. Use a per-domain `AbortController` (one in `chat-handlers`, `translate-handlers`, `quick-assistant-handlers`, `selection-handlers`).
- **Multi-window apps**: any new popup window should follow the existing pattern — pre-created hidden, route in `src/renderer/src/main.tsx` via `?mode=`, and persist user-resizes through `createWindowSizePersistor`.
- **Sensitive settings**: keys ending in `apiKey` (and provider rows' `api_key` column) are encrypted via `safeStorage`. Don't read them directly — go through `getSetting` / `getProvider`.
- **Conversation titles**: auto-generated by the assistant model after the first response (`chat:title-updated` push).
- **`prompt_suggestions`** on assistants: stored as a JSON-encoded string array.
- **Reasoning content**: surfaced as a separate field on `Message` and a separate stream channel (`chat:stream-reasoning-chunk`), rendered by `ThinkingBlock`.

## Provider / Model / Assistant System

The app supports a multi-provider architecture where providers, models, and assistants are independently managed:

- **Providers**: configured AI backends. Each has connection settings, an API key, and an `is_default` flag. CRUD: `db/providers.ts` + `ipc/provider-handlers.ts` + `providerStore`. `provider:test-connection` does a 1-message ping; `model:fetch-remote` lists models from the remote `/v1/models` endpoint.
- **Model Library** (`model_definitions`): a global catalog of model name → capability tags. When you add a remote model whose name matches a definition, capabilities are inferred automatically. Editable via Settings → Model Library.
- **Model Groups** (`model_groups`): regex patterns mapping model names to display group names. Used to organize the model picker after a remote fetch.
- **Models**: belong to a provider; `enabled` + `sort_order` + `capabilities` (JSON `ModelCapability[]`: `reasoning|vision|web|free|embedding|reranking|tools`).
- **Assistants**: named configurations with a system prompt, provider/model binding, generation parameters (temperature, max_completion_tokens, top_p, context_count), prompt suggestions, group, default flag.

## Security

- **API key encryption**: keys ending in `apiKey` and provider rows' `api_key` use Electron `safeStorage`
- **Context isolation + sandbox**: renderers have no direct Node.js access
- **No exposed `ipcRenderer`**: only the typed `window.api` surface
- **Selection hook**: `selection-hook` uses Windows UIA / Accessibility APIs (and optionally a clipboard fallback). Some antivirus tools may flag the global hook — this is expected for accessibility integrations. The clipboard fallback is on by default and can be toggled in Settings → Selection Assistant; when enabled, password managers and browser address bars are excluded.
- **AbortController everywhere**: every streaming domain owns its own controller and exposes a `*:stop` IPC

## Tailwind CSS v4 Notes

Tailwind v4 uses CSS-first configuration — no `tailwind.config.js`. Key differences:

- Use `@tailwindcss/vite` plugin in the **renderer** Vite config only
- Design tokens defined via `@theme` directive in CSS alongside `@import "tailwindcss"`
- Automatic content detection (no `content` array needed)
- Animation library: use `tw-animate-css` (not `tailwindcss-animate`)
- Theme colors use oklch color space with light/dark mode support via CSS variables
- `tsconfig.json` must set `moduleResolution` to `bundler` or `nodenext`
