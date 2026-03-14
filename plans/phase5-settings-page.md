# Phase 5: Settings Page - Implementation Plan

## Context

AI Studio 阶段 1-4 已完成（脚手架、UI、数据层、AI 流式聊天）。用户可以对话，但 API 配置（Key、模型、Provider 等）目前只能直接写数据库。阶段 5 的目标是构建完整的设置 UI，让用户通过图形界面配置 API、测试连接、并加密存储敏感信息。

**已有基础设施**（不需重建）：

- Settings DB 层（`src/main/db/settings.ts`）：`getSetting`、`setSetting`、`getAllSettings`
- Settings IPC handlers（`src/main/ipc/settings-handlers.ts`）：三个 handler 已注册
- Preload API（`src/preload/index.ts`）：`window.api.getSetting/setSetting/getAllSettings` 已暴露
- AI 客户端工厂（`src/main/ai/index.ts`）：`loadApiSettings()` 从 DB 读取 `api.*` 键值

---

## Implementation Steps

### Step 1: 安装 Shadcn 组件

```bash
npx shadcn@latest add tabs select slider label
```

生成 `src/renderer/src/components/ui/` 下 4 个新组件文件。

### Step 2: 添加 IPC 通道和类型

**`src/shared/ipc-channels.ts`** — 在 Settings 区块末尾添加：

```ts
SETTINGS_TEST_CONNECTION: 'settings:test-connection',
```

**`src/shared/types.ts`** — 添加连接测试 payload 类型：

```ts
export interface TestConnectionPayload {
  provider: ApiProvider
  apiKey: string
  baseUrl?: string
  endpoint?: string
  apiVersion?: string
  deploymentName?: string
  model: string
}
```

### Step 3: safeStorage 加密集成

**`src/main/db/settings.ts`** — 透明加密敏感 key：

- 定义 `SENSITIVE_KEYS = new Set(['api.apiKey'])`
- 修改 `setSetting`：对敏感 key 调用 `safeStorage.encryptString()` → base64 → 前缀 `enc:` 存储（不可用时存明文）
- 修改 `getSetting`：检测 `enc:` 前缀 → `safeStorage.decryptString()` 解密
- 修改 `getAllSettings`：同理对每行结果检测解密
- `safeStorage` 从 `electron` 导入，仅在 main 进程运行，安全

### Step 4: 连接测试 IPC Handler

**`src/main/ipc/settings-handlers.ts`** — 在 `registerSettingsHandlers()` 中添加：

```ts
ipcMain.handle(IpcChannels.SETTINGS_TEST_CONNECTION, async (_, payload: TestConnectionPayload) => {
  // 用 payload（表单当前值，非 DB 值）构建临时 ApiSettings
  // 调用 createAIClient(settings) 创建客户端
  // 发送最小请求：chat.completions.create({ max_tokens: 1 })
  // 15 秒超时保护（Promise.race）
  // 返回 IpcResult<string>
})
```

导入 `createAIClient` from `'../ai'`

### Step 5: Preload 暴露 testConnection

**`src/preload/index.ts`** — 在 `api` 对象 Settings 区块添加：

```ts
testConnection: (payload: TestConnectionPayload): Promise<IpcResult<string>> =>
  ipcRenderer.invoke(IpcChannels.SETTINGS_TEST_CONNECTION, payload),
```

添加 `TestConnectionPayload` 到 import。类型自动通过 `ApiType = typeof api` 传播到 `window.api`。

### Step 6: 创建 Settings Zustand Store

**`src/renderer/src/stores/settingsStore.ts`**（新建）

```ts
interface SettingsState {
  settings: Record<string, string> // 扁平 key-value，与 DB 同构
  isLoaded: boolean
  isSaving: boolean
  error: string | null
  loadSettings: () => Promise<void>
  saveSettings: (values: Record<string, string>) => Promise<boolean>
  clearError: () => void
}
```

- `loadSettings`：调用 `window.api.getAllSettings()`，设置 `settings` + `isLoaded: true`
- `saveSettings`：遍历 entries 调用 `window.api.setSetting(key, value)`，返回成功/失败
- 遵循 `conversationStore.ts` 的 Zustand 模式

### Step 7: 创建 Settings UI 组件

4 个组件放在 `src/renderer/src/components/settings/`：

#### `SettingsDialog.tsx`（主容器）

- Props: `open: boolean`, `onOpenChange: (open: boolean) => void`
- 使用 Shadcn `Dialog` + `Tabs`（两个 tab：Provider / Model）
- **本地表单状态** `SettingsFormState`，打开时从 store 初始化，保存时写回
- 底部：ConnectionTest + Save/Cancel 按钮
- Dialog 宽度：`sm:max-w-2xl`

