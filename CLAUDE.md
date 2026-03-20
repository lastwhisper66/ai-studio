# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Studio - A Windows desktop AI chat application built with Electron + React. Supports OpenAI API and Azure OpenAI API with multi-conversation management, streaming responses, markdown rendering, and local persistent storage (SQLite).

## Tech Stack

- **Runtime**: Electron 39 (desktop) + React 19 (UI)
- **Language**: TypeScript (strict mode)
- **Build**: electron-vite (Vite-based, manages main/preload/renderer builds)
- **Package Manager**: npm
- **UI**: Shadcn/UI (radix-ui unified package) + Tailwind CSS v4 + Lucide React icons
- **State Management**: Zustand 5
- **Database**: better-sqlite3 (main process, WAL mode, chat history persistence)
- **AI SDK**: openai npm package (compatible with both OpenAI and Azure OpenAI)
- **Markdown**: react-markdown + remark-gfm + Shiki (syntax highlighting)

## Architecture

Three-process Electron architecture:

- **Main process** (`src/main/`): Node.js environment. Handles AI API calls (keeps API keys secure), SQLite database operations, window state persistence, and system-level features. AI calls MUST stay in main process to avoid exposing keys and CORS issues.
- **Preload** (`src/preload/`): Secure bridge via `contextBridge.exposeInMainWorld('api', ...)`. Exposes typed IPC channels to renderer. Never expose `ipcRenderer` directly.
- **Renderer** (`src/renderer/`): React app. UI components, Zustand stores, hooks. No direct Node.js or Electron API access - all communication through `window.api.*`.
- **Shared** (`src/shared/`): Type definitions and IPC channel constants shared across all processes.

IPC flow: Renderer -> Preload (contextBridge) -> Main -> (AI API / SQLite) -> back

All IPC responses use `IpcResult<T>` wrapper: `{ success: boolean, data?: T, error?: string }`

## Project Structure

```
src/
├── main/
│   ├── index.ts              # App entry, window creation, window state persistence
│   ├── ai/                   # AI client factories (openai-client, azure-client)
│   ├── db/                   # SQLite operations (database, conversations, messages, settings, providers, models, assistants)
│   └── ipc/                  # IPC handler registration (chat, conversation, message, settings, provider, model, assistant, translate, window)
├── preload/
│   ├── index.ts              # contextBridge API exposure
│   └── index.d.ts            # TypeScript types for window.api and window.electron
├── renderer/src/
│   ├── App.tsx               # Root component, store initialization
│   ├── main.tsx              # Entry point with ThemeProvider + TooltipProvider
│   ├── assets/main.css       # Tailwind v4 config, CSS variables, themes
│   ├── components/
│   │   ├── chat/             # ChatView, MessageList, MessageInput, MessageBubble, MarkdownRenderer, CodeBlock, WelcomeScreen, AssistantPickerDialog, AssistantSettingsDialog, InputToolbar
│   │   ├── layout/           # AppLayout, ChatPanel, AssistantSidebar, TopicPanel, PrimaryNav, TitleBar
│   │   ├── settings/         # SettingsPage, SettingsSidebar, ProviderList, ProviderDetail, ModelSection, GeneralSection, DisplaySection
│   │   ├── translate/        # Translation feature components
│   │   ├── theme/            # ThemeProvider, ThemeContext
│   │   └── ui/               # Shadcn/UI primitives
│   ├── hooks/                # useKeyboardShortcuts, useAutoScroll, useTheme, useThrottledValue
│   ├── lib/                  # shiki highlighter setup, utils (cn)
│   └── stores/               # conversationStore, settingsStore, assistantStore, providerStore
├── shared/
│   └── types.ts              # Shared interfaces and IPC channel definitions
data/                         # Runtime data (SQLite DB, window-state.json) - gitignored
```

## Database Schema

SQLite with WAL mode and foreign key constraints enabled:

- **conversations**: `id` (TEXT PK), `title`, `created_at`, `updated_at`, `model`, `system_prompt`
- **messages**: `id` (TEXT PK), `conversation_id` (FK), `role`, `content`, `created_at`, `token_count` — indexed on `(conversation_id, created_at)`
- **settings**: `key` (TEXT PK), `value` — API key encrypted via Electron safeStorage
- **providers**: `id` (TEXT PK), `type`, `name`, `api_key`, `base_url`, `model`, `endpoint`, `api_version`, `deployment_name`, `enabled`, `sort_order`
- **models**: `id` (TEXT PK), `provider_id` (FK → providers, CASCADE), `name`, `enabled`, `sort_order` — indexed on `provider_id`
- **assistants**: `id` (TEXT PK), `name`, `description`, `system_prompt`, `provider_id` (FK), `model`, `temperature`, `max_completion_tokens`, `top_p`, `context_count`, `prompt_suggestions` (JSON array string), `is_default`, `group_name`, `sort_order`

## IPC Channels

All channels follow `domain:action` naming:

