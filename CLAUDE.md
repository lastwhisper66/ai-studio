# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Studio - A Windows desktop AI chat application built with Electron + React. Supports OpenAI API and Azure OpenAI API with multi-conversation management and local persistent storage.

## Tech Stack

- **Runtime**: Electron (desktop) + React 19 (UI)
- **Language**: TypeScript (strict mode)
- **Build**: electron-vite (Vite-based, manages main/preload/renderer builds)
- **Package Manager**: pnpm
- **UI**: Shadcn/UI (radix-ui unified package) + Tailwind CSS v4 + Lucide React icons
- **State Management**: Zustand
- **Database**: better-sqlite3 (main process, chat history persistence)
- **AI SDK**: openai npm package (compatible with both OpenAI and Azure OpenAI)

## Architecture

Three-process Electron architecture:

- **Main process** (`src/main/`): Node.js environment. Handles AI API calls (keeps API keys secure), SQLite database operations, and system-level features. AI calls MUST stay in main process to avoid exposing keys and CORS issues.
- **Preload** (`src/preload/`): Secure bridge via `contextBridge.exposeInMainWorld`. Exposes typed IPC channels to renderer. Never expose `ipcRenderer` directly.
- **Renderer** (`src/renderer/`): React app. UI components, Zustand stores, hooks. No direct Node.js or Electron API access - all communication through preload-exposed APIs.

IPC flow: Renderer -> Preload (contextBridge) -> Main -> (AI API / SQLite) -> back

## Tailwind CSS v4 Notes

Tailwind v4 uses CSS-first configuration — no `tailwind.config.js`. Key differences:

- Use `@tailwindcss/vite` plugin in the **renderer** Vite config only
- Design tokens defined via `@theme` directive in CSS alongside `@import "tailwindcss"`
- Automatic content detection (no `content` array needed)
- Animation library: use `tw-animate-css` (not `tailwindcss-animate`)
- `tsconfig.json` must set `moduleResolution` to `bundler` or `nodenext`

## Common Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server with hot reload
pnpm build                # Build for production
pnpm build:win            # Build Windows installer (.exe)
pnpm lint                 # Run ESLint
pnpm typecheck            # Run TypeScript type checking (all three processes)
```

## Key Conventions

- AI API calls go in `src/main/ai/` - never in renderer process
- Database operations go in `src/main/db/` - only accessible from main process
- IPC channel names follow the pattern: `domain:action` (e.g., `chat:send-message`, `conversation:list`)
- Shadcn/UI components live in `src/renderer/src/components/ui/` - added via `npx shadcn@latest add <component>`
- Zustand stores in `src/renderer/src/stores/` - one store per domain (chatStore, settingsStore, etc.)
- Use `streaming: true` for AI responses to enable typewriter effect via IPC event streaming

## OpenAI / Azure OpenAI Compatibility

The `openai` npm package handles both providers. Switch between them by changing the client configuration:

- **OpenAI**: `new OpenAI({ apiKey })`
- **Azure OpenAI**: `new AzureOpenAI({ endpoint, apiKey, apiVersion })`

Both use the same `chat.completions.create()` interface.