```ts
interface SettingsFormState {
  provider: ApiProvider
  apiKey: string
  baseUrl: string
  endpoint: string
  apiVersion: string
  deploymentName: string
  model: string
  temperature: string // 字符串绑定 input，保存时 parseFloat
  maxTokens: string
  systemPrompt: string
}
```

默认值：provider=`openai`, model=`gpt-4o`, temperature=`0.7`, maxTokens=`4096`

#### `ProviderSettings.tsx`（Provider 配置）

- Props: `formState` + `onChange(field, value)`
- 顶部：`<Select>` 切换 OpenAI / Azure
- 条件渲染：
  - OpenAI → API Key（password + 眼睛切换） + Base URL + Model
  - Azure → Endpoint + API Key + API Version + Deployment Name + Model
- 使用 `<Label>` + `<Input>` 组合，API Key 用 `type="password"` + Eye/EyeOff 切换

#### `ModelSettings.tsx`（模型参数）

- Props: `formState` + `onChange(field, value)`
- Temperature：`<Slider>` min=0 max=2 step=0.1 + 数值显示
- Max Tokens：`<Input type="number">` min=1 max=128000
- System Prompt：`<Textarea>` rows=4

#### `ConnectionTest.tsx`（连接测试）

- Props: `formState`
- 内部状态：`isTesting` + `result`
- 从 formState 构建 `TestConnectionPayload`，调用 `window.api.testConnection()`
- 显示：按钮 + spinner + 成功/失败 badge

#### `index.ts`（barrel export）

```ts
export { SettingsDialog } from './SettingsDialog'
```

### Step 8: 接线 Sidebar + App

**`src/renderer/src/components/layout/Sidebar.tsx`**：

- 添加 `const [settingsOpen, setSettingsOpen] = useState(false)`
- Settings 按钮添加 `onClick={() => setSettingsOpen(true)}`
- 底部渲染 `<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />`

**`src/renderer/src/App.tsx`**：

- 导入 `useSettingsStore`，在 `useEffect` 中调用 `loadSettings()`

### Step 9: 更新 PLAN.md 进度

**`plans/PLAN.md`** — 将阶段 4 标记为 ✅ 已完成，阶段 5 标记为 ✅ 已完成

---

## Files to Create/Modify

| File                                                        | Action                                  |
| ----------------------------------------------------------- | --------------------------------------- |
| `src/shared/ipc-channels.ts`                                | Modify — add `SETTINGS_TEST_CONNECTION` |
| `src/shared/types.ts`                                       | Modify — add `TestConnectionPayload`    |
| `src/main/db/settings.ts`                                   | Modify — add safeStorage encryption     |
| `src/main/ipc/settings-handlers.ts`                         | Modify — add connection test handler    |
| `src/preload/index.ts`                                      | Modify — add `testConnection` method    |
| `src/renderer/src/stores/settingsStore.ts`                  | **Create**                              |
| `src/renderer/src/components/settings/SettingsDialog.tsx`   | **Create**                              |
| `src/renderer/src/components/settings/ProviderSettings.tsx` | **Create**                              |
| `src/renderer/src/components/settings/ModelSettings.tsx`    | **Create**                              |
| `src/renderer/src/components/settings/ConnectionTest.tsx`   | **Create**                              |
| `src/renderer/src/components/settings/index.ts`             | **Create**                              |
| `src/renderer/src/components/layout/Sidebar.tsx`            | Modify — wire settings button           |
| `src/renderer/src/App.tsx`                                  | Modify — load settings on startup       |
| `plans/PLAN.md`                                             | Modify — update progress                |

---

## Key Reusable Code

- **Zustand pattern**: 参考 `src/renderer/src/stores/conversationStore.ts` 的 `create<State>((set, get) => ...)` 模式
- **AI client factory**: 复用 `src/main/ai/index.ts` 的 `createAIClient(settings)` 做连接测试
- **IPC result pattern**: 所有 handler 返回 `IpcResult<T> = { success, data?, error? }`
- **Preload bridge pattern**: 参考现有 `ipcRenderer.invoke()` 包装方式
- **Dialog pattern**: 参考 Sidebar 中已有的 rename/delete Dialog 实现

---

## Verification

1. `pnpm dev` → 点击侧边栏齿轮按钮 → 设置 Dialog 打开
2. 切换 Provider（OpenAI ↔ Azure）→ 表单字段正确切换
3. 填入 API Key + Model → 点击 "Test Connection" → 显示成功/失败
4. 点击 Save → 关闭 Dialog → 重启应用 → 设置保留
5. 用保存的配置发送消息 → AI 正常流式回复
6. `pnpm typecheck` + `pnpm lint` 无错误
7. 验证 API Key 在数据库中加密存储（检查 SQLite 中 `api.apiKey` 值带 `enc:` 前缀）
