# 阶段二：Tailwind CSS v4 + Shadcn/UI + 基础布局 — 详细实现方案

## Context

阶段一已完成项目脚手架：Electron 39 + React 19 + electron-vite + Tailwind CSS v4 (已安装 `@tailwindcss/vite` 插件)。当前应用仅显示 "AI Studio" 标题文字。

本阶段目标：集成 Shadcn/UI 组件库，实现深色/浅色主题切换，搭建左右分栏聊天界面骨架（静态），为后续数据层和 AI 对话功能打好 UI 基础。

---

## 实施步骤

### 步骤 1：安装依赖

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react tw-animate-css
```

| 包名                       | 用途                                                     |
| -------------------------- | -------------------------------------------------------- |
| `class-variance-authority` | 组件变体管理（Button、Badge 等 Shadcn 组件内部使用）     |
| `clsx`                     | 条件拼接 className                                       |
| `tailwind-merge`           | 智能合并 Tailwind 类名，避免冲突                         |
| `lucide-react`             | Shadcn 默认图标库                                        |
| `tw-animate-css`           | Tailwind v4 动画工具（替代 v3 的 `tailwindcss-animate`） |

> **不安装 `shadcn` npm 包**：该包主要提供 CLI + `shadcn/tailwind.css` base layer。在 Tailwind v4 中，我们直接在 CSS 中手写等效的 base layer 样式（设置 `border-color` 默认值等），避免额外依赖。

---

### 步骤 2：创建 `components.json`（Shadcn 配置）

**文件**: `components.json`（项目根目录）

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/assets/main.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@renderer/components",
    "utils": "@renderer/lib/utils",
    "ui": "@renderer/components/ui",
    "lib": "@renderer/lib",
    "hooks": "@renderer/hooks"
  },
  "iconLibrary": "lucide"
}
```

关键配置说明：

- `"config": ""` — Tailwind v4 无配置文件，必须留空
- `"rsc": false` — Electron 无 React Server Components
- `"style": "new-york"` — 更紧凑的视觉风格，适合桌面应用
- 别名使用 `@renderer/*` 匹配已有的 tsconfig path alias

---

### 步骤 3：创建 `cn()` 工具函数

**文件**: `src/renderer/src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

---

### 步骤 4：重写 `main.css` — 完整的 Tailwind v4 + Shadcn 主题系统

**文件**: `src/renderer/src/assets/main.css`

完全替换现有内容，建立完整的双主题设计令牌体系：

```css
@import 'tailwindcss';
@import 'tw-animate-css';

/* Tailwind v4: class-based dark mode */
@custom-variant dark (&:is(.dark *));

/* ── Shadcn/UI base layer ── */
/* 替代 shadcn/tailwind.css：重置默认边框颜色 */
*,
::after,
::before,
::backdrop,
::file-selector-button {
  border-color: var(--color-border);
}

/* ── Map CSS vars → Tailwind utilities via @theme inline ── */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar-background: var(--sidebar-background);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: var(--font-family-sans);
}

/* ── Light theme (default) ── */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
  --sidebar-background: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  --font-family-sans:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
}

/* ── Dark theme ── */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --sidebar-background: oklch(0.17 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.985 0 0);
  --sidebar-primary-foreground: oklch(0.205 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}

/* ── Global base styles ── */
body {
  min-height: 100vh;
  color: var(--color-foreground);
  background: var(--color-background);
  font-family: var(--font-family-sans);
  overflow: hidden;
}
```

---

### 步骤 5：配置 Shadcn CLI 并安装组件

由于 Shadcn CLI 无法识别 `electron.vite.config.ts`，需要临时创建 `vite.config.ts`：

```bash
# 1. 创建临时 vite.config.ts（内容从 electron.vite.config.ts 的 renderer 部分提取）
# 2. 运行 shadcn add 安装组件
npx shadcn@latest add button input scroll-area separator tooltip avatar textarea
# 3. 删除临时 vite.config.ts
```

**临时 `vite.config.ts`** 内容：

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
})
```

安装完组件后**删除**此文件。

**安装的组件列表**（本阶段需要）：

| 组件          | 用途                         |
| ------------- | ---------------------------- |
| `button`      | 新建对话、主题切换等交互按钮 |
| `input`       | 搜索框占位                   |
| `scroll-area` | 对话列表和消息列表滚动容器   |
| `separator`   | 侧边栏分隔线                 |
| `tooltip`     | 按钮悬停提示                 |
| `avatar`      | 用户/AI 头像占位             |
| `textarea`    | 消息输入框占位               |

> **注意**: `dialog` 和 `dropdown-menu` 推迟到阶段三/五再安装（按需引入）。

