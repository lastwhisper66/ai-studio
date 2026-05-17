# 「模型与分组」管理页合并 — Design

- 日期：2026-05-17
- 作者：LastWhisper（brainstorming 协作）
- 状态：草案，待用户审阅

## 1. 背景

`Settings → 模型库`（`ModelLibrarySection`）与 `Settings → 分组库`（`ModelGroupSection`）当前是两个相互独立的页面，分别对应 `model_definitions` 与 `model_groups` 两张表。两者各自维护一份"分组"信息——模型库内的 `group_name` 是一段裸文本，分组库内的 `pattern → displayName` 是 prefix 匹配规则；它们之间没有联动，容易飘移。

四个使用反馈集中：

- 概念关系混乱：同一个"分组"为何要维护两份？
- 维护内容费力：22 条模型定义只能逐条编辑，没有批量。
- 看不到匹配效果：要去 `RemoteModelDialog` 翻列表才能验证一条 pattern 是否生效。
- 分组库本身功能薄：无搜索 / 无拖拽 / pattern 文案误导（i18n 自称 regex，实现是 prefix）。

目标：在不破坏现有数据的前提下，把两个页面合并为单一「模型与分组」配置面板，确立 `model_groups` 为"分组归属"唯一来源，并引入匹配预览 + 批量操作 + 拖拽排序。

## 2. 非目标

- 不引入正则 / 通配符匹配（保持 prefix）。
- 不做导入 / 导出。
- 不修改 `streamChat` / `RemoteModelDialog` 数据流；但其分组顺序会因 `sort_order` 拖拽和 group 来源单一化而变化。
- 不调整 `inferModelGroup()` 启发式（保持作为最后 fallback）。
- 不为 `ModelDefinition` 增加新字段。

## 3. 数据模型

### 3.1 表结构

不动 schema。两张表字段保持原状：

- `model_definitions(id, name, group_name, capabilities, provider_types, ...)`
- `model_groups(id, pattern, display_name, sort_order, ...)`

### 3.2 唯一性约定

- 「某模型属于哪个分组」**只**由 `model_groups` 决定。
- `model_definitions.group_name` 字段在数据库中保留（兼容老数据 + 不丢种子），但在新 UI 中彻底隐藏，CRUD 不再传该字段。
- `model_definitions` 仅负责"能力 + 适用 provider 类型"。

### 3.3 启动迁移：`promote-definition-groups-to-model-groups.ts`

新增 `src/main/migrate/promote-definition-groups-to-model-groups.ts`，注册到 `runMigrations()` 末位：

