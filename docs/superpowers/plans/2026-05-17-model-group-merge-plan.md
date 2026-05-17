# 「模型与分组」管理页合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Settings 中的「模型库」和「分组库」两个独立页面合并为单页「模型与分组」，确立 `model_groups` 为分组归属唯一来源，引入匹配预览、批量编辑、分组拖拽排序。

**Architecture:** 启动迁移把现有 `model_definitions.group_name` 提升进 `model_groups`，此后 `model_definitions.group` 字段不再参与 UI。新 `ModelManagementSection` 用双栏布局——左栏分组规则（可拖拽）+ 两个伪节点（全部 / 未匹配），右栏对应模型定义（带勾选 + 批量工具条），顶栏一个匹配预览输入框。复用现有 `@dnd-kit` + `SortableItem` + Shadcn dialog/popover/alert。

**Tech Stack:** React 19 + TypeScript（strict）+ Zustand 5 + i18next + Tailwind v4 + `@dnd-kit/core` ^6.3 / `@dnd-kit/sortable` ^10 + lucide-react；后端 better-sqlite3，迁移走 `src/main/migrate/`。

**Project context (项目无自动化测试框架):** 项目唯一的自动校验是 `npm run typecheck`（node + web 两路）和 `npm run lint`。每个任务的"验证"步骤即跑这两条；UI 行为靠 `npm run dev` 跑起来手工核对。`npm run build` 内含 typecheck，因此 PR 前一定跑过。

**Spec:** `docs/superpowers/specs/2026-05-17-model-group-merge-design.md`

---

## 总体顺序

1. 数据 / Store / 类型层（Task 1–3）
2. i18n + 视觉资源（Task 4–5）
3. 子组件拆分与新建（Task 6–11）
4. 主组件 + 路由替换（Task 12–13）
5. 兼容与清理（Task 14–15）
6. 收尾验证（Task 16）

每个 Task 自包含、提交一个 commit。Task 之间允许 build 暂时无法运行（如旧 section 删了但新页未接入时），最终在 Task 16 之前必须 typecheck + dev 通过。

---

## Task 1: 标记 `ModelDefinition.group` 为 deprecated

**Files:**

- Modify: `src/shared/types.ts:201-209`

- [ ] **Step 1: 加 JSDoc 注释标记字段废弃**

文件 `src/shared/types.ts`，定位到 `ModelDefinition` interface（约第 201 行）。将 `group` 字段改为：

```ts
export interface ModelDefinition {
  id: string
  name: string
  /**
   * @deprecated 自 2026-05 起不再由 UI 维护。"模型属于哪个分组" 由 `model_groups`
   * 推导。该字段仍在 DB 中保留以兼容旧种子，但新 UI / 新代码不读不写。
   * 详见 `docs/superpowers/specs/2026-05-17-model-group-merge-design.md`。
   */
  group: string
  capabilities: ModelCapability[]
  providerTypes: ProviderType[]
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS（注释改动不影响类型，预期无新错误）

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "refactor(types): mark ModelDefinition.group as deprecated"
```

---

## Task 2: 启动迁移 — 把 `model_definitions.group_name` 提升进 `model_groups`

**Files:**

- Create: `src/main/migrate/promote-definition-groups-to-model-groups.ts`
- Modify: `src/main/migrate/index.ts`

- [ ] **Step 1: 新建迁移文件**

创建 `src/main/migrate/promote-definition-groups-to-model-groups.ts`：

```ts
import { randomUUID } from 'crypto'
import { getDb } from '../db/database'
import { getSetting, setSetting } from '../db/settings'

/**
 * One-shot migration: lift each distinct `model_definitions.group_name` value
 * into the `model_groups` table (pattern = displayName = group_name) so that
 * `model_groups` becomes the single source of truth for "which model belongs
 * to which group". `model_definitions.group_name` is left in place to avoid
 * disturbing existing seeds, but the new UI does not read or write it.
 *
 * Gated by the `migrations.definitionGroupsPromoted` setting — runs at most
 * once. Case-insensitive deduplication against existing `model_groups.pattern`
 * prevents conflicts (e.g. "GPT-4o" vs "gpt-4o").
 */
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

- [ ] **Step 2: 注册到 `runMigrations()`**

修改 `src/main/migrate/index.ts`，在末尾追加：

```ts
import { migrateBackupSettings } from './backup-settings'
import { migrateAssistantLibraryFields } from './assistant-library-fields'
import { cleanupSeedI18nKeys } from './cleanup-seed-i18n-keys'
import { initBuiltinAppliedVersions } from './init-builtin-applied-versions'
import { promoteDefinitionGroupsToModelGroups } from './promote-definition-groups-to-model-groups'

export {
  migrateBackupSettings,
  migrateAssistantLibraryFields,
  cleanupSeedI18nKeys,
  initBuiltinAppliedVersions,
  promoteDefinitionGroupsToModelGroups,
}

