import { Cloud, SlidersHorizontal, Settings2, Monitor } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export type SettingsSection = 'provider' | 'model' | 'general' | 'display'

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

const sections: { id: SettingsSection; label: string; icon: React.ElementType }[] = [
  { id: 'provider', label: '模型服务', icon: Cloud },
  { id: 'model', label: '默认模型', icon: SlidersHorizontal },
  { id: 'general', label: '通用设置', icon: Settings2 },
  { id: 'display', label: '显示设置', icon: Monitor },
]

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps): React.JSX.Element {
  return (
    <nav className="w-48 shrink-0 space-y-1 border-r p-3">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSectionChange(id)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            activeSection === id
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
          )}>
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  )
}
