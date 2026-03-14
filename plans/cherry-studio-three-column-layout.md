# UI Redesign: Cherry Studio-Inspired Three-Column Layout

## Context

当前 AI Studio 使用两栏布局（Sidebar + ChatPanel），功能集中在一个宽 Sidebar 中。参考 Cherry Studio 的设计语言，将布局升级为三栏结构，同时增加会话搜索、输入工具栏（模型切换）等功能，并统一视觉风格为现代简约蓝色主题。

## Target Layout

```
┌────┬──────────┬────────────────────────────────┐
│    │ 搜索...  │  对话标题              [展开] │
│ ◆  │──────────│────────────────────────────────│
│    │ • 对话 1 │                                │
│ 💬 │ • 对话 2 │  🤖 AI 回复 (左对齐, 浅色)     │
│    │ • 对话 3 │                                │
│    │ • 对话 4 │       用户消息 (右对齐, 蓝色) 👤│
│    │          │                                │
│ ⚙  │          │  [模型: GPT-4o ▼]             │
│ 🌙 │  [+新建] │  [输入消息...        ] [发送]  │
└────┴──────────┴────────────────────────────────┘
48px   280px              flex-1
```

## Implementation Steps

### Step 1: CSS Theme Variables

**File**: `src/renderer/src/assets/main.css`

在 `:root` 和 `.dark` 中添加新的 CSS 变量：

```css
/* :root (light) 添加 */
--chat-user: oklch(0.55 0.15 250);
--chat-user-foreground: oklch(1 0 0);
--nav-background: oklch(0.96 0 0);
--nav-foreground: oklch(0.45 0 0);
--nav-active: oklch(0.55 0.15 250);

/* .dark 添加 */
--chat-user: oklch(0.45 0.14 250);
--chat-user-foreground: oklch(0.98 0 0);
--nav-background: oklch(0.12 0 0);
--nav-foreground: oklch(0.6 0 0);
--nav-active: oklch(0.55 0.14 250);
```

在 `@theme inline` 块中添加对应映射，使 Tailwind 可用 `bg-chat-user`、`bg-nav-background` 等类名。

---

### Step 2: Create `chat-config.ts`

**File (新建)**: `src/renderer/src/lib/chat-config.ts`

静态模型预设列表，供 InputToolbar 的 Select 下拉使用：

```ts
export const MODEL_PRESETS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]
```

---

### Step 3: Create `PrimaryNav.tsx`

**File (新建)**: `src/renderer/src/components/layout/PrimaryNav.tsx`

48px 宽的垂直图标导航栏，始终可见，不可折叠：

- **顶部**: App logo 图标 (Lucide `Sparkles`)
- **中部**: 导航图标 — `MessageSquare`（聊天，常亮高亮态）、`Settings`（点击触发 `settingsStore.setDialogOpen(true)`）
- **底部**: 主题切换 `Sun`/`Moon`（使用 `useTheme`）
- 每个图标用 Shadcn `Tooltip` 包裹
- 背景色: `bg-nav-background`，激活项: `text-nav-active`

---

### Step 4: Create `ConversationPanel.tsx`

**File (新建)**: `src/renderer/src/components/layout/ConversationPanel.tsx`

从 `Sidebar.tsx` 提取而来，280px 宽可折叠面板：

**Props**: `collapsed: boolean`, `onToggle: () => void`

**内部结构**:

1. **Header**: "对话" 标题 + `Plus` 新建按钮 + `PanelLeftClose` 折叠按钮
2. **搜索框**: `Input` 组件 + `Search` 图标前缀，本地 state `searchQuery` 过滤 `conversations`
3. **会话列表**: `ScrollArea` 渲染过滤后的对话列表，每项含 `DropdownMenu`（重命名/删除）
4. **底部**: 新建对话按钮（备选位置）

**迁移内容**（来自 Sidebar.tsx）:

- 会话列表渲染逻辑 + 活跃项高亮
- 重命名对话 Dialog + 状态
- 删除确认 Dialog + 状态
- `useConversationStore` 的 conversations/activeId/CRUD 调用

**不迁移**:

- 主题切换 → 移到 PrimaryNav
- Settings 按钮 → 移到 PrimaryNav
- SettingsDialog 渲染 → 移到 AppLayout

---

### Step 5: Rewire `AppLayout.tsx`

**File**: `src/renderer/src/components/layout/AppLayout.tsx`

核心切换步骤 — 从两栏变三栏：

```tsx
;<div className="flex h-screen w-screen overflow-hidden">
  <PrimaryNav />
  <ConversationPanel collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
  <ChatPanel sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
</div>
{
  /* SettingsDialog 从 Sidebar 移至此处 (lazy-loaded) */
}
;<Suspense fallback={null}>
  {dialogOpen && <SettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
</Suspense>
```