export function runMigrations(): void {
  migrateBackupSettings()
  migrateAssistantLibraryFields()
  cleanupSeedI18nKeys()
  initBuiltinAppliedVersions()
  promoteDefinitionGroupsToModelGroups()
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck:node`
Expected: PASS

- [ ] **Step 4: 手工冒烟（可选但推荐）**

在 dev 环境删一个 `data/ai-studio.db`（或先备份） → 启动 → 退出 → 用 sqlite 客户端查 `SELECT key, value FROM settings WHERE key='migrations.definitionGroupsPromoted'` 应得 `1`；查 `SELECT pattern, display_name, sort_order FROM model_groups` 应包含原种子 + 来自 `model_definitions.group_name` distinct 值的额外行（如果有空缺）。

- [ ] **Step 5: Commit**

```bash
git add src/main/migrate/promote-definition-groups-to-model-groups.ts src/main/migrate/index.ts
git commit -m "feat(migrate): promote model_definitions.group_name into model_groups"
```

---

## Task 3: `modelGroupStore` 增加 `reorder` + `resolveRule`

**Files:**

- Modify: `src/renderer/src/stores/modelGroupStore.ts`

- [ ] **Step 1: 改接口与实现**

整个文件改为：

```ts
import { create } from 'zustand'
import type { ModelGroup } from '@shared/types'
import { inferModelGroup } from '@renderer/lib/inferModelGroup'

interface ModelGroupStore {
  groups: ModelGroup[]
  load: () => Promise<void>
  add: (data: { pattern: string; displayName: string; sortOrder?: number }) => Promise<void>
  update: (
    id: string,
    data: { pattern?: string; displayName?: string; sortOrder?: number },
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  /**
   * Persist a new ordering. `orderedIds` must contain every existing group id
   * exactly once. Updates each row's `sort_order` and replaces the local
   * cached array in one shot. Failure rolls back the local cache.
   */
  reorder: (orderedIds: string[]) => Promise<void>
  /**
   * Resolve a display group name for a model ID.
   * Two-level matching: exact → longest prefix.
   * Falls back to `inferModelGroup()` when no rule matches (returns a string).
   */
  resolve: (modelId: string) => string
  /**
   * Same matching rules as `resolve`, but returns the full ModelGroup object
   * (or undefined when no rule matches). Does NOT fall back to
   * `inferModelGroup`. Used by the MatchPreviewBar's "matched rule" row and
   * by the "unmatched models" pseudo-node filter.
   */
  resolveRule: (modelId: string) => ModelGroup | undefined
}

function matchRule(groups: ModelGroup[], modelId: string): ModelGroup | undefined {
  const lower = modelId.toLowerCase()

  const exact = groups.find((g) => g.pattern.toLowerCase() === lower)
  if (exact) return exact

  let best: ModelGroup | undefined
  for (const g of groups) {
    if (lower.startsWith(g.pattern.toLowerCase())) {
      if (!best || g.pattern.length > best.pattern.length) best = g
    }
  }
  return best
}

export const useModelGroupStore = create<ModelGroupStore>((set, get) => ({
  groups: [],

  load: async () => {
    const result = await window.api.listModelGroups()
    if (result.success && result.data) {
      set({ groups: result.data })
    }
  },

  add: async (data) => {
    const result = await window.api.createModelGroup(data)
    if (result.success && result.data) {
      set((s) => ({ groups: [...s.groups, result.data!] }))
    }
  },

  update: async (id, data) => {
    const result = await window.api.updateModelGroup(id, data)
    if (result.success && result.data) {
      set((s) => ({
        groups: s.groups.map((g) => (g.id === id ? result.data! : g)),
      }))
    }
  },

  remove: async (id) => {
    const result = await window.api.deleteModelGroup(id)
    if (result.success) {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
    }
  },

  reorder: async (orderedIds) => {
    const previous = get().groups
    const byId = new Map(previous.map((g) => [g.id, g]))
    const reordered = orderedIds
      .map((id, idx) => {
        const g = byId.get(id)
        return g ? { ...g, sortOrder: idx } : undefined
      })
      .filter((g): g is ModelGroup => g !== undefined)
    set({ groups: reordered })
    try {
      await Promise.all(
        orderedIds.map((id, idx) => window.api.updateModelGroup(id, { sortOrder: idx })),
      )
    } catch (err) {
      set({ groups: previous })
      throw err
    }
  },

  resolve: (modelId: string): string => {
    const hit = matchRule(get().groups, modelId)
    return hit ? hit.displayName : inferModelGroup(modelId)
  },

  resolveRule: (modelId: string): ModelGroup | undefined => {
    return matchRule(get().groups, modelId)
  },
}))
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/modelGroupStore.ts
git commit -m "feat(modelGroupStore): add reorder() and resolveRule()"
```

---

## Task 4: i18n 新 key + 修正 patternHint

**Files:**

- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/en.json`

- [ ] **Step 1: zh-CN.json — 设置侧栏新 key**

定位 `settings.sections`（约第 196 行），在 `modelGroup` 一行下方追加 `modelManagement`，并保留旧 key（清理放最后任务）。结果应为：

```jsonc
"sections": {
  "provider": "模型服务",
  "modelLibrary": "模型库",
  "modelGroup": "模型分组",
  "modelManagement": "模型与分组",
  "general": "通用设置",
  ...
}
```

- [ ] **Step 2: zh-CN.json — `modelManage` 节追加 preview/batch/pseudo 节点 key**

定位 `modelManage` 块（约第 795 行）。在 `cap` 节后、闭合 `}` 前追加：

```jsonc
"allModels": "全部模型",
"unmatched": "未匹配模型",
"newGroup": "新建规则",
"deleteRuleImpact": "{{count}} 个模型将变为未匹配状态。",
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
"newDefinitionGroupHint": "新建的模型若名字不与 \"{{pattern}}\" 前缀匹配，会出现在「未匹配模型」中。"
```

- [ ] **Step 3: zh-CN.json — 修正 `modelGroup.patternHint`**

定位 `modelGroup.patternHint` 行（约第 864 行），将值改为：

```jsonc
"patternHint": "前缀 (prefix) — 大小写不敏感；最长前缀优先",
```

- [ ] **Step 4: en.json — 对照添加英文翻译**

定位 `settings.sections` 添加：

```jsonc
"modelManagement": "Models & Groups",
```

定位 `modelManage` 块尾，追加：

```jsonc
"allModels": "All Models",
"unmatched": "Unmatched Models",
"newGroup": "New Rule",
"deleteRuleImpact": "{{count}} model(s) will become unmatched.",
"preview": {
  "placeholder": "Type a model name to preview matching",
  "matchedDef": "Matched definition",
  "matchedRule": "Matched rule",
  "fallback": "No rule matched; inferred as \"{{name}}\"",
  "noDefMatch": "No definition matched"
},
"batch": {
  "selected": "{{count}} selected",
  "addCap": "+ Capability",
  "removeCap": "− Capability",
  "addProvider": "+ Provider",
  "removeProvider": "− Provider",
  "delete": "Delete selected",
  "confirmDelete": "Delete the {{count}} selected model definition(s)?"
},
"newDefinitionGroupHint": "New definitions whose name does not start with \"{{pattern}}\" will appear under \"Unmatched Models\"."
```

定位 `modelGroup.patternHint`，改为：

```jsonc
"patternHint": "Prefix match — case-insensitive; longest prefix wins",
```

- [ ] **Step 5: 校验 JSON 合法性**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/renderer/src/i18n/locales/zh-CN.json', 'utf8')); JSON.parse(require('fs').readFileSync('src/renderer/src/i18n/locales/en.json', 'utf8')); console.log('OK')"`
Expected: 输出 `OK`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/en.json
git commit -m "i18n: add model-management keys and fix patternHint wording"
```

---

## Task 5: capability-config 修复 free/embedding/reranking 图标

**Files:**

- Modify: `src/renderer/src/components/settings/capability-config.ts`

- [ ] **Step 1: 替换三处 icon**

修改 `src/renderer/src/components/settings/capability-config.ts`，把 import 行和三条 capability 改为：

```ts
import { Brain, Eye, Globe, Wrench, Sparkles, Boxes, ArrowUpDown } from 'lucide-react'
import type { ModelCapability } from '@shared/types'

export const CAPABILITY_CONFIG: Record<
  ModelCapability,
  {
    labelKey: string
    color: string
    icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  }
> = {
  reasoning: { labelKey: 'modelManage.cap.reasoning', color: '#3b82f6', icon: Brain },
  vision: { labelKey: 'modelManage.cap.vision', color: '#22c55e', icon: Eye },
  web: { labelKey: 'modelManage.cap.web', color: '#06b6d4', icon: Globe },
  free: { labelKey: 'modelManage.cap.free', color: '#f59e0b', icon: Sparkles },
  embedding: { labelKey: 'modelManage.cap.embedding', color: '#a855f7', icon: Boxes },
  reranking: { labelKey: 'modelManage.cap.reranking', color: '#ec4899', icon: ArrowUpDown },
  tools: { labelKey: 'modelManage.cap.tools', color: '#ef4444', icon: Wrench },
}
```

`ALL_CAPABILITIES` 和 `FULL_CAPABILITIES` 不变。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/capability-config.ts
git commit -m "fix(capability-config): distinct icons for free/embedding/reranking"
```

---

## Task 6: 拆出 `ModelDefinitionDialog.tsx`（去掉 group 字段）

**Files:**

- Create: `src/renderer/src/components/settings/ModelDefinitionDialog.tsx`

- [ ] **Step 1: 新建独立的 Dialog 组件**

`src/renderer/src/components/settings/ModelDefinitionDialog.tsx` 内容：

```tsx
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import type { ModelCapability, ModelDefinition, ProviderType } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'

const ALL_PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-response', label: 'OpenAI Response' },
  { value: 'azure', label: 'Azure' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'silicon', label: 'Silicon Flow' },
  { value: 'newapi', label: 'NewAPI' },
]

export interface ModelDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ModelDefinition
  /** Optional pattern hint shown when adding from a specific rule. */
  groupPatternHint?: string
  onSave: (data: {
    name: string
    capabilities: ModelCapability[]
    providerTypes: ProviderType[]
  }) => Promise<void>
}

export function ModelDefinitionDialog({
  open,
  onOpenChange,
  initial,
  groupPatternHint,
  onSave,
}: ModelDefinitionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(initial?.capabilities ?? [])
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>(initial?.providerTypes ?? [])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog open reset
      setName(initial?.name ?? '')
      setCapabilities(initial?.capabilities ?? [])
      setProviderTypes(initial?.providerTypes ?? [])
    }
  }, [open, initial])

  const toggleCapability = (cap: ModelCapability): void => {
    setCapabilities((prev) => (prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]))
  }

  const toggleProviderType = (pt: ProviderType): void => {
    setProviderTypes((prev) => (prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]))
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    await onSave({ name: name.trim(), capabilities, providerTypes })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? t('modelLibrary.editDefinition') : t('modelLibrary.addDefinition')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.modelName')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. gpt-4o, deepseek-chat"
            />
            {groupPatternHint && (
              <p className="text-muted-foreground text-xs">
                {t('modelManage.newDefinitionGroupHint', { pattern: groupPatternHint })}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.capabilities')}</label>
            <div className="flex flex-wrap gap-2">
              {FULL_CAPABILITIES.map((cap) => {
                const cfg = CAPABILITY_CONFIG[cap]
                if (!cfg) return null
                const isActive = capabilities.includes(cap)
                const Icon = cfg.icon
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-transparent text-white'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                    style={isActive ? { backgroundColor: cfg.color } : undefined}>
                    {isActive && <X className="h-3 w-3" />}
                    <Icon className="h-3 w-3" /> {t(cfg.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.providerTypes')}</label>
            <p className="text-muted-foreground text-xs">{t('modelLibrary.providerTypesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PROVIDER_TYPES.map(({ value, label }) => {
                const isActive = providerTypes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleProviderType(value)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}>
                    {isActive && <X className="h-3 w-3" />}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {initial ? t('common.save') : t('modelLibrary.addDefinition')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

注意 `onSave` 接收的对象**不再包含** `group` 字段。

- [ ] **Step 2: typecheck**

Run: `npm run typecheck:web`
Expected: PASS（旧的 `ModelLibrarySection.tsx` 还在引用同名内部 Dialog；新建的独立文件暂时没有 consumer，不会冲突）

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/ModelDefinitionDialog.tsx
git commit -m "feat(settings): extract ModelDefinitionDialog (no group field)"
```

---

## Task 7: 拆出 `ModelGroupDialog.tsx`

**Files:**

- Create: `src/renderer/src/components/settings/ModelGroupDialog.tsx`

- [ ] **Step 1: 新建独立 Dialog**

`src/renderer/src/components/settings/ModelGroupDialog.tsx`：

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'

export interface ModelGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: { pattern: string; displayName: string }
  onSave: (data: { pattern: string; displayName: string }) => Promise<void>
}

export function ModelGroupDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: ModelGroupDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [pattern, setPattern] = useState(initialData?.pattern ?? '')
  const [displayName, setDisplayName] = useState(initialData?.displayName ?? '')

  const handleSave = async (): Promise<void> => {
    if (!pattern.trim() || !displayName.trim()) return
    await onSave({ pattern: pattern.trim(), displayName: displayName.trim() })
  }

  const handleOpenChange = (v: boolean): void => {
    if (v) {
      setPattern(initialData?.pattern ?? '')
      setDisplayName(initialData?.displayName ?? '')
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? t('modelGroup.editGroup') : t('modelGroup.addGroup')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('modelGroup.pattern')}</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t('modelGroup.patternPlaceholder')}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">{t('modelGroup.patternHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('modelGroup.displayName')}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('modelGroup.displayNamePlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!pattern.trim() || !displayName.trim()}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/ModelGroupDialog.tsx
git commit -m "feat(settings): extract ModelGroupDialog into its own file"
```

---

## Task 8: 新建 `MatchPreviewBar.tsx`

**Files:**

- Create: `src/renderer/src/components/settings/MatchPreviewBar.tsx`

- [ ] **Step 1: 新建组件**

`src/renderer/src/components/settings/MatchPreviewBar.tsx`：

```tsx
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { inferModelGroup } from '@renderer/lib/inferModelGroup'
import { CAPABILITY_CONFIG } from './capability-config'
import type { ModelDefinition, ModelGroup } from '@shared/types'

export interface MatchPreviewBarProps {
  /** Called when user clicks the "matched definition" row. */
  onPickDefinition: (def: ModelDefinition) => void
  /** Called when user clicks the "matched rule" row. Receives undefined when
   *  the row's call-to-action is "no rule matched" (caller may switch to the
   *  Unmatched pseudo-node). */
  onPickRule: (rule: ModelGroup | undefined) => void
}

/**
 * A debounced input that, given any model name, shows in one strip:
 *   1. Which `model_definition` it would resolve to (or "no definition match")
 *   2. Which `model_group` rule it would resolve to (or "no rule match;
 *      inferred as <inferModelGroup(name)>")
 * Clicking either row jumps the caller to that record.
 */
export function MatchPreviewBar({
  onPickDefinition,
  onPickRule,
}: MatchPreviewBarProps): React.JSX.Element {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(input), 200)
    return () => clearTimeout(id)
  }, [input])

  const resolveDef = useModelDefinitionStore((s) => s.resolve)
  const resolveRule = useModelGroupStore((s) => s.resolveRule)

  const matched = useMemo(() => {
    const name = debounced.trim()
    if (!name) return null
    return {
      def: resolveDef(name),
      rule: resolveRule(name),
      inferred: inferModelGroup(name),
    }
  }, [debounced, resolveDef, resolveRule])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('modelManage.preview.placeholder')}
          className="pl-9"
        />
      </div>

      {matched && (
        <div className="bg-muted/40 space-y-1.5 rounded-md border p-2.5 text-xs">
          {/* Row 1: matched definition */}
          {matched.def ? (
            <button
              type="button"
              onClick={() => onPickDefinition(matched.def!)}
              className="hover:bg-accent/40 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left">
              <span className="text-muted-foreground shrink-0">
                {t('modelManage.preview.matchedDef')}:
              </span>
              <span className="font-medium">{matched.def.name}</span>
              <div className="flex gap-1">
                {matched.def.capabilities.map((cap) => {
                  const cfg = CAPABILITY_CONFIG[cap]
                  if (!cfg) return null
                  const Icon = cfg.icon
                  return (
                    <span
                      key={cap}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                      }}>
                      <Icon className="h-2.5 w-2.5" style={{ color: cfg.color }} />
                    </span>
                  )
                })}
              </div>
            </button>
          ) : (
            <div className="text-muted-foreground px-1.5 py-1">
              <span className="shrink-0">{t('modelManage.preview.matchedDef')}:</span>{' '}
              <span className="italic">{t('modelManage.preview.noDefMatch')}</span>
            </div>
          )}

          {/* Row 2: matched rule, or fallback inferral */}
          {matched.rule ? (
            <button
              type="button"
              onClick={() => onPickRule(matched.rule!)}
              className="hover:bg-accent/40 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left">
              <span className="text-muted-foreground shrink-0">
                {t('modelManage.preview.matchedRule')}:
              </span>
              <span className="font-medium">{matched.rule.displayName}</span>
              <span className="text-muted-foreground font-mono">({matched.rule.pattern})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPickRule(undefined)}
              className="hover:bg-accent/40 text-muted-foreground flex w-full items-center gap-2 rounded px-1.5 py-1 text-left italic">
              {t('modelManage.preview.fallback', { name: matched.inferred })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/MatchPreviewBar.tsx
git commit -m "feat(settings): add MatchPreviewBar component"
```

---

## Task 9: 新建 `BatchToolbar.tsx`

**Files:**

- Create: `src/renderer/src/components/settings/BatchToolbar.tsx`

- [ ] **Step 1: 新建组件**

`src/renderer/src/components/settings/BatchToolbar.tsx`：

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'
import type { ModelCapability, ModelDefinition, ProviderType } from '@shared/types'

const ALL_PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-response', label: 'OpenAI Response' },
  { value: 'azure', label: 'Azure' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'silicon', label: 'Silicon Flow' },
  { value: 'newapi', label: 'NewAPI' },
]

export interface BatchToolbarProps {
  /** Currently selected definitions (full objects so we can compute union/diff). */
  selected: ModelDefinition[]
  /** Called for each selected id with the new capability set. */
  onUpdateCapabilities: (id: string, capabilities: ModelCapability[]) => Promise<void>
  /** Called for each selected id with the new provider-types set. */
  onUpdateProviderTypes: (id: string, providerTypes: ProviderType[]) => Promise<void>
  /** Called for each selected id to remove it. */
  onDelete: (id: string) => Promise<void>
  /** Called after a batch finishes successfully (e.g. to clear the selection). */
  onBatchDone: () => void
}

export function BatchToolbar({
  selected,
  onUpdateCapabilities,
  onUpdateProviderTypes,
  onDelete,
  onBatchDone,
}: BatchToolbarProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (selected.length === 0) return null

  // Caps that at least one selected def has — used for "remove cap" picker.
  const capsInUse: ModelCapability[] = []
  for (const cap of FULL_CAPABILITIES) {
    if (selected.some((d) => d.capabilities.includes(cap))) capsInUse.push(cap)
  }
  const providerTypesInUse: ProviderType[] = []
  for (const pt of ALL_PROVIDER_TYPES) {
    if (selected.some((d) => d.providerTypes.includes(pt.value))) providerTypesInUse.push(pt.value)
  }

  const addCaps = async (caps: ModelCapability[]): Promise<void> => {
    if (caps.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = Array.from(new Set([...def.capabilities, ...caps]))
        await onUpdateCapabilities(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const removeCaps = async (caps: ModelCapability[]): Promise<void> => {
    if (caps.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = def.capabilities.filter((c) => !caps.includes(c))
        await onUpdateCapabilities(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const addProviders = async (pts: ProviderType[]): Promise<void> => {
    if (pts.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = Array.from(new Set([...def.providerTypes, ...pts]))
        await onUpdateProviderTypes(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const removeProviders = async (pts: ProviderType[]): Promise<void> => {
    if (pts.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = def.providerTypes.filter((p) => !pts.includes(p))
        await onUpdateProviderTypes(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    setBusy(true)
    try {
      for (const def of selected) {
        await onDelete(def.id)
      }
      onBatchDone()
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
      <span className="text-muted-foreground text-xs">
        {t('modelManage.batch.selected', { count: selected.length })}
      </span>

      <CapPopover
        triggerLabel={t('modelManage.batch.addCap')}
        triggerIcon={<Plus className="h-3 w-3" />}
        caps={FULL_CAPABILITIES}
        onConfirm={addCaps}
        disabled={busy}
      />
      <CapPopover
        triggerLabel={t('modelManage.batch.removeCap')}
        triggerIcon={<Minus className="h-3 w-3" />}
        caps={capsInUse}
        onConfirm={removeCaps}
        disabled={busy || capsInUse.length === 0}
      />

      <ProviderPopover
        triggerLabel={t('modelManage.batch.addProvider')}
        triggerIcon={<Plus className="h-3 w-3" />}
        items={ALL_PROVIDER_TYPES}
        onConfirm={addProviders}
        disabled={busy}
      />
      <ProviderPopover
        triggerLabel={t('modelManage.batch.removeProvider')}
        triggerIcon={<Minus className="h-3 w-3" />}
        items={ALL_PROVIDER_TYPES.filter((p) => providerTypesInUse.includes(p.value))}
        onConfirm={removeProviders}
        disabled={busy || providerTypesInUse.length === 0}
      />

      <Button
        size="sm"
        variant="destructive"
        disabled={busy}
        onClick={() => setConfirmDelete(true)}
        className="ml-auto h-7 gap-1 text-xs">
        <Trash2 className="h-3 w-3" />
        {t('modelManage.batch.delete')}
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelManage.batch.confirmDelete', { count: selected.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface CapPopoverProps {
  triggerLabel: string
  triggerIcon: React.ReactNode
  caps: ModelCapability[]
  onConfirm: (chosen: ModelCapability[]) => Promise<void>
  disabled: boolean
}

function CapPopover({
  triggerLabel,
  triggerIcon,
  caps,
  onConfirm,
  disabled,
}: CapPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<ModelCapability[]>([])

  const toggle = (c: ModelCapability): void => {
    setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const confirm = async (): Promise<void> => {
    await onConfirm(picked)
    setPicked([])
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) setPicked([])
        setOpen(v)
      }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="h-7 gap-1 text-xs">
          {triggerIcon}
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1">
          {caps.map((cap) => {
            const cfg = CAPABILITY_CONFIG[cap]
            const Icon = cfg.icon
            const isPicked = picked.includes(cap)
            return (
              <button
                key={cap}
                type="button"
                onClick={() => toggle(cap)}
                className={`hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                  isPicked ? 'bg-accent' : ''
                }`}>
                <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                {t(cfg.labelKey)}
              </button>
            )
          })}
          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={picked.length === 0} onClick={confirm} className="h-7">
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ProviderPopoverProps {
  triggerLabel: string
  triggerIcon: React.ReactNode
  items: { value: ProviderType; label: string }[]
  onConfirm: (chosen: ProviderType[]) => Promise<void>
  disabled: boolean
}

function ProviderPopover({
  triggerLabel,
  triggerIcon,
  items,
  onConfirm,
  disabled,
}: ProviderPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<ProviderType[]>([])

  const toggle = (p: ProviderType): void => {
    setPicked((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const confirm = async (): Promise<void> => {
    await onConfirm(picked)
    setPicked([])
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) setPicked([])
        setOpen(v)
      }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="h-7 gap-1 text-xs">
          {triggerIcon}
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1">
          {items.map(({ value, label }) => {
            const isPicked = picked.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                className={`hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                  isPicked ? 'bg-accent' : ''
                }`}>
                {label}
              </button>
            )
          })}
          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={picked.length === 0} onClick={confirm} className="h-7">
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: 确认 `common.confirm` i18n key 已存在**

Run: `grep -n '"confirm"' src/renderer/src/i18n/locales/zh-CN.json | head -1`
Expected: 命中 `"confirm": "确认"`（在 `common` 命名空间下，约第 11 行）。该 key 已存在，无需新增；en.json 对应 `"Confirm"` 同样已存在。如果意外没有，则在 `common` 节点下补齐。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/BatchToolbar.tsx src/renderer/src/i18n/locales/zh-CN.json src/renderer/src/i18n/locales/en.json
git commit -m "feat(settings): add BatchToolbar for model definitions"
```