```ts
import { randomUUID } from 'crypto'
import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'

export function promoteDefinitionGroupsToModelGroups(): void {
  if (getSetting('migrations.definitionGroupsPromoted') === '1') return
  const db = getDb()
  db.transaction(() => {
    const rows = db
      .prepare(
        `SELECT DISTINCT group_name FROM model_definitions
         WHERE group_name IS NOT NULL AND TRIM(group_name) <> ''`,
      )
      .all() as { group_name: string }[]
    const existing = new Set(
      (db.prepare('SELECT pattern FROM model_groups').all() as { pattern: string }[]).map((r) =>
        r.pattern.toLowerCase(),
      ),
    )
    let nextOrder = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM model_groups').get() as {
        m: number
      }
    ).m
    const insert = db.prepare(
      `INSERT OR IGNORE INTO model_groups (id, pattern, display_name, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    for (const { group_name } of rows) {
      if (existing.has(group_name.toLowerCase())) continue
      nextOrder += 1
      insert.run(randomUUID(), group_name, group_name, nextOrder)
      existing.add(group_name.toLowerCase())
    }
  })()
  setSetting('migrations.definitionGroupsPromoted', '1')
}
```

- 幂等：`migrations.definitionGroupsPromoted` 设置位 + `INSERT OR IGNORE` 双保险。
- 时序：放在 `runMigrations()` 最末，确保种子先就位。

## 4. 共享类型 / IPC / Store

### 4.1 `ModelDefinition.group`

字段保留，文档注释加 `@deprecated`。新 UI / 新代码不读不写；旧种子 / 旧 DB 行保持原样。

### 4.2 IPC handlers

`model-definition-handlers.ts` 现有 `create` / `update` 仍接受 `group` 字段，但 UI 不再传 → 接收为 `undefined` → DB 保留旧值或写空。**无需改 handler**。

### 4.3 Stores

- `modelDefinitionStore`：不变。
- `modelGroupStore`：新增两个方法。
  - `reorder(orderedIds: string[]): Promise<void>` — 对每个 id 调 `update(id, { sortOrder: i })`，本地状态一次性替换。
  - `resolveRule(name: string): ModelGroup | undefined` — 与现有 `resolve(name)` 同样的 exact / longest-prefix 逻辑，但**不**走 `inferModelGroup` fallback。命中规则时返回完整 group 对象，未命中返回 `undefined`。供 `MatchPreviewBar` 的"命中规则"行与"未匹配模型"伪节点过滤使用。

## 5. UI

### 5.1 `SettingsSidebar`

```diff
- model-library  (i18n: settings.modelLibrary)
- model-group    (i18n: settings.modelGroup)
+ model-management (i18n: settings.modelManagement, 中文 "模型与分组")
```

- `SettingsSection` 类型中 `'model-library' | 'model-group'` 替换为 `'model-management'`。
- `consumePendingSection`：旧值（来自托盘菜单、深链等）自动映射到 `'model-management'`。

### 5.2 `ModelManagementSection.tsx`（新文件，替换旧两文件）

布局：

```
┌─顶栏──────────────────────────────────────────────┐
│ 模型与分组    [匹配预览: 输入模型名_____________]   │
│                                                    │
│ 预览卡片（输入非空时显示）：                       │
│   命中定义: gpt-4o   [reasoning][vision]  → 选中    │
│   命中规则: GPT-4o (pattern=gpt-4o)        → 选中    │
│   或：未命中规则，fallback 推断为 "GPT-4o"          │
├─左栏 (~260px)─────────────┬─右栏─────────────────┤
│ 分组规则                  │ 当前选中分组的模型     │
│ • 全部模型 (22)           │ ☑ 全选 [+ 添加模型]    │
│ • 未匹配模型 (3)          │ 选中 0 / 5             │
│ ─────────────────         │ [+能力][−能力]         │
│ ≡ GPT-4o (4) ✎ 🗑          │ [+Provider][−Provider] │
│ ≡ Claude (3) ✎ 🗑          │ [删除]                 │
│ ≡ Gemini (5) ✎ 🗑          │ ─────                  │
│ + 新建规则                │ ☐ gpt-4o      [r][v][w]│
│                           │ ☐ gpt-4o-mini [r][v]   │
└──────────────────────────┴──────────────────────┘
```

- 左栏顶部：两个伪节点（`all` / `unmatched`），不可拖拽。
- 左栏中部：`<DndContext>` + `SortableContext` 包裹规则列表，复用现有 `@renderer/components/ui/sortable-item`。拖拽完成后调 `modelGroupStore.reorder(...)`。
- 右栏：根据左栏选中节点过滤 `model_definitions`：
  - `all` → 全部，按 `resolveGroup(def.name)` 折叠（与旧模型库视觉一致，但 group 来源是 `model_groups`）。
  - `unmatched` → `modelGroupStore.resolveRule(def.name) === undefined` 的定义（即没有命中任何 `model_groups.pattern`、最终只能靠 `inferModelGroup` fallback 的那批）。
  - 具体 `group.id` → `modelGroupStore.resolveRule(def.name)?.id === group.id` 的定义。

### 5.3 子组件

| 组件                                    | 状态 | 备注                                                                |
| --------------------------------------- | ---- | ------------------------------------------------------------------- |
| `ModelDefinitionDialog`（拆为独立文件） | 修改 | 删除 `group` 字段表单项；保留 name / capabilities / providerTypes。 |
| `ModelGroupDialog`（拆为独立文件）      | 保留 | 文案修正（见 §5.7）。                                               |
| `MatchPreviewBar.tsx`                   | 新增 | 受控输入 + 200ms 防抖 + 解析结果卡片。                              |
| `BatchToolbar.tsx`                      | 新增 | 5 个批量按钮 + Popover/AlertDialog。                                |
| `GroupRulesPanel.tsx`                   | 新增 | 左栏：伪节点 + 拖拽规则列表 + 新建按钮。                            |
| `ModelDefinitionsPanel.tsx`             | 新增 | 右栏：全选 + 批量 + 模型列表（含 checkbox）。                       |

### 5.4 `MatchPreviewBar` 细节

- 输入框 placeholder："输入模型名预览匹配 / Type a model name to preview"。
- 防抖 200ms。
- 输入非空时显示卡片：
  - **行 1 命中定义**：调 `modelDefinitionStore.resolve(name)`；命中显示名 + 能力徽章 + provider type 胶囊；点击 → 切到对应分组节点 + 滚动并高亮右栏对应行 1.5s。未命中显示灰色 "未命中模型定义"。
  - **行 2 命中规则**：调 `modelGroupStore.resolveRule(name)`（仅判规则，不走 `inferModelGroup` fallback）；命中显示 displayName + pattern；点击 → 选中左栏对应规则。未命中显示 "未命中规则；推断为 \"{{inferModelGroup(name)}}\""。
- 卡片背景：低对比 `bg-muted/40`。

### 5.5 `BatchToolbar` 细节

- 选中数 = 0 时整条隐藏。
- 按钮：
  - **+ 能力**：Popover 多选所有能力 → 对每条选中 `update(id, { capabilities: union(existing, chosen) })`。
  - **− 能力**：Popover 仅显示"当前选中集中至少有一条具备的能力" → 对每条选中 `update(id, { capabilities: diff })`。
  - **+ Provider 类型** / **− Provider 类型**：同上，针对 `providerTypes`。
  - **删除选中**：弹 `AlertDialog` 二次确认，串行调 `remove(id)`，全部成功后清空选择集。
- **不提供"移动到分组"** —— group 已是推导值。
- 操作期间整条工具条禁用 + Loading。

### 5.6 `capability-config` 修正

```ts
free:      { ..., icon: Sparkles }     // lucide-react
embedding: { ..., icon: Boxes }
reranking: { ..., icon: ArrowUpDown }
```

颜色不变，仅替换 `icon` 字段。影响所有徽章渲染处（新合并页 + `RemoteModelDialog`）。

### 5.7 i18n

新增 key（中英双语）：

```jsonc
"settings": { ..., "modelManagement": "模型与分组" }
"modelManage": {
  ...,
  "allModels": "全部模型",
  "unmatched": "未匹配模型",
  "newGroup": "新建规则",
  "preview": {
    "placeholder": "输入模型名预览匹配",
    "matchedDef": "命中定义",
    "matchedRule": "命中规则",
    "fallback": "未命中规则，推断为 \"{{name}}\"",
    "noDefMatch": "未命中模型定义"
  },
  "batch": {
    "selected": "已选 {{count}}",
    "addCap": "+ 能力",
    "removeCap": "− 能力",
    "addProvider": "+ Provider",
    "removeProvider": "− Provider",
    "delete": "删除选中",
    "confirmDelete": "确定要删除选中的 {{count}} 个模型定义？"
  },
  "deleteRuleImpact": "{{count}} 个模型将变为未匹配状态。"
}
```

修正：`modelGroup.patternHint` → "前缀 (prefix) — 大小写不敏感；最长前缀优先"（英文同步）。

清理：实现完成前 grep `t('modelLibrary.` / `t('modelGroup.` 确认无残余引用后，删除被新页替换且无引用的 key。

### 5.8 删除文件

- `src/renderer/src/components/settings/ModelLibrarySection.tsx`
- `src/renderer/src/components/settings/ModelGroupSection.tsx`
- `SettingsPage.tsx` 中对应分支
- `SettingsSidebar` 中 `model-library` / `model-group` 两项

## 6. 行为细节

### 6.1 添加模型定义

点右栏 `+ 添加模型`：

- 当前选中是"全部模型" / "未匹配模型" → 不预填任何 group 信息。
- 当前选中是具体规则 → 在弹窗里给 hint："新建的模型若名字不与 `{{pattern}}` 前缀匹配，会出现在「未匹配模型」中。"
- 新建后 UI 重新计算 `resolveGroup` → 自动落到正确的左栏节点。

### 6.2 编辑分组规则

- 改 pattern / displayName 后，右栏列表实时刷新。
- 删除分组规则 → `AlertDialog` 中显示 `modelManage.deleteRuleImpact`（"N 个模型将变为未匹配状态"）。

### 6.3 拖拽

- 仅"分组规则"区域可拖（伪节点固定顶部）。
- 拖完调用 `modelGroupStore.reorder(newOrder)`；失败回滚 UI 顺序。

### 6.4 `RemoteModelDialog` 兼容

- `resolveGroup` 行为不变。
- 现有 `Array.from(groups.entries()).sort(([a],[b]) => a.localeCompare(b))` 改为按 `sort_order`（从 `useModelGroupStore` 派生），fallback alphabetical。
- 组内模型仍按 `localeCompare` 字母序。

## 7. 验收

### 7.1 自动

`npm run typecheck` + `npm run lint` 通过。

### 7.2 手工

1. **迁移**：升级前 `model_definitions.group_name` 中存在 "Foo" 但 `model_groups` 无 pattern=Foo；重启后 `model_groups` 新增 `(pattern=Foo, displayName=Foo)`；再次重启不重复插入。
2. **左栏拖拽**：拖动顺序后，`RemoteModelDialog` 拉远程模型，分组顺序与左栏一致。
3. **匹配预览**：分别输入 `gpt-4o`（精确）、`gpt-4o-2025-04-14`（前缀+`-`）、`某模型-gpt-4o`（包含 + 边界）、`xyz-完全陌生`（fallback）；卡片显示正确。
4. **批量加能力**：勾选 3 条 → +能力 选 "vision" → 三条均加上 vision 徽章。
5. **删除规则影响**：删除 "GPT-4o" 规则 → `AlertDialog` 提示 "4 个模型将变为未匹配状态" → 确认后这 4 条移至"未匹配模型"。
6. **图标**：`free / embedding / reranking` 三种能力徽章已不再同图标（Globe）。

### 7.3 回归

- 拉远程模型 / `RemoteModelDialog` 仍可用。
- Provider 设置中现有"添加模型"流程不受影响（仍调 `resolveModelDefinition` 自动填能力）。
- 主题色 / 中英语言切换正常。

## 8. 文件清单

新增：

- `src/main/migrate/promote-definition-groups-to-model-groups.ts`
- `src/renderer/src/components/settings/ModelManagementSection.tsx`
- `src/renderer/src/components/settings/MatchPreviewBar.tsx`
- `src/renderer/src/components/settings/BatchToolbar.tsx`
- `src/renderer/src/components/settings/GroupRulesPanel.tsx`
- `src/renderer/src/components/settings/ModelDefinitionsPanel.tsx`
- `src/renderer/src/components/settings/ModelDefinitionDialog.tsx`（从旧 `ModelLibrarySection.tsx` 拆出）
- `src/renderer/src/components/settings/ModelGroupDialog.tsx`（从旧 `ModelGroupSection.tsx` 拆出）

修改：

- `src/main/migrate/index.ts`（注册新 migration）
- `src/renderer/src/components/settings/SettingsPage.tsx`（路由分支）
- `src/renderer/src/components/settings/SettingsSidebar.tsx`（菜单项）
- `src/renderer/src/components/settings/RemoteModelDialog.tsx`（分组按 sort_order 排序）
- `src/renderer/src/components/settings/capability-config.ts`（图标）
- `src/renderer/src/i18n/locales/zh-CN.json` / `en.json`（新增 + 修正 + 清理）
- `src/renderer/src/stores/modelGroupStore.ts`（加 `reorder`）

删除：

- `src/renderer/src/components/settings/ModelLibrarySection.tsx`
- `src/renderer/src/components/settings/ModelGroupSection.tsx`

## 9. 风险与缓解

- **大小写命名冲突**：现有 `model_definitions.group_name` 与 `model_groups.pattern` 可能存在大小写差异（"GPT-4o" vs "gpt-4o"）。迁移使用 `LOWER()` 判重避免重复入库。
- **`RemoteModelDialog` 排序兼容**：现有按 `localeCompare` 改为按 `sort_order` 后，已存在的 `model_groups` 行默认 `sort_order=0`。`listModelGroups` 已是 `ORDER BY sort_order ASC, display_name ASC` 的双层排序——同 `sort_order` 下 fallback 到 display_name 字母序，行为与升级前一致；用户首次拖拽某条规则才会出现自定义顺序。无需额外重排补丁。
- **大批量删除时性能**：批量删除走串行 `remove(id)`；> 50 条时弹 Toast 提示进度。
- **i18n 清理误删**：实现完成后 grep 全仓 `i18n.t('modelLibrary.` / `t('modelGroup.` 确认无残余引用，再删旧 key。

## 10. 开放项（实现阶段可决）

- `SortableContext` 选用 `verticalListSortingStrategy`（项目其它列表均如此）。
- `MatchPreviewBar` 卡片是否常驻可见 vs 仅在输入时显示——选后者，更简洁。
- 删除规则的 AlertDialog 上是否提供"同时删除受影响模型定义"选项——**不**提供，避免数据损失风险。