完成后删除旧的 `Sidebar.tsx`。

---

### Step 6: Create `InputToolbar.tsx`

**File (新建)**: `src/renderer/src/components/chat/InputToolbar.tsx`

输入区域上方的工具栏，包含模型切换下拉：

- 使用 Shadcn `Select` 组件
- 读取: `useSettingsStore(s => s.settings['api.model'])`
- 写入: `saveSettings({ 'api.model': value })`
- 选项来源: `MODEL_PRESETS` from `chat-config.ts`
- 紧凑样式: 高度 ~32px，`text-xs`

---

### Step 7: Update `ChatView.tsx`

**File**: `src/renderer/src/components/chat/ChatView.tsx`

调整输入区域结构，将 InputToolbar 和 MessageInput 包裹在一个 `border-t` 容器中：

```tsx
<div className="border-t">
  <InputToolbar />
  <MessageInput onSend={handleSend} onStop={stopGeneration} isStreaming={isStreaming} />
</div>
```

头部展开按钮逻辑不变（`sidebarCollapsed` 现在控制 ConversationPanel）。

---

### Step 8: Update `MessageBubble.tsx`

**File**: `src/renderer/src/components/chat/MessageBubble.tsx`

视觉增强:

1. **添加头像**: 使用 Shadcn `Avatar` + `AvatarFallback`
   - 用户: `User` 图标，放在气泡右侧
   - AI: `Bot` 图标，放在气泡左侧
2. **圆角升级**: `rounded-lg` → `rounded-2xl`
3. **用户气泡颜色**: `bg-primary` → `bg-chat-user text-chat-user-foreground`（蓝色）
4. **间距调整**: padding 增加至 `px-4 py-3`
5. **布局**: `flex items-start gap-3` 确保头像顶部对齐

---

### Step 9: Minor Polish

- **`MessageList.tsx`**: `space-y-4` → `space-y-6`（更多呼吸空间）
- **`MessageInput.tsx`**: 移除 `border-t`（已移至 ChatView 父容器）
- **`WelcomeScreen.tsx`**: 建议卡片 `rounded-lg` → `rounded-xl`

---

### Step 10: Keyboard Shortcut

**File**: `src/renderer/src/hooks/useKeyboardShortcuts.ts` 或 `AppLayout.tsx`

添加 `Ctrl+B` 快捷键切换 ConversationPanel 显示/隐藏。

---

## Files Summary

| Action     | File                                                       |
| ---------- | ---------------------------------------------------------- |
| **NEW**    | `src/renderer/src/components/layout/PrimaryNav.tsx`        |
| **NEW**    | `src/renderer/src/components/layout/ConversationPanel.tsx` |
| **NEW**    | `src/renderer/src/components/chat/InputToolbar.tsx`        |
| **NEW**    | `src/renderer/src/lib/chat-config.ts`                      |
| **MODIFY** | `src/renderer/src/assets/main.css`                         |
| **MODIFY** | `src/renderer/src/components/layout/AppLayout.tsx`         |
| **MODIFY** | `src/renderer/src/components/chat/ChatView.tsx`            |
| **MODIFY** | `src/renderer/src/components/chat/MessageBubble.tsx`       |
| **MODIFY** | `src/renderer/src/components/chat/MessageInput.tsx`        |
| **MODIFY** | `src/renderer/src/components/chat/MessageList.tsx`         |
| **MODIFY** | `src/renderer/src/components/chat/WelcomeScreen.tsx`       |
| **MODIFY** | `src/renderer/src/hooks/useKeyboardShortcuts.ts`           |
| **DELETE** | `src/renderer/src/components/layout/Sidebar.tsx`           |

**不需要的文件** (git status 中的 untracked):

- `RightPanel.tsx` — 本方案不需要右侧面板
- `chatWorkspaceStore.ts` — 模型切换直接用 settingsStore，无需新 store

## Verification

1. `npm run dev` 启动开发服务器，验证三栏布局正确渲染
2. 测试 ConversationPanel 折叠/展开动画 (点击按钮 + Ctrl+B)
3. 测试会话搜索过滤功能
4. 测试 PrimaryNav 图标点击 (Settings 打开对话框, 主题切换)
5. 测试 InputToolbar 模型切换 → 发送消息验证新模型生效
6. 测试 MessageBubble 头像显示 + 蓝色用户气泡
7. 测试 Light/Dark 主题下所有新颜色变量表现
8. `npm run typecheck` 确保类型正确
9. `npm run lint` 确保代码风格一致