---

## Task 10: 新建 `GroupRulesPanel.tsx`（左栏）

**Files:**

- Create: `src/renderer/src/components/settings/GroupRulesPanel.tsx`

- [ ] **Step 1: 设计 selection 抽象**

左栏选中状态有三类，先在 `src/renderer/src/components/settings/group-selection.ts` 集中导出（避免主页和子组件分散定义）。新建该文件：

```ts
import type { ModelGroup } from '@shared/types'

export type GroupSelection =
  | { kind: 'all' }
  | { kind: 'unmatched' }
  | { kind: 'rule'; group: ModelGroup }

export const SEL_ALL: GroupSelection = { kind: 'all' }
export const SEL_UNMATCHED: GroupSelection = { kind: 'unmatched' }

export function isSameSelection(a: GroupSelection, b: GroupSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'rule' && b.kind === 'rule') return a.group.id === b.group.id
  return true
}
```

- [ ] **Step 2: 新建 GroupRulesPanel 组件**

`src/renderer/src/components/settings/GroupRulesPanel.tsx`：

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Layers, AlertCircle } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { SortableItem } from '@renderer/components/ui/sortable-item'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { ModelGroupDialog } from './ModelGroupDialog'
import type { ModelGroup } from '@shared/types'
import { type GroupSelection, SEL_ALL, SEL_UNMATCHED, isSameSelection } from './group-selection'