| Domain           | Channels                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| **conversation** | `list`, `get`, `create`, `update`, `delete`                                                      |
| **message**      | `list`, `create`, `delete`, `clear`                                                              |
| **settings**     | `get`, `set`, `get-all`                                                                          |
| **chat**         | `send-message`, `stream-chunk`, `stream-end`, `stream-error`, `stop-generation`, `title-updated` |
| **provider**     | `list`, `get`, `delete`                                                                          |
| **model**        | `list`, `create`, `delete`                                                                       |
| **assistant**    | `list`, `get`, `delete`                                                                          |
| **translate**    | `stop`                                                                                           |
| **window**       | `minimize`, `maximize`, `is-maximized`, `close`                                                  |

Chat streaming uses event-based IPC (not request-response): main process emits `chat:stream-chunk` events, renderer listens via `window.api.onStreamChunk()`.

## Shared Types

Key interfaces in `src/shared/types.ts`:

- `Conversation` — id, title, createdAt, updatedAt, model, systemPrompt
- `Message` — id, conversationId, role, content, createdAt, tokenCount
- `ApiSettings` — provider, apiKey, baseUrl, endpoint, apiVersion, deploymentName, model, temperature, maxCompletionTokens, systemPrompt
- `ApiProvider` — `'openai' | 'azure'`
- `IpcResult<T>` — Generic response wrapper for all IPC calls
- `SendMessagePayload`, `StreamChunkData`, `StreamEndData`, `StreamErrorData`

## Common Commands

```bash
npm install               # Install dependencies
npm run dev               # Start dev server with hot reload
npm run build             # Build for production (includes typecheck)
npm run build:win         # Build Windows installer (.exe)
npm run lint              # Run ESLint (with cache)
npm run format            # Run Prettier
npm run typecheck         # Run TypeScript type checking (all three processes)
```

## Code Style

- **Prettier**: single quotes, no semicolons, 2-space indent, 100 char width, trailing commas, LF line endings (`.prettierrc.yaml`)
- **ESLint**: electron-toolkit TS config + React recommended + JSX runtime + hooks/refresh plugins
- Shadcn/UI components (`components/ui/`) are exempt from explicit return type and named export rules

## TypeScript Path Aliases

- `@renderer/*` → `src/renderer/src/*` (renderer process only)
- `@shared/*` → `src/shared/*` (available in all processes)

## Key Conventions

- AI API calls go in `src/main/ai/` — never in renderer process
- Database operations go in `src/main/db/` — only accessible from main process
- IPC handlers go in `src/main/ipc/` — one file per domain
- Shadcn/UI components live in `src/renderer/src/components/ui/` — added via `npx shadcn@latest add <component>`
- Zustand stores in `src/renderer/src/stores/` — one store per domain (conversationStore, settingsStore, assistantStore, providerStore)
- Use `streaming: true` for AI responses to enable typewriter effect via IPC event streaming
- Conversation titles auto-generated by AI after first assistant response
- `prompt_suggestions` field on assistants stored as JSON string array in SQLite

## Provider / Model / Assistant System

The app supports a multi-provider architecture where providers, models, and assistants are independently managed:

- **Providers**: configured AI backends (OpenAI, Azure, custom). Each has connection settings and an API key.
- **Models**: belong to a provider; represent available models for selection.
- **Assistants**: named configurations with system prompt, provider/model binding, and generation parameters (temperature, max_completion_tokens, top_p, context_count).

Key conventions:
- Provider CRUD: `src/main/db/providers.ts` + `src/main/ipc/provider-handlers.ts` + `providerStore.ts`
- Model CRUD: `src/main/db/models.ts` + `src/main/ipc/model-handlers.ts`
- Assistant CRUD: `src/main/db/assistants.ts` + `src/main/ipc/assistant-handlers.ts` + `assistantStore.ts`
- Settings UI: `src/renderer/src/components/settings/` (SettingsPage with SettingsSidebar, ProviderList, ProviderDetail, ModelSection)

## Security

- **API key encryption**: Sensitive settings (e.g., `api.apiKey`) encrypted with Electron `safeStorage` in main process
- **Context isolation**: Enabled with sandbox mode — renderer has no direct Node.js access
- **No direct ipcRenderer**: All IPC wrapped through preload contextBridge
- **AbortController**: AI streaming requests can be cancelled via `chat:stop-generation`

## OpenAI / Azure OpenAI Compatibility

The `openai` npm package handles both providers. Switch between them by changing the client configuration:

- **OpenAI**: `new OpenAI({ apiKey })` — optionally with custom `baseURL`
- **Azure OpenAI**: `new AzureOpenAI({ endpoint, apiKey, apiVersion })` — default apiVersion: `'2024-10-01-preview'`

Both use the same `chat.completions.create()` interface.

## Tailwind CSS v4 Notes

Tailwind v4 uses CSS-first configuration — no `tailwind.config.js`. Key differences:

- Use `@tailwindcss/vite` plugin in the **renderer** Vite config only
- Design tokens defined via `@theme` directive in CSS alongside `@import "tailwindcss"`
- Automatic content detection (no `content` array needed)
- Animation library: use `tw-animate-css` (not `tailwindcss-animate`)
- Theme colors use oklch color space with light/dark mode support via CSS variables
- `tsconfig.json` must set `moduleResolution` to `bundler` or `nodenext`