---

### 步骤 6：实现主题系统

#### 6a. ThemeProvider 组件

**文件**: `src/renderer/src/components/theme/ThemeProvider.tsx`

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }

    localStorage.setItem('theme', theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
```

#### 6b. useTheme Hook

**文件**: `src/renderer/src/hooks/useTheme.ts`

```ts
import { useContext } from 'react'
import { ThemeContext } from '@renderer/components/theme/ThemeProvider'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

---

### 步骤 7：创建布局组件

#### 7a. AppLayout — 根布局

**文件**: `src/renderer/src/components/layout/AppLayout.tsx`

顶层 flex 容器，包含 Sidebar + ChatPanel，占满整个窗口。

- 使用 `h-screen` 占满视窗高度
- 水平 `flex` 布局

#### 7b. Sidebar — 左侧面板

**文件**: `src/renderer/src/components/layout/Sidebar.tsx`

- 固定宽度 280px，可折叠
- 顶部：应用标题 + 新建对话按钮
- 中部：对话列表占位（ScrollArea）
- 底部：主题切换按钮 + 设置齿轮按钮
- 使用 `bg-sidebar-background` / `text-sidebar-foreground` 侧边栏专用色

#### 7c. ChatPanel — 右侧聊天区

**文件**: `src/renderer/src/components/layout/ChatPanel.tsx`

- `flex-1` 占满剩余宽度
- 顶部：当前对话标题栏
- 中部：消息列表占位区域
- 底部：输入框占位
- 空状态显示欢迎文案

---

### 步骤 8：更新 App.tsx 和 main.tsx

#### App.tsx

替换当前内容，渲染 `AppLayout`：

```tsx
import { AppLayout } from '@renderer/components/layout/AppLayout'

function App(): React.JSX.Element {
  return <AppLayout />
}

export default App
```

#### main.tsx

包裹 `ThemeProvider`：

```tsx
import './assets/main.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './components/theme/ThemeProvider'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
```

---

## 需要创建/修改的文件清单

| 操作         | 文件路径                                              | 说明                      |
| ------------ | ----------------------------------------------------- | ------------------------- |
| **新建**     | `components.json`                                     | Shadcn 配置               |
| **新建**     | `src/renderer/src/lib/utils.ts`                       | `cn()` 工具函数           |
| **新建**     | `src/renderer/src/components/theme/ThemeProvider.tsx` | 主题上下文                |
| **新建**     | `src/renderer/src/hooks/useTheme.ts`                  | 主题 Hook                 |
| **新建**     | `src/renderer/src/components/layout/AppLayout.tsx`    | 根布局                    |
| **新建**     | `src/renderer/src/components/layout/Sidebar.tsx`      | 侧边栏                    |
| **新建**     | `src/renderer/src/components/layout/ChatPanel.tsx`    | 聊天面板                  |
| **修改**     | `src/renderer/src/assets/main.css`                    | 完整主题系统              |
| **修改**     | `src/renderer/src/App.tsx`                            | 渲染 AppLayout            |
| **修改**     | `src/renderer/src/main.tsx`                           | 包裹 ThemeProvider        |
| **自动生成** | `src/renderer/src/components/ui/*.tsx`                | Shadcn 组件（CLI 生成）   |
| **临时**     | `vite.config.ts`                                      | Shadcn CLI 用，安装后删除 |

---

## 实施顺序

```
1. pnpm add 依赖 ────────────────────────────────────┐
2. 创建 components.json                               │
3. 创建 lib/utils.ts                                   │ 基础设施
4. 重写 main.css（完整主题令牌）                        │
5. 临时 vite.config.ts → npx shadcn add → 删除临时文件 ─┘
6. 创建 ThemeProvider + useTheme ─────────────────────── 主题系统
7. 创建 AppLayout + Sidebar + ChatPanel ─────────────── 布局组件
8. 更新 App.tsx + main.tsx ──────────────────────────── 组装
9. pnpm dev 验证 + pnpm typecheck + pnpm lint ───────── 验证
```

---

## 验证清单

- [ ] `pnpm dev` → Electron 窗口显示左右分栏布局
- [ ] 左侧 Sidebar 280px，含标题、按钮占位、底部主题切换
- [ ] 右侧 ChatPanel 占满剩余空间，显示欢迎文案
- [ ] 点击主题切换按钮 → 深色/浅色正确切换
- [ ] Shadcn Button 等组件渲染正确，跟随主题变化
- [ ] `pnpm typecheck` 无错误
- [ ] `pnpm lint` 无错误
- [ ] 无临时文件残留（`vite.config.ts` 已删除）
