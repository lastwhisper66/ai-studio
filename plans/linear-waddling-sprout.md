# 聊天输入框模型选择器

## Context

当前聊天页面底部的 `InputToolbar` 组件仅以静态文本方式显示当前活跃 Provider 的模型名称，用户无法在聊天界面中快速切换模型。需要将其改造为可交互的模型选择下拉菜单，让用户可以从已配置的 Provider 中选择不同的模型。

## 修改文件

### 1. `src/renderer/src/components/chat/InputToolbar.tsx` — 重写为模型选择器

**当前状态**: 静态展示 provider 颜色点 + 模型名文本

**改造为**:
- 使用 `DropdownMenu` 组件，点击当前模型名即可展开下拉菜单
- 触发器样式: provider 颜色点 + 模型名 + `ChevronDown` 图标，hover 时有背景色变化
- 下拉菜单内容:
  - 按 Provider 分组 (`DropdownMenuGroup` + `DropdownMenuLabel`)
  - 每个 Provider 下显示其配置的模型名称 (`DropdownMenuItem`)
  - 当前活跃的 Provider 显示 `Check` 图标标识
  - Provider 名称作为组标签，带上对应的颜色点
- 选择逻辑: 点击某个模型项 → 调用 `providerStore.setActiveProvider(providerId)`
- 下拉菜单方向: 向上弹出 (`side="top"`)，因为输入框在页面底部

**关键实现细节**:
- 从 `providerStore` 获取 `providers` 和 `activeProviderId`
- 使用 `getTemplateByType` 获取每个 provider 的颜色
- 只显示 `enabled` 状态的 provider（过滤掉禁用的）
- 无 provider 时保持原来的 "No provider configured" 提示

### 2. `src/renderer/src/components/chat/MessageInput.tsx` — 布局微调

将 InputToolbar 的触发按钮集成到 MessageInput 的输入框内部或紧邻位置，使整体更紧凑：
- 将模型选择器移到输入框左下方（textarea 下面，发送按钮的左侧）

### 3. `src/renderer/src/components/chat/ChatView.tsx` — 调整布局结构

- 将 `InputToolbar` 从独立的 `border-t` 区域移到 `MessageInput` 内部
- 统一输入区域的视觉层次

## 具体 UI 布局

```
┌─────────────────────────────────────────────┐
│  Textarea (消息输入框)              [发送]   │
│  🟢 gpt-4o ▾                                │
└─────────────────────────────────────────────┘

点击 "🟢 gpt-4o ▾" 后弹出向上的下拉菜单:

┌────────────────────────────┐
│  ● OpenAI                  │  ← 分组标签 (带颜色点)
│    ✓ gpt-4o                │  ← 当前活跃项 (有勾选)
│  ─────────────────────     │
│  ● DeepSeek                │
│    deepseek-chat           │
│  ─────────────────────     │
│  ● Google Gemini           │
│    gemini-2.0-flash        │
└────────────────────────────┘
```

## 使用的现有组件/工具

- `DropdownMenu` 系列组件 (`src/renderer/src/components/ui/dropdown-menu.tsx`)
- `getTemplateByType` (`src/renderer/src/components/settings/provider-templates.ts`)
- `useProviderStore` (`src/renderer/src/stores/providerStore.ts`)
- Lucide 图标: `ChevronUp`, `Check`

## 验证方式

1. `npm run dev` 启动应用
2. 确保已配置至少 2 个 Provider
3. 验证: 输入框下方显示当前模型名，带颜色点和箭头图标
4. 验证: 点击模型名弹出向上的下拉菜单，显示所有已配置的 Provider 及其模型
5. 验证: 当前活跃 Provider 的模型前有勾选标记
6. 验证: 点击其他模型后切换活跃 Provider，下拉菜单关闭，显示更新
7. 验证: 无 Provider 时显示 "No provider configured"