export interface GroupRulesPanelProps {
  selection: GroupSelection
  onSelectionChange: (sel: GroupSelection) => void
}

export function GroupRulesPanel({
  selection,
  onSelectionChange,
}: GroupRulesPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { groups, add, update, remove, reorder } = useModelGroupStore()
  const { definitions } = useModelDefinitionStore()
  const resolveRule = useModelGroupStore((s) => s.resolveRule)

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelGroup | null>(null)
  const [deleting, setDeleting] = useState<ModelGroup | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const countByGroupId = useMemo(() => {
    const map = new Map<string, number>()
    for (const def of definitions) {
      const r = resolveRule(def.name)
      if (r) map.set(r.id, (map.get(r.id) ?? 0) + 1)
    }
    return map
  }, [definitions, resolveRule])

  const unmatchedCount = useMemo(() => {
    let n = 0
    for (const def of definitions) {
      if (!resolveRule(def.name)) n += 1
    }
    return n
  }, [definitions, resolveRule])

  const impactedCount = useMemo(() => {
    if (!deleting) return 0
    return countByGroupId.get(deleting.id) ?? 0
  }, [deleting, countByGroupId])

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex((g) => g.id === active.id)
    const newIndex = groups.findIndex((g) => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(groups, oldIndex, newIndex)
    await reorder(reordered.map((g) => g.id))
  }

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r">
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {/* Pseudo-node: All Models */}
          <button
            type="button"
            onClick={() => onSelectionChange(SEL_ALL)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              isSameSelection(selection, SEL_ALL)
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            }`}>
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">{t('modelManage.allModels')}</span>
            <span className="text-muted-foreground text-xs">({definitions.length})</span>
          </button>

          {/* Pseudo-node: Unmatched Models */}
          <button
            type="button"
            onClick={() => onSelectionChange(SEL_UNMATCHED)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              isSameSelection(selection, SEL_UNMATCHED)
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            }`}>
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">{t('modelManage.unmatched')}</span>
            <span className="text-muted-foreground text-xs">({unmatchedCount})</span>
          </button>

          <div className="my-1 border-t" />

          {/* Sortable rule list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map((group) => {
                const isSelected = selection.kind === 'rule' && selection.group.id === group.id
                return (
                  <SortableItem
                    key={group.id}
                    id={group.id}
                    className={`group rounded-md text-sm transition-colors ${
                      isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    }`}
                    handleClassName="pl-0.5 py-1.5 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onSelectionChange({ kind: 'rule', group })}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left">
                      <span className="flex-1 truncate">{group.displayName}</span>
                      <span className="text-muted-foreground text-xs">
                        ({countByGroupId.get(group.id) ?? 0})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing(group)
                      }}
                      className="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(group)
                      }}
                      className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </SortableItem>
                )
              })}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowAddDialog(true)}
          className="w-full justify-start gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          {t('modelManage.newGroup')}
        </Button>
      </div>

      <ModelGroupDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={async (data) => {
          await add(data)
          setShowAddDialog(false)
        }}
      />

      {editing && (
        <ModelGroupDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          initialData={editing}
          onSave={async (data) => {
            await update(editing.id, data)
            setEditing(null)
          }}
        />
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modelGroup.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelGroup.deleteDescription', { name: deleting?.displayName })}
              {impactedCount > 0 && (
                <>
                  <br />
                  {t('modelManage.deleteRuleImpact', { count: impactedCount })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting) {
                  await remove(deleting.id)
                  if (selection.kind === 'rule' && selection.group.id === deleting.id) {
                    onSelectionChange(SEL_ALL)
                  }
                  setDeleting(null)
                }
              }}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  )
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/GroupRulesPanel.tsx src/renderer/src/components/settings/group-selection.ts
git commit -m "feat(settings): add GroupRulesPanel with drag-sort and pseudo-nodes"
```

---

## Task 11: 新建 `ModelDefinitionsPanel.tsx`（右栏）

**Files:**

- Create: `src/renderer/src/components/settings/ModelDefinitionsPanel.tsx`

- [ ] **Step 1: 新建组件**

`src/renderer/src/components/settings/ModelDefinitionsPanel.tsx`：

```tsx
import { useState, useMemo, forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { ModelDefinitionDialog } from './ModelDefinitionDialog'
import { BatchToolbar } from './BatchToolbar'
import { CAPABILITY_CONFIG } from './capability-config'
import type { ModelDefinition } from '@shared/types'
import { type GroupSelection } from './group-selection'

export interface ModelDefinitionsPanelHandle {
  /** Scroll a definition row into view and flash a highlight ring. */
  highlightDefinition: (id: string) => void
}

