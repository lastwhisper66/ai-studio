# Fix Plan: ThemeProvider Bug 修复

## Context

代码审查发现 ThemeProvider 中存在 2 个高优先级 bug：

1. `system` 主题模式下不会监听操作系统主题变更
2. localStorage 读取主题值时缺少合法性校验，可能导致主题行为异常

## 修复范围

### Fix 1: 添加系统主题媒体查询监听器

**文件**: `src/renderer/src/components/theme/ThemeProvider.tsx`

将 `useEffect` 中的 `system` 分支从一次性检查改为持续监听：

- 使用 `window.matchMedia('(prefers-color-scheme: dark)')` 注册 `change` 事件
- 在 effect cleanup 中移除监听器，防止内存泄漏
- `localStorage.setItem` 移到条件分支外，确保所有路径都持久化

```tsx
useEffect(() => {
  const root = document.documentElement

  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    root.classList.toggle('dark', mq.matches)
    const handler = (e: MediaQueryListEvent): void => {
      root.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handler)
    localStorage.setItem('theme', theme)
    return () => mq.removeEventListener('change', handler)
  }

  root.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('theme', theme)
}, [theme])
```

### Fix 2: 校验 localStorage 主题值

**文件**: `src/renderer/src/components/theme/ThemeProvider.tsx`

将 `useState` 初始化中的不安全类型断言替换为显式校验：

```tsx
const [theme, setTheme] = useState<Theme>(() => {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
})
```

## 不修改的项

- 🟡 Sidebar `w-70` 固定宽度 — 属于后续需求（可折叠侧边栏），不在本次范围内
- 🟡 ChatPanel 输入框无交互 — 属于 Phase 2 功能开发，不在本次范围内

## 验证方式

1. `pnpm dev` 启动应用，验证暗色主题正常显示
2. 切换亮色/暗色/系统主题，确认切换正常
3. 刷新页面，确认主题偏好从 localStorage 正确恢复
4. 在 DevTools 中手动设置 `localStorage.setItem('theme', 'invalid')`，刷新后应回退到暗色主题
