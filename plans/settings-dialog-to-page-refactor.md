# 设置页面重构：模态框 → 独立页面（Cherry Studio 风格）

## Context

当前设置通过模态框（SettingsDialog）展示，体验受限：空间小、扩展性差。需要重构为 Cherry Studio 风格的独立设置页面——左侧分类导航 + 右侧内容区，为未来更多设置项做好架构准备。

## 核心思路

用 Zustand 中的 `activeView: 'chat' | 'settings'` 替代 `dialogOpen: boolean`，实现视图切换。设置页面替代 Chat 区域渲染（PrimaryNav 保持可见），内部为两栏布局。

## 文件变更清单

### 新建文件（7 个）

| 文件 | 用途 |
|------|------|
| `settings/SettingsPage.tsx` | 设置主页面，管理表单状态，两栏布局容器 |
| `settings/SettingsSidebar.tsx` | 左侧分类导航栏（Provider / Model / General / Display） |
| `settings/ProviderSection.tsx` | Provider 区块包装器：标题 + ProviderSettings + ConnectionTest + 保存按钮 |
| `settings/ModelSection.tsx` | Model 区块包装器：标题 + ModelSettings + 保存按钮 |
| `settings/GeneralSection.tsx` | 通用设置占位区块（Coming soon） |
| `settings/DisplaySection.tsx` | 显示设置占位区块（Coming soon） |
| `settings/formUtils.ts` | 提取 DEFAULT_FORM、formStateFromSettings、分区 key 映射函数 |

### 修改文件（5 个）

| 文件 | 变更 |
|------|------|
| `stores/settingsStore.ts` | `dialogOpen` → `activeView`，`setDialogOpen` → `setActiveView` |
| `layout/AppLayout.tsx` | 条件渲染：activeView=chat 显示 ConversationPanel+ChatPanel，=settings 显示 SettingsPage |
| `layout/PrimaryNav.tsx` | Chat/Settings 按钮切换 activeView，高亮当前活动视图 |
| `hooks/useKeyboardShortcuts.ts` | Ctrl+, 改为 toggle（chat↔settings） |
| `settings/index.ts` | 导出 SettingsPage 替代 SettingsDialog |

### 删除文件（1 个）

| 文件 | 原因 |
|------|------|
| `settings/SettingsDialog.tsx` | 被 SettingsPage 完全替代 |

## 实现步骤

### Step 1: 提取表单工具函数 → `formUtils.ts`

从 SettingsDialog.tsx 提取：
- `DEFAULT_FORM` 常量
- `formStateFromSettings(settings)` 函数
- 新增 `providerKeys(form)` — 返回 provider 相关的 `Record<string, string>`
- 新增 `modelKeys(form)` — 返回 model 相关的 `Record<string, string>`

### Step 2: 修改 `settingsStore.ts`

```diff
- dialogOpen: boolean
- setDialogOpen: (open: boolean) => void
+ activeView: 'chat' | 'settings'
+ setActiveView: (view: 'chat' | 'settings') => void
```

### Step 3: 修改 `PrimaryNav.tsx`

- 读取 `activeView` 和 `setActiveView`
- Chat 按钮：`onClick={() => setActiveView('chat')}`，activeView=chat 时高亮
- Settings 按钮：`onClick={() => setActiveView('settings')}`，activeView=settings 时高亮

### Step 4: 修改 `useKeyboardShortcuts.ts`

Ctrl+, 改为 toggle：
```ts
const current = useSettingsStore.getState().activeView
setActiveView(current === 'settings' ? 'chat' : 'settings')
```

### Step 5: 创建 `SettingsSidebar.tsx`

约 200px 宽的垂直导航栏，4 个分类项：
- Provider（Cloud 图标）
- Model（Sliders 图标）
- General（Settings2 图标）
- Display（Monitor 图标）

选中项高亮，样式复用 sidebar CSS 变量。

### Step 6: 创建区块组件

**ProviderSection.tsx**: 标题 + `<ProviderSettings>` + `<ConnectionTest>` + Save 按钮
**ModelSection.tsx**: 标题 + `<ModelSettings>` + Save 按钮
**GeneralSection.tsx**: 标题 + 占位提示
**DisplaySection.tsx**: 标题 + 占位提示

每个区块独立保存（只发送该区块的 key），复用现有 ProviderSettings/ModelSettings 组件不做修改。

### Step 7: 创建 `SettingsPage.tsx`

- 管理 `activeSection` 状态和 `formState`
- formState 从 store.settings 初始化（用 formUtils）
- 两栏布局：`<SettingsSidebar>` + `<ScrollArea>` 包裹的内容区
- 条件渲染对应区块组件
- 页面顶部显示标题（"Settings"）

### Step 8: 修改 `AppLayout.tsx`

```tsx
{activeView === 'chat' ? (
  <>
    <ConversationPanel ... />
    <ChatPanel ... />
  </>
) : (
  <Suspense fallback={null}>
    <SettingsPage />
  </Suspense>
)}
```

移除 SettingsDialog 的 lazy import 和渲染。

### Step 9: 更新导出 + 删除旧文件

- `index.ts` 改为导出 `SettingsPage`
- 删除 `SettingsDialog.tsx`

## 关键设计决策

1. **不引入 React Router** — 用 Zustand 状态切换视图，保持架构简洁
2. **分区独立保存** — 每个区块有自己的 Save 按钮，只发送该区块的 key
3. **复用现有子组件** — ProviderSettings、ModelSettings、ConnectionTest 不修改
4. **PrimaryNav 始终可见** — 设置页面只替换 ConversationPanel + ChatPanel 区域

## 验证方式

1. `npm run dev` 启动应用
2. 点击 PrimaryNav 的 Settings 图标 → 应显示设置页面，Chat 图标不高亮，Settings 图标高亮
3. 左侧分类导航可切换，右侧内容跟随变化
4. Provider 区块修改 API Key 后点 Save → 验证保存成功
5. Model 区块修改 Temperature 后点 Save → 验证保存成功
6. 点击 Chat 图标或 Ctrl+, → 返回聊天视图
7. Ctrl+, 再次 → 回到设置页面（toggle 行为）
8. `npm run typecheck` 确认类型正确