export interface ModelDefinitionsPanelProps {
  selection: GroupSelection
}

export const ModelDefinitionsPanel = forwardRef<
  ModelDefinitionsPanelHandle,
  ModelDefinitionsPanelProps
>(function ModelDefinitionsPanel({ selection }, ref): React.JSX.Element {
  const { t } = useTranslation()
  const { definitions, add, update, remove } = useModelDefinitionStore()
  const resolveRule = useModelGroupStore((s) => s.resolveRule)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editing, setEditing] = useState<ModelDefinition | null>(null)
  const [deleting, setDeleting] = useState<ModelDefinition | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useImperativeHandle(ref, () => ({
    highlightDefinition: (id: string) => {
      setHighlightId(id)
      const el = rowRefs.current.get(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  }))

  useEffect(() => {
    if (!highlightId) return
    const tid = setTimeout(() => setHighlightId(null), 1500)
    return () => clearTimeout(tid)
  }, [highlightId])

  // Clear selection when the left-pane filter changes.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [selection])

  const filtered = useMemo(() => {
    if (selection.kind === 'all') return definitions
    if (selection.kind === 'unmatched') {
      return definitions.filter((d) => !resolveRule(d.name))
    }
    return definitions.filter((d) => resolveRule(d.name)?.id === selection.group.id)
  }, [definitions, selection, resolveRule])

  const groupPatternHint = selection.kind === 'rule' ? selection.group.pattern : undefined
  const selectedDefs = filtered.filter((d) => selectedIds.has(d.id))
  const allChecked = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id))

  const toggleOne = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (): void => {
    if (allChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)))
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header row */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
        <span className="text-muted-foreground text-xs">
          {selectedIds.size} / {filtered.length}
        </span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" />
            {t('modelLibrary.addDefinition')}
          </Button>
        </div>
      </div>

      {/* Batch toolbar (auto-hides when nothing selected) */}
      {selectedDefs.length > 0 && (
        <div className="border-b px-3 py-2">
          <BatchToolbar
            selected={selectedDefs}
            onUpdateCapabilities={(id, caps) => update(id, { capabilities: caps })}
            onUpdateProviderTypes={(id, pts) => update(id, { providerTypes: pts })}
            onDelete={(id) => remove(id)}
            onBatchDone={() => setSelectedIds(new Set())}
          />
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {definitions.length === 0 ? t('modelLibrary.empty') : t('modelLibrary.noResults')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((def) => {
                const isSelected = selectedIds.has(def.id)
                const isHighlighted = highlightId === def.id
                return (
                  <div
                    key={def.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(def.id, el)
                      else rowRefs.current.delete(def.id)
                    }}
                    className={`group flex items-center gap-2 rounded-md border-l-2 px-2 py-1.5 transition-colors ${
                      isSelected
                        ? 'bg-accent/50 border-primary'
                        : 'border-transparent hover:bg-accent/30'
                    } ${isHighlighted ? 'ring-2 ring-primary/60' : ''}`}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(def.id)}
                      aria-label={`Select ${def.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{def.name}</span>

                    <div className="flex gap-1">
                      {def.capabilities.map((cap) => {
                        const cfg = CAPABILITY_CONFIG[cap]
                        if (!cfg) return null
                        const Icon = cfg.icon
                        return (
                          <span
                            key={cap}
                            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: cfg.color }}>
                            <Icon className="h-3 w-3" /> {t(cfg.labelKey)}
                          </span>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditing(def)}
                      className="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(def)}
                      className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add dialog */}
      <ModelDefinitionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        groupPatternHint={groupPatternHint}
        onSave={async (data) => {
          await add(data)
          setShowAddDialog(false)
        }}
      />

      {/* Edit dialog */}
      {editing && (
        <ModelDefinitionDialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          initial={editing}
          onSave={async (data) => {
            await update(editing.id, data)
            setEditing(null)
          }}
        />
      )}

      {/* Single-row delete confirm */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelLibrary.confirmDelete', { name: deleting?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (deleting) {
                  await remove(deleting.id)
                  setDeleting(null)
                }
              }}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})
```

- [ ] **Step 2: 确认 `Checkbox` 组件已存在**

Run: `ls src/renderer/src/components/ui/checkbox.tsx`
Expected: 文件存在（项目已用过该组件，例如 topic 多选场景）。无需新增依赖。如果意外不存在则先 `npx shadcn@latest add checkbox`。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/ModelDefinitionsPanel.tsx
git commit -m "feat(settings): add ModelDefinitionsPanel with batch selection"
```

---

## Task 12: 新建主组件 `ModelManagementSection.tsx`

**Files:**

- Create: `src/renderer/src/components/settings/ModelManagementSection.tsx`

- [ ] **Step 1: 新建组件**

`src/renderer/src/components/settings/ModelManagementSection.tsx`：

```tsx
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { GroupRulesPanel } from './GroupRulesPanel'
import { ModelDefinitionsPanel, type ModelDefinitionsPanelHandle } from './ModelDefinitionsPanel'
import { MatchPreviewBar } from './MatchPreviewBar'
import { type GroupSelection, SEL_ALL, SEL_UNMATCHED } from './group-selection'

export function ModelManagementSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { isLoaded: defsLoaded, load: loadDefs } = useModelDefinitionStore()
  const groups = useModelGroupStore((s) => s.groups)
  const loadGroups = useModelGroupStore((s) => s.load)

  const [selection, setSelection] = useState<GroupSelection>(SEL_ALL)
  const defsPanelRef = useRef<ModelDefinitionsPanelHandle>(null)

  useEffect(() => {
    if (!defsLoaded) void loadDefs()
    if (groups.length === 0) void loadGroups()
  }, [defsLoaded, groups.length, loadDefs, loadGroups])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('settings.sections.modelManagement')}</h2>
            <p className="text-muted-foreground text-sm">{t('modelLibrary.description')}</p>
          </div>
          <div className="w-80">
            <MatchPreviewBar
              onPickDefinition={(def) => {
                // Jump to the rule that covers it (or "unmatched"), then highlight.
                const ruleStore = useModelGroupStore.getState()
                const rule = ruleStore.resolveRule(def.name)
                setSelection(rule ? { kind: 'rule', group: rule } : SEL_UNMATCHED)
                // Defer to next tick so the new list has rendered.
                setTimeout(() => defsPanelRef.current?.highlightDefinition(def.id), 0)
              }}
              onPickRule={(rule) => {
                setSelection(rule ? { kind: 'rule', group: rule } : SEL_UNMATCHED)
              }}
            />
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0 flex-1">
        <GroupRulesPanel selection={selection} onSelectionChange={setSelection} />
        <ModelDefinitionsPanel ref={defsPanelRef} selection={selection} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/ModelManagementSection.tsx
git commit -m "feat(settings): add ModelManagementSection (two-column merged page)"
```

---

## Task 13: 接入 SettingsSidebar + SettingsPage + App.tsx 校验集

**Files:**

- Modify: `src/renderer/src/components/settings/SettingsSidebar.tsx`
- Modify: `src/renderer/src/components/settings/SettingsPage.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: SettingsSidebar — 类型与菜单项**

修改 `src/renderer/src/components/settings/SettingsSidebar.tsx`：

类型定义改为：

```ts
export type SettingsSection =
  | 'provider'
  | 'model-management'
  | 'general'
  | 'network'
  | 'display'
  | 'data'
  | 'phrases'
  | 'keyboard-shortcuts'
  | 'quick-assistant'
  | 'selection-assistant'
  | 'about'
```

`sectionGroups` 第一组改为：

```ts
[
  { id: 'provider', labelKey: 'settings.sections.provider', icon: Cloud },
  { id: 'model-management', labelKey: 'settings.sections.modelManagement', icon: Library },
],
```

`FolderTree` 这个 icon 不再被需要——把 `lucide-react` 的 import 行里的 `FolderTree` 删掉。

- [ ] **Step 2: SettingsPage — 路由分支替换**

修改 `src/renderer/src/components/settings/SettingsPage.tsx`：

```diff
- import { ModelLibrarySection } from './ModelLibrarySection'
- import { ModelGroupSection } from './ModelGroupSection'
+ import { ModelManagementSection } from './ModelManagementSection'
```

把双 section 分支改为单一分支：

```tsx
{activeSection === 'provider' ? (
  <ProviderSection />
) : activeSection === 'model-management' ? (
  <ModelManagementSection />
) : activeSection === 'data' ? (
  <DataSection />
) : (
  // ... 其余 ScrollArea 分支不变
)}
```

- [ ] **Step 3: App.tsx — 更新 `TRAY_SETTINGS_SECTIONS` 与旧值映射**

`src/renderer/src/App.tsx` 第 21-34 行定义了一个 `TRAY_SETTINGS_SECTIONS: ReadonlySet<SettingsSection>` 给 `isSettingsSection` 类型守卫用——`SettingsSection` 一改，里面的字面量 `'model-library'` / `'model-group'` 会编译失败；同时托盘菜单可能仍发出旧 section 字符串（旧版二进制 / 缓存快捷方式），希望映射到 `'model-management'` 而不是 fallback 到 `'general'`。

将集合改为：

```ts
const TRAY_SETTINGS_SECTIONS: ReadonlySet<SettingsSection> = new Set([
  'provider',
  'model-management',
  'general',
  'network',
  'display',
  'data',
  'phrases',
  'keyboard-shortcuts',
  'quick-assistant',
  'selection-assistant',
  'about',
])
```

在 `isSettingsSection` 函数下方新增一个 legacy 映射：

```ts
function migrateLegacySection(section: string | undefined): string | undefined {
  if (section === 'model-library' || section === 'model-group') return 'model-management'
  return section
}
```

把 `onTrayNavigateSettings` 的 callback（约第 102-105 行）改为：

```tsx
const offNavSettings = window.api.onTrayNavigateSettings(({ section }) => {
  const migrated = migrateLegacySection(section)
  const target: SettingsSection = isSettingsSection(migrated) ? migrated : 'general'
  useSettingsStore.getState().navigateToSettings(target)
})
```

- [ ] **Step 4: typecheck — 关键里程碑**

Run: `npm run typecheck`
Expected: 旧 `ModelLibrarySection` / `ModelGroupSection` 还在仓库但 SettingsPage 不再引用，成为 dead code，**typecheck 应该 PASS**。如果失败多半是某处仍引用 `'model-library'` / `'model-group'` 字面量——grep 修正。

Run: `grep -rn "'model-library'\|'model-group'" src/renderer/src --include="*.ts" --include="*.tsx"`
Expected: 仅出现在 `App.tsx` 的 `migrateLegacySection` 中（旧值映射目标），其它任何命中都需修正。

- [ ] **Step 5: 手工冒烟**

Run: `npm run dev`

- 进入"设置"，左栏应出现一项"模型与分组"，旧"模型库" / "模型分组"两项已消失。
- 点入后看到双栏布局，左栏"全部模型 (N)"+"未匹配模型 (M)"+ 现有规则。
- 顶栏匹配预览输入 `gpt-5.4-mini` 应显示命中定义 + 命中规则。
- 关闭 dev。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/settings/SettingsSidebar.tsx src/renderer/src/components/settings/SettingsPage.tsx src/renderer/src/App.tsx
git commit -m "feat(settings): switch SettingsSidebar entry to model-management"
```

---

## Task 14: `RemoteModelDialog` 分组排序改为按 `sort_order`

**Files:**

- Modify: `src/renderer/src/components/settings/RemoteModelDialog.tsx:82-98`

- [ ] **Step 1: 改 `groups` 派生计算**

定位 `RemoteModelDialog.tsx` 中 `const groups = useMemo(...)`（约第 84 行）。把当前的 `groupName -> models[]` 字母序逻辑改为按 `sort_order`：

```tsx
const groupsRef = useModelGroupStore((s) => s.groups)
const groups = useMemo(() => {
  // 1. Bucket models by display group name.
  const map = new Map<string, RemoteModel[]>()
  for (const model of filteredModels) {
    const groupName = resolveGroup(model.id)
    const existing = map.get(groupName) || []
    existing.push(model)
    map.set(groupName, existing)
  }
  // 2. Determine display order: prefer the order of `groupsRef` (already
  //    sorted by sort_order ASC, display_name ASC from listModelGroups);
  //    unknown displayNames (e.g. inferModelGroup fallbacks) fall through
  //    in alphabetical order at the end.
  const ordered: [string, RemoteModel[]][] = []
  const seen = new Set<string>()
  for (const g of groupsRef) {
    const bucket = map.get(g.displayName)
    if (bucket) {
      ordered.push([g.displayName, bucket.slice().sort((a, b) => a.id.localeCompare(b.id))])
      seen.add(g.displayName)
    }
  }
  const leftovers = [...map.entries()]
    .filter(([name]) => !seen.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, models]) =>
        [name, models.slice().sort((a, b) => a.id.localeCompare(b.id))] as [string, RemoteModel[]],
    )
  return new Map([...ordered, ...leftovers])
}, [filteredModels, resolveGroup, groupsRef])
```

注意：保留 `resolveGroup`（含 inferModelGroup fallback），因为远程列表可能含未被规则命中的模型 ID。

- [ ] **Step 2: 处理 import**

在文件顶部 import 列表加入（如尚未引入）：

```ts
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
```

实际上 `RemoteModelDialog` 已经 import 了 `useModelGroupStore` 并取 `resolve`（即 `resolveGroup`），只需追加 `groups` 取值。

- [ ] **Step 3: typecheck**

Run: `npm run typecheck:web`
Expected: PASS

- [ ] **Step 4: 手工冒烟**

Run: `npm run dev`

- 在新「模型与分组」中拖动一条规则改顺序。
- 切换到 Provider 设置，打开 RemoteModelDialog（拉远程模型）→ 分组顺序应与左栏顺序一致。
- 关闭 dev。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/settings/RemoteModelDialog.tsx
git commit -m "feat(remote-model-dialog): order groups by model_groups.sort_order"
```

---

## Task 15: 删除旧 section 文件 + 清理无引用 i18n key

**Files:**

- Delete: `src/renderer/src/components/settings/ModelLibrarySection.tsx`
- Delete: `src/renderer/src/components/settings/ModelGroupSection.tsx`
- Modify: `src/renderer/src/i18n/locales/zh-CN.json`
- Modify: `src/renderer/src/i18n/locales/en.json`

- [ ] **Step 1: 删除旧 section 文件**

```bash
git rm src/renderer/src/components/settings/ModelLibrarySection.tsx
git rm src/renderer/src/components/settings/ModelGroupSection.tsx
```

- [ ] **Step 2: 全仓 grep 旧 i18n key 引用**

```bash
grep -rn "t('modelLibrary\.\|t('modelGroup\.\|t(\"modelLibrary\.\|t(\"modelGroup\.\|t(\`modelLibrary\.\|t(\`modelGroup\." src/
```

预期命中：

- 新建的 `ModelDefinitionDialog.tsx`（`modelLibrary.editDefinition`、`modelLibrary.addDefinition`、`modelLibrary.modelName`、`modelLibrary.capabilities`、`modelLibrary.providerTypes`、`modelLibrary.providerTypesHint`）。**保留**这些 key（仍在新页里使用）。
- 新建的 `ModelDefinitionsPanel.tsx`（`modelLibrary.empty`、`modelLibrary.noResults`、`modelLibrary.addDefinition`、`modelLibrary.confirmDelete`）。**保留**。
- 新建的 `ModelGroupDialog.tsx`（`modelGroup.editGroup`、`modelGroup.addGroup`、`modelGroup.pattern`、`modelGroup.patternPlaceholder`、`modelGroup.patternHint`、`modelGroup.displayName`、`modelGroup.displayNamePlaceholder`）。**保留**。
- `GroupRulesPanel.tsx`（`modelGroup.deleteTitle`、`modelGroup.deleteDescription`）。**保留**。

未被引用的 key 应删除：

- `modelLibrary.title`（旧 section 顶栏，不再需要）
- `modelLibrary.description`（**保留** — `ModelManagementSection.tsx` 仍用作副标题）
- `modelLibrary.searchPlaceholder`（旧搜索框，新页用 MatchPreviewBar）
- `modelLibrary.group`（旧 dialog 的分组字段，已删）
- `modelLibrary.ungrouped`（旧 dialog 的分组占位，已删）
- `modelGroup.title`（不再展示）
- `modelGroup.description`（不再展示）
- `modelGroup.empty`（不再展示）

- [ ] **Step 3: 编辑 zh-CN.json — 移除上述未引用 key**

修改 `src/renderer/src/i18n/locales/zh-CN.json`：

`modelLibrary` 块改为只留：

```jsonc
"modelLibrary": {
  "description": "定义模型的能力标签，添加模型时自动匹配",
  "addDefinition": "添加模型",
  "editDefinition": "编辑模型",
  "empty": "模型库为空，点击上方按钮添加模型定义",
  "noResults": "没有匹配的模型",
  "modelName": "模型名称",
  "capabilities": "能力标签",
  "providerTypes": "适用供应商",
  "providerTypesHint": "留空表示对所有供应商可见",
  "confirmDelete": "确定要删除「{{name}}」吗？此操作不可撤销。"
}
```

`modelGroup` 块改为：

```jsonc
"modelGroup": {
  "addGroup": "添加分组",
  "editGroup": "编辑分组",
  "deleteTitle": "删除分组",
  "deleteDescription": "确定要删除「{{name}}」分组规则吗？此操作不可撤销。",
  "pattern": "匹配模式",
  "patternPlaceholder": "例如: claude-opus, gpt-5.1",
  "patternHint": "前缀 (prefix) — 大小写不敏感；最长前缀优先",
  "displayName": "显示名称",
  "displayNamePlaceholder": "例如: Claude Opus, GPT-5.1"
}
```

`settings.sections` 中 `modelLibrary` 和 `modelGroup` 两 key 也移除（保留 `modelManagement`）：

```jsonc
"sections": {
  "provider": "模型服务",
  "modelManagement": "模型与分组",
  "general": "通用设置",
  ...
}
```

- [ ] **Step 4: 编辑 en.json — 同步移除**

en.json 做对称改动（保留同样集合的 key，描述用对应英文文案）。

- [ ] **Step 5: 校验 JSON + typecheck**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/renderer/src/i18n/locales/zh-CN.json', 'utf8')); JSON.parse(require('fs').readFileSync('src/renderer/src/i18n/locales/en.json', 'utf8')); console.log('OK')"`
Expected: `OK`

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer/src/components/settings/ src/renderer/src/i18n/locales/
git commit -m "chore(settings): remove old ModelLibrary/ModelGroup sections and unused i18n keys"
```

---

## Task 16: 收尾验证（typecheck + lint + dev 手工 QA）

**Files:** 无新改动

- [ ] **Step 1: typecheck 完整跑**

Run: `npm run typecheck`
Expected: PASS（main + renderer 两路）

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected: PASS。若有 warnings 不阻断；若有 errors 修正。

- [ ] **Step 3: format**

Run: `npm run format`
Expected: 无非预期变更（仅格式化）。若 git status 显示了改动，`git add` 并附在下一个 commit 中。

- [ ] **Step 4: dev 起来跑完整手工 QA**

Run: `npm run dev`
按顺序验证：

1. **迁移**：先备份当前 `data/ai-studio.db`，然后 `data/` 下保留旧 db；启动 → 退出。重启再启动；用 SQLite 客户端检查：
   - `SELECT key, value FROM settings WHERE key='migrations.definitionGroupsPromoted'` → `1`
   - `SELECT DISTINCT group_name FROM model_definitions WHERE TRIM(group_name) <> ''` 中每个值在 `model_groups.pattern`（大小写不敏感）中都有对应项。
2. **新页可用性**：设置 → 模型与分组 → 见双栏 + 顶部预览栏 + 拖拽手柄（hover 显形）。
3. **拖拽**：拖动一条分组规则 → RemoteModelDialog（任意 Provider）显示分组顺序与左栏一致。
4. **匹配预览**：
   - 输入 `gpt-5.4` → 命中定义 `gpt-5.4` + 命中规则 "GPT-5.4"，两行均可点击跳转。
   - 输入 `gpt-5.4-mini-2025-04-14` → 命中定义 `gpt-5.4-mini`（prefix-with-`-` 命中）+ 命中规则 GPT-5.4。
   - 输入 `random-unknown-model-xyz` → 行 1 显"未命中模型定义"；行 2 显"未命中规则，推断为 ..."。
5. **批量加能力**：勾选 3 条 → +能力 → 选 vision → 三条均加上 vision 徽章。
6. **批量减 Provider**：勾选 2 条（均含 OpenAI） → −Provider → 选 OpenAI → 两条均移除 OpenAI 胶囊。
7. **批量删除**：勾选 1 条 → 删除选中 → AlertDialog → 确认 → 行消失，左栏数量徽章 -1。
8. **删除分组规则的影响提示**：左栏某条规则 → 删除按钮 → AlertDialog 显示 "N 个模型将变为未匹配状态" → 取消。
9. **图标**：在某条定义打开编辑弹窗 → free / embedding / reranking 三个徽章使用 Sparkles / Boxes / ArrowUpDown 三种不同图标，可视区分。
10. **i18n 切换**：通用设置 → 切到 English → 顶级菜单"模型与分组"应变为"Models & Groups"；所有新 key 都有英文展示。
11. **回归**：进入某个 Provider → 添加模型 → 仍能从 ModelDefinition 自动填能力。RemoteModelDialog 拉远程列表正常。

- [ ] **Step 5: 关闭 dev 并提交格式化结果（若有）**

```bash
git add -A
git status                  # 确认无意外
git diff --staged --stat    # 若有 prettier 格式化产物
git commit -m "style: prettier sweep after model-management merge"  # 仅在有改动时
```

- [ ] **Step 6: 推送（仅在用户确认后）**

不主动 push。可以汇报：所有 commit 已就位（约 16 个），等待用户决定开 PR。

---

## 一致性 / 自审清单（实施前请最后扫一眼）

- [ ] `ModelDefinition.group` 仅作 `@deprecated` 兼容字段，新 UI 不读不写。
- [ ] `model_groups.pattern` 仍是 prefix 语义，文案已修正不再说 "regex"。
- [ ] `modelGroupStore.resolveRule` 与 `resolveGroup`（含 inferModelGroup fallback）是两个独立 API。
- [ ] 左栏伪节点 `SEL_ALL` / `SEL_UNMATCHED` 在 `group-selection.ts` 集中定义，三处都从这里 import。
- [ ] `ModelDefinitionsPanel` 通过 forwardRef 暴露 `highlightDefinition`，主页通过 ref 调度。
- [ ] `RemoteModelDialog` 排序：先按 `groupsRef` 顺序（来自 `model_groups`），再字母序兜底（针对 `inferModelGroup` 推断出但未在 `model_groups` 注册的名字）。
- [ ] capability-config 的三处 icon（free / embedding / reranking）已替换为 Sparkles / Boxes / ArrowUpDown。
- [ ] 新增的 i18n key 中英对齐；`common.confirm` 已存在或已补齐。
- [ ] 启动迁移幂等：`migrations.definitionGroupsPromoted` 设置位 + 大小写不敏感判重。
